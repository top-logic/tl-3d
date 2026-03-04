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
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  RGBAFormat,
  Scene,
  Sphere,
  UnsignedByteType,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from "three";

import { SceneUtils } from "./ThreeJsUtils.js";

export class ImpostorManager {
  constructor(renderer, contextPath) {
    this.renderer = renderer;
    this.contextPath = contextPath;

    // Map of assetKey -> {colorTexture, depthTexture, boundingRadius}
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
    this._sharedTarget = new WebGLRenderTarget(width, height, {
      format: RGBAFormat,
      type: UnsignedByteType,
      depthBuffer: true,
    });
    return this._sharedTarget;
  }

  /** Dispose the shared render target when impostor generation is complete. */
  disposeSharedRenderTarget() {
    this._sharedTarget?.dispose();
    this._sharedTarget = null;
  }

  generateImpostorForAsset(assetKey, gltf) {
    // Dispose old data if this asset was previously captured
    const existingData = this.impostorData.get(assetKey);
    if (existingData?.colorTexture) {
      existingData.colorTexture.dispose();
    }

    // Clone model
    const modelClone = gltf.scene.clone();
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

    const resolution = 256;
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

    const currentViewport = new Vector4();
    this.renderer.getViewport(currentViewport);

    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setRenderTarget(atlasTarget);
    this.renderer.clear();

    const captureOrientations = [];

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

      // Extract the actual camera orientation after lookAt
      const cameraRight = new Vector3();
      const cameraUp = new Vector3();
      const cameraForward = new Vector3();
      camera.matrix.extractBasis(cameraRight, cameraUp, cameraForward);

      // Store the camera's up vector for this view
      captureOrientations.push(cameraUp.clone());

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

      // Set viewport to render into correct atlas position
      this.renderer.setViewport(
        gridX * resolution,
        gridY * resolution,
        resolution,
        resolution,
      );
      this.renderer.setScissor(
        gridX * resolution,
        gridY * resolution,
        resolution,
        resolution,
      );
      this.renderer.setScissorTest(true);

      // Render directly into atlas
      this.renderer.render(scene, camera);
    }

    // Reset viewport/scissor
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(currentViewport);

    this.renderer.setClearColor(originalClearColor, originalClearAlpha);
    this.renderer.setRenderTarget(null);

    // Read back the rendered atlas to a DataTexture so we can release the
    // shared render target for the next asset instead of keeping one per asset.
    const pixels = new Uint8Array(atlasWidth * atlasHeight * 4);
    this.renderer.readRenderTargetPixels(
      atlasTarget,
      0,
      0,
      atlasWidth,
      atlasHeight,
      pixels,
    );
    const colorTexture = new DataTexture(
      pixels,
      atlasWidth,
      atlasHeight,
      RGBAFormat,
      UnsignedByteType,
    );
    colorTexture.needsUpdate = true;

    // Dispose the cloned model's materials so the renderer releases its internal
    // cache entries. Geometries are shared with the source GLTF and not disposed here.
    modelClone.traverse((obj) => {
      if (obj.isMesh) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material?.dispose();
        }
      }
    });

    this.impostorData.set(assetKey, {
      colorTexture,
      depthTexture: null,
      boundingRadius: radius,
      centerOffset: center,
      captureOrientations,
      faceCornerUVData,
    });
  }

  dispose() {
    for (const data of this.impostorData.values()) {
      data.colorTexture?.dispose();
    }
    this.impostorData.clear();
    this.disposeSharedRenderTarget();
  }

  /**
   * Debug helper to save atlas texture as PNG with face corner UV outlines overlaid.
   * Pass faceCornerUVData to overlay the corner UV regions as coloured outlines,
   * so you can verify they match the rendered face regions in the atlas.
   */
  debugSaveAtlas(renderTarget, assetKey, width, height, faceCornerUVData) {
    // Read pixels from render target
    const pixels = new Uint8Array(width * height * 4);
    this.renderer.readRenderTargetPixels(
      renderTarget,
      0,
      0,
      width,
      height,
      pixels,
    );

    // Create canvas
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // Create ImageData and copy pixels
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(pixels);
    ctx.putImageData(imageData, 0, 0);

    // Flip vertically (WebGL origin is bottom-left, canvas is top-left)
    const flipped = document.createElement("canvas");
    flipped.width = width;
    flipped.height = height;
    const flipCtx = flipped.getContext("2d");
    flipCtx.translate(0, height);
    flipCtx.scale(1, -1);
    flipCtx.drawImage(canvas, 0, 0);

    if (faceCornerUVData) {
      // One outline colour per face index: 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z
      const faceStrokeColours = [
        "#ff0000", // +X red
        "#00ffff", // -X cyan
        "#00ff00", // +Y green
        "#ff00ff", // -Y magenta
        "#0000ff", // +Z blue
        "#ffff00", // -Z yellow
      ];

      for (let captureIdx = 0; captureIdx < 26; captureIdx++) {
        for (let faceIdx = 0; faceIdx < 6; faceIdx++) {
          const base = (captureIdx * 6 * 4 + faceIdx * 4) * 2;

          // Convert atlas UVs to canvas pixel coordinates.
          // UV origin is bottom-left; canvas origin is top-left after flip, so no Y inversion needed.
          const corners = [];
          for (let c = 0; c < 4; c++) {
            corners.push({
              x: faceCornerUVData[base + c * 2 + 0] * width,
              y: faceCornerUVData[base + c * 2 + 1] * height,
            });
          }

          // Draw the parallelogram outline
          flipCtx.strokeStyle = faceStrokeColours[faceIdx];
          flipCtx.lineWidth = 1.5;
          flipCtx.beginPath();
          flipCtx.moveTo(corners[0].x, corners[0].y);
          flipCtx.lineTo(corners[1].x, corners[1].y);
          flipCtx.lineTo(corners[2].x, corners[2].y);
          flipCtx.lineTo(corners[3].x, corners[3].y);
          flipCtx.closePath();
          flipCtx.stroke();

          // Mark corner 0 with a dot so winding order is visible
          flipCtx.fillStyle = faceStrokeColours[faceIdx];
          flipCtx.beginPath();
          flipCtx.arc(corners[0].x, corners[0].y, 3, 0, Math.PI * 2);
          flipCtx.fill();

          // Label with capture and face index, flipped upright
          flipCtx.save();
          flipCtx.translate(corners[0].x + 4, corners[0].y + 4);
          flipCtx.scale(1, -1);
          flipCtx.fillStyle = faceStrokeColours[faceIdx];
          flipCtx.font = "9px monospace";
          flipCtx.fillText(`c${captureIdx}f${faceIdx}`, 0, 0);
          flipCtx.restore();
        }
      }
    }

    // Download as PNG
    flipped.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `impostor-atlas-${assetKey.split("/").pop()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}
