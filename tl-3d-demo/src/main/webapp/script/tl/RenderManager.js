/**
 * Centralised render management with dirty flag system.
 * Ensures exactly one render per animation frame when needed.
 */

import { Frustum, Matrix4 } from "three";

export class RenderManager {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    this.isDirty = false;
    this.isRendering = false;
    this.rafId = null;

    this.useOctree = false;
    this.sortVisibleInstances = true; // Enable by default for triangle budgeting

    // Triangle budget settings
    this.maxTrianglesPerFrame = 10_000_000; // 10M triangles per frame
    this.useTriangleBudget = true; // Enable/disable budget system

    this.renderTargets = [];

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
    this.cameraIsMoving = false;
    this.cameraStopTimer = null;
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
    // If we're not using octree, camera movement is irrelevant to instance
    // visibility. Just invalidate and return.
    if (!this.useOctree) {
      this.invalidate();
      return;
    }

    this.cameraIsMoving = true;

    // Clear any existing "stopped" timer
    if (this.cameraStopTimer) {
      clearTimeout(this.cameraStopTimer);
    }

    // Set timer to detect when camera stops
    this.cameraStopTimer = setTimeout(() => {
      this.cameraIsMoving = false;
      this.invalidate();
    }, 100);

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
          // Octree path: use frustum culling
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

  startContinuousRender() {
    let stopped = false;

    const animate = () => {
      if (stopped) return;

      this.isDirty = true;
      this.render();
      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      stopped = true;
    };
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
   * Get current rendering statistics
   * @returns {Object} Statistics object with FPS, triangle count, etc.
   */
  getStats() {
    return {
      fps: this.stats.fps,
      renderedTriangles: this.stats.renderedTriangles,
      visibleInstances: this.stats.visibleInstances,
      culledInstances: this.stats.culledInstances,
      triangleBudget: this.maxTrianglesPerFrame,
      budgetUsage:
        (
          (this.stats.renderedTriangles / this.maxTrianglesPerFrame) *
          100
        ).toFixed(1) + "%",
    };
  }

  /**
   * Set the triangle budget for rendering
   * @param {number} maxTriangles - Maximum triangles to render per frame
   */
  setTriangleBudget(maxTriangles) {
    this.maxTrianglesPerFrame = maxTriangles;
    this.invalidate();
  }

  /**
   * Enable or disable triangle budget system
   * @param {boolean} enabled - Whether to use triangle budgeting
   */
  setUseTriangleBudget(enabled) {
    this.useTriangleBudget = enabled;
    this.invalidate();
  }

  /**
   * Switch between octree-culled rendering and simple "render all" rendering.
   * Safe to call at any time; cleans up in-progress state from the previous mode.
   * @param {boolean} enabled - true = use octree culling; false = render all instances every frame
   */
  setUseOctree(enabled) {
    this.useOctree = enabled;

    if (!enabled) {
      // We're going into simple mode. Stop anything the octree path may have
      // started, and make sure all instances are visible on the next frame.
      this.cameraIsMoving = false;

      // Re-enable auto clear
      this.renderer.autoClearColor = true;
      this.renderer.autoClearDepth = true;

      this.invalidate();
    } else {
      // When using octree, we can keep auto-clear enabled
      // since we're doing deterministic frustum culling
      this.renderer.autoClearColor = true;
      this.renderer.autoClearDepth = true;
    }
  }

  dispose() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.cameraStopTimer) {
      clearTimeout(this.cameraStopTimer);
    }
    this.renderTargets = [];
  }
}
