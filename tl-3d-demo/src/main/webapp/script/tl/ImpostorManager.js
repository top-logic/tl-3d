/**
 * Manages creation and rendering of billboard impostors for distant objects.
 * Generates 26-view sprite atlases (cube faces, edges, vertices) for each unique model.
 */

import {
  Box3,
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
    const boundingSphere = this.computeBoundingSphere(gltf.scene);
    const radius = boundingSphere.radius;

    const resolution = 256;
    const atlasWidth = resolution * 6; // 6 sprites wide
    const atlasHeight = resolution * 5; // 5 sprites tall

    // Create atlas render target - renders all 26 views into one texture
    const atlasTarget = new WebGLRenderTarget(atlasWidth, atlasHeight, {
      format: RGBAFormat,
      type: UnsignedByteType,
      depthBuffer: true,
      depthTexture: new DepthTexture(atlasWidth, atlasHeight),
    });

    // Set up camera and scene
    const camera = new OrthographicCamera(
      -radius,
      radius,
      radius,
      -radius,
      0.1,
      radius * 3,
    );
    camera.position.set(0, 0, radius * 2);
    camera.lookAt(0, 0, 0);

    const scene = new Scene();
    const modelClone = gltf.scene.clone();

    modelClone.rotation.x = -Math.PI / 2;

    scene.add(modelClone);
    SceneUtils.addStandardLights(scene);

    const originalClearColor = this.renderer.getClearColor(new Vector3());
    const originalClearAlpha = this.renderer.getClearAlpha();

    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setRenderTarget(atlasTarget);
    this.renderer.clear();

    // Save current viewport
    const currentViewport = new Vector4();
    this.renderer.getViewport(currentViewport);

    console.log(this.directions);

    // Render each of the 26 views directly into atlas positions
    for (let i = 0; i < 26; i++) {
      const dir = this.directions[i];
      const gridX = i % 6;
      const gridY = Math.floor(i / 6);

      // Position camera
      camera.position.copy(dir).multiplyScalar(radius * 2);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();

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

    // Restore original viewport
    this.renderer.setViewport(currentViewport);

    this.renderer.setClearColor(originalClearColor, originalClearAlpha);
    this.renderer.setRenderTarget(null);

    this.renderer.setClearColor(originalClearColor, originalClearAlpha);
    this.renderer.setRenderTarget(null);

    this.impostorData.set(assetKey, {
      colorTexture: atlasTarget.texture,
      depthTexture: atlasTarget.depthTexture,
      boundingRadius: radius,
      resolution,
    });
  }

  computeBoundingSphere(object) {
    // Similar to your existing bounding box computation
    const box = new Box3().setFromObject(object);
    const sphere = new Sphere();
    box.getBoundingSphere(sphere);
    return sphere;
  }
}
