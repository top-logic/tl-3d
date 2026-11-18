/**
 * Centralised render management with dirty flag system.
 * Ensures exactly one render per animation frame when needed.
 */

import { Frustum, Matrix4 } from "three";
import { MAX_TRIANGLES_PER_FRAME } from "./Constants.js";

export class RenderManager {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    this.isDirty = false;
    this.isRendering = false;
    this.rafId = null;

    this.useOctree = false;

    // Triangle budget settings
    this.maxTrianglesPerFrame = MAX_TRIANGLES_PER_FRAME;
    this.useTriangleBudget = true; // Enable/disable budget system

    this.renderTargets = [];

    // Optional function called before each frame is rendered.
    this.beforeRender = null;

    this.stats = {
      frameCount: 0,
      lastFrameTime: 0,
      fps: 0,
      renderedTriangles: 0,
      visibleInstances: 0,
      culledInstances: 0,
    };

    this.sceneOctree = null;
    this.instanceManager = null;

    // Camera tracking
  }

  setSceneOctree(sceneOctree) {
    this.sceneOctree = sceneOctree;
  }

  setInstanceManager(instanceManager) {
    this.instanceManager = instanceManager;
  }

  /**
   * Call this when the camera changes (from orbit controls, etc.)
   */
  onCameraMove() {
    this.invalidate();
  }

  /**
   * Apply triangle budget to visible objects, prioritising closer objects.
   * Objects are already sorted by distance (front to back).
   * Instances within budget get full geometry; the rest get impostors.
   * @param {Array} visibleObjects - Sorted array of visible objects
   * @returns {{ fullDetail: Array, impostors: Array }}
   */
  applyTriangleBudget(visibleObjects) {
    let triangleCount = 0;
    const fullDetail = [];
    const impostors = [];

    for (const obj of visibleObjects) {
      const meshData = this.instanceManager.managedMeshes.get(obj.assetKey);
      if (!meshData) continue;
      // Hidden instances are not drawn and must not use up the budget.
      if (this.instanceManager.isInstanceHidden(obj.assetKey, obj.instanceID)) continue;

      const instanceTriangles = meshData.triangleCount;

      if (triangleCount + instanceTriangles <= this.maxTrianglesPerFrame) {
        triangleCount += instanceTriangles;
        fullDetail.push(obj);
      } else {
        impostors.push(obj);
      }
    }

    this.stats.renderedTriangles = triangleCount;
    this.stats.visibleInstances = fullDetail.length;
    this.stats.culledInstances = impostors.length;

    return { fullDetail, impostors };
  }

  invalidate() {
    if (this.isDirty) return;

    this.isDirty = true;

    if (!this.isRendering) {
      this.scheduleRender();
    }
  }

  scheduleRender() {
    if (this.rafId !== null) {
      return;
    }

    this.rafId = requestAnimationFrame(() => {
      this.render();
    });
  }

  render() {
    this.rafId = null;

    if (!this.isDirty) {
      return;
    }

    this.isDirty = false;

    try {
      // Adjusts the camera, e.g. its clipping planes, before the frustum is computed.
      this.beforeRender?.();

      if (this.instanceManager) {
        if (!this.useOctree) {
          // Simple path: show every real instance, hide impostors.
          for (const [assetKey, meshData] of this.instanceManager
            .managedMeshes) {
            if (assetKey.endsWith("_impostor")) {
              this.instanceManager.updateVisibleInstances(assetKey, []);
              continue;
            }
            const allIDs = meshData.instanceData.map((d) => d.id);
            this.instanceManager.updateVisibleInstances(assetKey, allIDs);
          }
        } else if (this.sceneOctree) {
          // Octree path: use frustum culling. The camera may have moved since the last frame;
          // its world matrix is updated only when rendering, which comes after this query.
          this.camera.updateMatrixWorld();
          const frustum = new Frustum();
          const projScreenMatrix = new Matrix4();
          projScreenMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse,
          );
          frustum.setFromProjectionMatrix(projScreenMatrix);

          // Query visible instances from octree.
          // Results come back in approximate front-to-back order.
          const cameraPos = this.camera.position;
          let visibleObjects = this.sceneOctree.queryFrustum(
            frustum,
            cameraPos,
          );

          // Split into full detail vs impostor buckets
          const { fullDetail, impostors } = this.useTriangleBudget
            ? this.applyTriangleBudget(visibleObjects)
            : { fullDetail: visibleObjects, impostors: [] };

          // Group full-detail instances by asset key
          const visibleByAsset = new Map();
          for (const obj of fullDetail) {
            if (!visibleByAsset.has(obj.assetKey)) {
              visibleByAsset.set(obj.assetKey, []);
            }
            visibleByAsset.get(obj.assetKey).push(obj.instanceID);
          }

          // Group impostor instances by asset key
          const impostorByAsset = new Map();
          for (const obj of impostors) {
            const impostorKey = obj.assetKey + "_impostor";
            // Only add if impostor mesh actually exists
            if (this.instanceManager.managedMeshes.has(impostorKey)) {
              if (!impostorByAsset.has(impostorKey)) {
                impostorByAsset.set(impostorKey, []);
              }
              impostorByAsset.get(impostorKey).push(obj.instanceID);
            }
          }

          // Update visibility for all managed meshes
          for (const [assetKey] of this.instanceManager.managedMeshes) {
            if (assetKey.endsWith("_impostor")) {
              const ids = impostorByAsset.get(assetKey) || [];
              this.instanceManager.updateVisibleInstances(assetKey, ids);
            } else {
              const ids = visibleByAsset.get(assetKey) || [];
              this.instanceManager.updateVisibleInstances(assetKey, ids);
            }
          }
        }
      }

      this.renderer.render(this.scene, this.camera);

      for (const target of this.renderTargets) {
        if (target.shouldRender && target.shouldRender()) {
          target.render();
        }
      }

      this.updateStats();
    } catch (error) {
      console.error("RenderManager: Render error", error);
    }
  }

  forceRender() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isDirty = true;
    this.render();
  }

  registerRenderTarget(target) {
    if (!this.renderTargets.includes(target)) {
      this.renderTargets.push(target);
    }
  }

  unregisterRenderTarget(target) {
    const index = this.renderTargets.indexOf(target);
    if (index > -1) {
      this.renderTargets.splice(index, 1);
    }
  }

  updateStats() {
    const now = performance.now();
    this.stats.frameCount++;

    if (now - this.stats.lastFrameTime >= 1000) {
      this.stats.fps = this.stats.frameCount;
      this.stats.frameCount = 0;
      this.stats.lastFrameTime = now;
    }
  }

  /**
   * Switch between octree-culled rendering and simple "render all" rendering.
   * Safe to call at any time; cleans up in-progress state from the previous mode.
   * @param {boolean} enabled - true = use octree culling; false = render all instances every frame
   */
  setUseOctree(enabled) {
    this.useOctree = enabled;

    // The next frame shows the instances of the chosen path.
    this.invalidate();
  }

  dispose() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.renderTargets = [];
  }
}
