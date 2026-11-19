/**
 * Manages creation and rendering of billboard impostors for distant objects.
 * Generates 26-view sprite atlases (cube faces, edges, vertices) for each unique model.
 */

import {
  Box3,
  BoxGeometry,
  Color,
  DataTexture,
  FrontSide,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  RGBAFormat,
  Scene,
  SRGBColorSpace,
  Sphere,
  UnsignedByteType,
  Vector3,
  WebGLRenderTarget,
} from "three";

import { SceneUtils } from "./ThreeJsUtils.js";

/**
 * Pixels of the edge of one view in an impostor atlas. Impostors replace instances beyond the
 * triangle budget, i.e. far away and small on the screen; 128 pixels need a quarter of the GPU
 * memory of 256 (1.9 instead of 7.5 MiB per instanced asset).
 */
const IMPOSTOR_CELL_RESOLUTION = 128;

export class ImpostorManager {
  constructor(renderer, contextPath) {
    this.renderer = renderer;
    this.contextPath = contextPath;

    // Map of assetKey -> {colorTexture, centerOffset, faceCornerUVData}
    this.impostorData = new Map();

    // The 26 cardinal directions (6 faces + 12 edges + 8 vertices)
    this.directions = this.generateCardinalDirections();
  }

  generateCardinalDirections() {
    const dirs = [];

    // 6 faces
    dirs.push(
      new Vector3(1, 0, 0),
      new Vector3(-1, 0, 0),
      new Vector3(0, 1, 0),
      new Vector3(0, -1, 0),
      new Vector3(0, 0, 1),
      new Vector3(0, 0, -1),
    );

    // 12 edges
    const edgeCombos = [
      [1, 1, 0],
      [1, -1, 0],
      [-1, 1, 0],
      [-1, -1, 0],
      [1, 0, 1],
      [1, 0, -1],
      [-1, 0, 1],
      [-1, 0, -1],
      [0, 1, 1],
      [0, 1, -1],
      [0, -1, 1],
      [0, -1, -1],
    ];

    edgeCombos.forEach(([x, y, z]) => {
      dirs.push(new Vector3(x, y, z).normalize());
    });

    // 8 vertices
    const vertexCombos = [
      [1, 1, 1],
      [1, 1, -1],
      [1, -1, 1],
      [1, -1, -1],
      [-1, 1, 1],
      [-1, 1, -1],
      [-1, -1, 1],
      [-1, -1, -1],
    ];

    vertexCombos.forEach(([x, y, z]) => {
      dirs.push(new Vector3(x, y, z).normalize());
    });

    return dirs;
  }

  /**
   * Build the static bounding box face definitions.
   * Each face has an outward normal and 4 corner indices into the boxCorners array.
   * Corner winding is CCW when viewed from outside (from the direction the normal points).
   * Corner order within each face: (0,0), (1,0), (1,1), (0,1) in that face's local UV space.
   *
   * Face index mapping (matches faceIndexFromNormal in fragment shader):
   *   0 = +X, 1 = -X, 2 = +Y, 3 = -Y, 4 = +Z, 5 = -Z
   */
  /**
   * Sets the frustum of the orthographic capture camera to the projection of the bounding box
   * (with a small margin). The face corner UVs are computed with the same camera, so the
   * impostor shader maps the stretched cell back.
   */
  fitCameraToBox(camera, boxCorners, radius) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const p = new Vector3();
    for (const corner of boxCorners) {
      p.copy(corner).applyMatrix4(camera.matrixWorldInverse);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    // A flat model seen from the side must not get an empty frustum.
    const minExtent = radius * 0.02;
    const padX = Math.max((maxX - minX) * 0.02, minExtent);
    const padY = Math.max((maxY - minY) * 0.02, minExtent);
    camera.left = minX - padX;
    camera.right = maxX + padX;
    camera.bottom = minY - padY;
    camera.top = maxY + padY;
    camera.updateProjectionMatrix();
  }

  buildBoxFaceDefinitions(boundingBox) {
    const { max } = boundingBox;
    const hx = max.x;
    const hy = max.y;
    const hz = max.z;

    // 8 corners of the bounding box
    const boxCorners = [
      new Vector3(-hx, -hy, -hz), // 0
      new Vector3(hx, -hy, -hz), // 1
      new Vector3(hx, hy, -hz), // 2
      new Vector3(-hx, hy, -hz), // 3
      new Vector3(-hx, -hy, hz), // 4
      new Vector3(hx, -hy, hz), // 5
      new Vector3(hx, hy, hz), // 6
      new Vector3(-hx, hy, hz), // 7
    ];

    // Face definitions: normal + 4 corner indices.
    // Corner order maps to faceUV: [0] = (0,0), [1] = (1,0), [2] = (1,1), [3] = (0,1)
    // For each face, the two UV axes are:
    //   +X face (idx 0): U = +Z, V = +Y  -> corners ordered by (z, y)
    //   -X face (idx 1): U = -Z, V = +Y  -> corners ordered by (-z, y)
    //   +Y face (idx 2): U = +X, V = +Z  -> corners ordered by (x, z)
    //   -Y face (idx 3): U = +X, V = -Z  -> corners ordered by (x, -z)
    //   +Z face (idx 4): U = +X, V = +Y  -> corners ordered by (x, y)
    //   -Z face (idx 5): U = -X, V = +Y  -> corners ordered by (-x, y)
    const boxFaces = [
      { normal: new Vector3(1, 0, 0), corners: [1, 5, 6, 2] }, // +X
      { normal: new Vector3(-1, 0, 0), corners: [0, 4, 7, 3] }, // -X
      { normal: new Vector3(0, 1, 0), corners: [3, 2, 6, 7] }, // +Y
      { normal: new Vector3(0, -1, 0), corners: [0, 1, 5, 4] }, // -Y
      { normal: new Vector3(0, 0, 1), corners: [4, 5, 6, 7] }, // +Z
      { normal: new Vector3(0, 0, -1), corners: [0, 1, 2, 3] }, // -Z
    ];

    return { boxCorners, boxFaces };
  }

  /**
   * Project bounding box face corners through the capture camera and remap to atlas UV space.
   * Returns a Float32Array of length 26 * 6 * 4 * 2 (captureIdx * faceIdx * cornerIdx * xy).
   */
  computeFaceCornerUVs(
    boxCorners,
    boxFaces,
    camera,
    captureIndex,
    atlasColumns,
    atlasRows,
    resolution,
    faceCornerUVData,
  ) {
    const gridX = captureIndex % atlasColumns;
    const gridY = Math.floor(captureIndex / atlasColumns);
    const tileU = gridX / atlasColumns;
    const tileV = gridY / atlasRows;
    const tileW = 1.0 / atlasColumns;
    const tileH = 1.0 / atlasRows;

    for (let f = 0; f < boxFaces.length; f++) {
      const face = boxFaces[f];

      for (let c = 0; c < 4; c++) {
        const corner = boxCorners[face.corners[c]].clone();

        // Project through capture camera: world -> camera -> NDC
        corner.applyMatrix4(camera.matrixWorldInverse);
        corner.applyMatrix4(camera.projectionMatrix);

        // NDC [-1,1] -> tile [0,1] -> atlas UV
        const atlasU = tileU + (corner.x * 0.5 + 0.5) * tileW;
        const atlasV = tileV + (corner.y * 0.5 + 0.5) * tileH;

        const base = (captureIndex * 6 * 4 + f * 4 + c) * 2;
        faceCornerUVData[base + 0] = atlasU;
        faceCornerUVData[base + 1] = atlasV;
      }
    }
  }

  /**
   * Generate impostor textures for a GLTF asset
   */
  /**
   * Ensure the shared render target exists at the required size.
   * A single target is reused across all assets to avoid allocating
   * hundreds of GPU framebuffers simultaneously.
   */
  getSharedRenderTarget(width, height) {
    if (
      this._sharedTarget &&
      this._sharedTarget.width === width &&
      this._sharedTarget.height === height
    ) {
      return this._sharedTarget;
    }
    this._sharedTarget?.dispose();
    // sRGB encoded: 8 bits per channel in linear values would show banding in dark shades.
    this._sharedTarget = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      type: UnsignedByteType,
      depthBuffer: true,
      colorSpace: SRGBColorSpace,
    });
    return this._sharedTarget;
  }

  /** Dispose the shared render target when impostor generation is complete. */
  disposeSharedRenderTarget() {
    this._sharedTarget?.dispose();
    this._sharedTarget = null;
  }

  /**
   * @param layoutInverse Inverse of the layout point transformation of the asset (moves the
   *        model as in the normal rendering), or null.
   */
  /**
   * Generates the impostor of the given asset. Calls are processed one after the other: they
   * share the render target.
   *
   * @returns a promise that resolves when the impostor data is stored (or the manager has been
   *          disposed meanwhile).
   */
  generateImpostorForAsset(assetKey, gltf, layoutInverse = null) {
    this._queue = (this._queue ?? Promise.resolve()).then(() =>
      this.disposed ? undefined : this.renderImpostor(assetKey, gltf, layoutInverse),
    );
    return this._queue;
  }

  async renderImpostor(assetKey, gltf, layoutInverse) {
    // Dispose old data if this asset was previously captured
    const existingData = this.impostorData.get(assetKey);
    if (existingData?.colorTexture) {
      existingData.colorTexture.dispose();
    }

    // Clone model
    const modelClone = gltf.scene.clone();
    if (layoutInverse) {
      modelClone.applyMatrix4(layoutInverse);
    }
    modelClone.updateMatrixWorld(true);

    // Compute bounding box and sphere
    const boundingBox = new Box3().setFromObject(modelClone);
    const boundingSphere = new Sphere();
    boundingBox.getBoundingSphere(boundingSphere);

    // Check if center is at origin
    const center = boundingSphere.center.clone();

    // If not centered, adjust model position
    if (center.length() > 0.001) {
      modelClone.position.sub(center);
      modelClone.updateMatrixWorld(true);

      // Recompute bounding box/sphere after centering
      boundingBox.setFromObject(modelClone);
      boundingBox.getBoundingSphere(boundingSphere);
    }

    const radius = boundingSphere.radius;

    const resolution = IMPOSTOR_CELL_RESOLUTION;
    const atlasColumns = 6;
    const atlasRows = 5;
    const atlasWidth = resolution * atlasColumns;
    const atlasHeight = resolution * atlasRows;

    const atlasTarget = this.getSharedRenderTarget(atlasWidth, atlasHeight);

    const camera = new OrthographicCamera(
      -radius,
      radius,
      radius,
      -radius,
      0.1,
      radius * 3,
    );

    const scene = new Scene();
    scene.add(modelClone);
    SceneUtils.addImpostorCaptureLights(scene);

    const originalClearColor = this.renderer.getClearColor(new Color());
    const originalClearAlpha = this.renderer.getClearAlpha();

    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setRenderTarget(atlasTarget);
    this.renderer.clear();


    // Model's up is Z-up (matches how models are authored)
    const modelUpWorld = new Vector3(0, 0, 1);

    // Build bounding box face definitions once (box is centred at origin)
    const { boxCorners, boxFaces } = this.buildBoxFaceDefinitions(boundingBox);

    // Flat array: 26 captures * 6 faces * 4 corners * 2 floats (UV)
    const faceCornerUVData = new Float32Array(26 * 6 * 4 * 2);

    // Render each of the 26 views directly into atlas positions
    for (let i = 0; i < this.directions.length; i++) {
      const dir = this.directions[i];
      const gridX = i % atlasColumns;
      const gridY = Math.floor(i / atlasColumns);

      camera.position.copy(dir).multiplyScalar(radius * 2);

      // Set camera up to match model's up (Z-up)
      // Exception: when looking along Z axis, use X as up to avoid singularity
      if (Math.abs(dir.dot(modelUpWorld)) > 0.99) {
        camera.up.set(1, 0, 0); // Use X-up when looking along Z
      } else {
        camera.up.copy(modelUpWorld); // Use Z-up otherwise
      }

      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);
      // Fill the cell with the model as seen from this direction: a sphere around a long asset
      // (a rail) would leave most of the cell empty and the impostor blurred.
      this.fitCameraToBox(camera, boxCorners, radius);

      // Project bounding box face corners to atlas UV space for this capture
      this.computeFaceCornerUVs(
        boxCorners,
        boxFaces,
        camera,
        i,
        atlasColumns,
        atlasRows,
        resolution,
        faceCornerUVData,
      );

      // Render into the atlas cell. Viewport and scissor are set on the render
      // target (in physical pixels): the renderer's setViewport/setScissor scale
      // by the device pixel ratio, which misplaces the cells on HiDPI screens.
      const cellX = gridX * resolution;
      const cellY = gridY * resolution;
      atlasTarget.viewport.set(cellX, cellY, resolution, resolution);
      atlasTarget.scissor.set(cellX, cellY, resolution, resolution);
      atlasTarget.scissorTest = true;
      this.renderer.setRenderTarget(atlasTarget);

      this.renderer.render(scene, camera);
    }

    // Reset the shared target, so that the next asset clears the whole atlas.
    atlasTarget.viewport.set(0, 0, atlasWidth, atlasHeight);
    atlasTarget.scissor.set(0, 0, atlasWidth, atlasHeight);
    atlasTarget.scissorTest = false;

    this.renderer.setClearColor(originalClearColor, originalClearAlpha);
    this.renderer.setRenderTarget(null);

    // Read back the rendered atlas to a DataTexture so we can release the
    // shared render target for the next asset instead of keeping one per asset.
    // Read back without stalling the main thread: the GPU finishes the 26 passes meanwhile.
    const pixels = new Uint8Array(atlasWidth * atlasHeight * 4);
    await this.renderer.readRenderTargetPixelsAsync(
      atlasTarget,
      0,
      0,
      atlasWidth,
      atlasHeight,
      pixels,
    );
    if (this.disposed) {
      return;
    }
    const colorTexture = new DataTexture(
      pixels,
      atlasWidth,
      atlasHeight,
      RGBAFormat,
      UnsignedByteType,
    );
    // The pixels are sRGB encoded (see getSharedRenderTarget()); the GPU decodes them to linear
    // values when sampling. Linear filtering avoids blocky impostors; mipmaps are left out, they
    // would add a third to the memory of the atlases (7.5 MiB each).
    colorTexture.colorSpace = SRGBColorSpace;
    colorTexture.magFilter = LinearFilter;
    colorTexture.minFilter = LinearFilter;
    colorTexture.needsUpdate = true;
    // The pixels are only needed for the upload to the GPU; do not keep a copy of each atlas
    // (7.5 MiB) in the JS heap.
    colorTexture.onUpdate = () => {
      colorTexture.image.data = null;
      colorTexture.onUpdate = null;
    };

    this.impostorData.set(assetKey, {
      colorTexture,
      centerOffset: center,
      faceCornerUVData,
    });
  }

  /** Releases the impostors of all assets except the given ones. */
  retain(assetKeys) {
    for (const [assetKey, data] of this.impostorData) {
      if (!assetKeys.has(assetKey)) {
        data.colorTexture?.dispose();
        this.impostorData.delete(assetKey);
      }
    }
  }

  dispose() {
    this.disposed = true;
    for (const data of this.impostorData.values()) {
      data.colorTexture?.dispose();
    }
    this.impostorData.clear();
    this.disposeSharedRenderTarget();
  }

}
