/**
 * Manages creation and rendering of billboard impostors for distant objects.
 * Generates 26-view sprite atlases (cube faces, edges, vertices) for each unique model.
 */

import {
  AxesHelper,
  Box3,
  Color,
  DepthTexture,
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
   * Generate impostor textures for a GLTF asset
   */
  generateImpostorForAsset(assetKey, gltf) {
    // Clone and rotate model first
    const modelClone = gltf.scene.clone();
    //modelClone.rotation.x = -_90_DEGREE;
    modelClone.updateMatrixWorld(true);

    // Compute bounding box and sphere AFTER rotation
    const boundingBox = new Box3().setFromObject(modelClone);
    const boundingSphere = new Sphere();
    boundingBox.getBoundingSphere(boundingSphere);

    // Check if center is at origin
    const center = boundingSphere.center.clone();
    console.log("Bounding sphere center:", center);
    console.log("Distance from origin:", center.length());

    // If not centered, adjust model position
    if (center.length() > 0.001) {
      console.log("Model not centered, adjusting...");
      modelClone.position.sub(center);
      modelClone.updateMatrixWorld(true);

      // Recompute bounding box/sphere after centering
      boundingBox.setFromObject(modelClone);
      boundingBox.getBoundingSphere(boundingSphere);
      console.log("New center after adjustment:", boundingSphere.center);
    }

    const radius = boundingSphere.radius;
    console.log("Bounding radius:", radius);

    const resolution = 256;
    const atlasWidth = resolution * 6;
    const atlasHeight = resolution * 5;

    const atlasTarget = new WebGLRenderTarget(atlasWidth, atlasHeight, {
      format: RGBAFormat,
      type: UnsignedByteType,
      depthBuffer: true,
      depthTexture: new DepthTexture(atlasWidth, atlasHeight),
    });

    const camera = new OrthographicCamera(
      -radius,
      radius,
      radius,
      -radius,
      0.1,
      radius * 3,
    );

    const scene = new Scene();
    scene.add(modelClone); // Already rotated and centered
    SceneUtils.addStandardLights(scene);

    const axesHelper = new AxesHelper(radius * 0.5); // Half the radius so it's visible but not huge
    scene.add(axesHelper);

    const originalClearColor = this.renderer.getClearColor(new Color());
    const originalClearAlpha = this.renderer.getClearAlpha();

    const currentViewport = new Vector4();
    this.renderer.getViewport(currentViewport);

    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setRenderTarget(atlasTarget);
    this.renderer.clear();

    // Store the camera "up" orientation for each view, so that
    // it can be used to orient the impostors in the correct direction
    const captureOrientations = [];

    // Render each of the 26 views directly into atlas positions
    for (let i = 0; i < this.directions.length; i++) {
      const dir = this.directions[i];
      const gridX = i % 6;
      const gridY = Math.floor(i / 6);

      camera.position.copy(dir).multiplyScalar(radius * 2);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld(true);

      const cameraRight = new Vector3();
      const cameraUp = new Vector3();
      const cameraForward = new Vector3();

      camera.matrix.extractBasis(cameraRight, cameraUp, cameraForward);
      captureOrientations.push(cameraUp.clone());

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

    //this.debugSaveAtlas(atlasTarget, assetKey, atlasWidth, atlasHeight);

    this.impostorData.set(assetKey, {
      colorTexture: atlasTarget.texture,
      depthTexture: atlasTarget.depthTexture,
      boundingRadius: radius,
      centerOffset: center,
      captureOrientations,
      resolution,
    });
  }

  /**
   * Debug helper to save atlas texture as PNG
   */
  debugSaveAtlas(renderTarget, assetKey, width, height) {
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
