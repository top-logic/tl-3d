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
    this.maxTrianglesPerFrame = 10_000_000; // 5M triangles per frame
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
   * Apply triangle budget to visible objects, prioritizing closer objects.
   * Objects are already sorted by distance (front to back).
   * @param {Array} visibleObjects - Sorted array of visible objects
   * @returns {Array} Filtered array within triangle budget
   */
  applyTriangleBudget(visibleObjects) {
    let triangleCount = 0;
    const result = [];

    for (const obj of visibleObjects) {
      // Get triangle count for this asset type
      const meshData = this.instanceManager.managedMeshes.get(obj.assetKey);
      if (!meshData) continue;

      const instanceTriangles = meshData.triangleCount;

      // Check if adding this instance would exceed budget
      if (triangleCount + instanceTriangles > this.maxTrianglesPerFrame) {
        // Budget exceeded, stop adding instances
        break;
      }

      triangleCount += instanceTriangles;
      result.push(obj);
    }

    // Update stats
    this.stats.renderedTriangles = triangleCount;
    this.stats.visibleInstances = result.length;
    this.stats.culledInstances = visibleObjects.length - result.length;

    // Log if we're culling instances
    if (this.stats.culledInstances > 0) {
      console.log(
        `Triangle budget: ${triangleCount.toLocaleString()}/${this.maxTrianglesPerFrame.toLocaleString()} triangles, ` +
          `${result.length}/${visibleObjects.length} instances (culled ${this.stats.culledInstances} distant instances)`,
      );
    }

    return result;
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
          // Simple path: just show every instance, every frame.
          for (const [assetKey, meshData] of this.instanceManager
            .managedMeshes) {
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

          // Query visible instances from octree
          let visibleObjects = this.sceneOctree.queryFrustum(frustum);

          // Always sort by distance for triangle budgeting
          const cameraPos = this.camera.position;
          visibleObjects.sort((a, b) => {
            const distA = a.boundingBox.distanceToPoint(cameraPos);
            const distB = b.boundingBox.distanceToPoint(cameraPos);
            return distA - distB; // Front to back (prioritize closer objects)
          });

          // Apply triangle budget if enabled
          if (this.useTriangleBudget) {
            visibleObjects = this.applyTriangleBudget(visibleObjects);
          }

          // Group by asset key
          const visibleByAsset = new Map();
          for (const obj of visibleObjects) {
            if (!visibleByAsset.has(obj.assetKey)) {
              visibleByAsset.set(obj.assetKey, []);
            }
            visibleByAsset.get(obj.assetKey).push(obj.instanceID);
          }

          // Update instance visibility
          for (const [assetKey, instanceIDs] of visibleByAsset) {
            this.instanceManager.updateVisibleInstances(assetKey, instanceIDs);
          }

          // For assets not in visible set, hide all instances
          for (const [assetKey, meshData] of this.instanceManager
            .managedMeshes) {
            if (!visibleByAsset.has(assetKey)) {
              this.instanceManager.updateVisibleInstances(assetKey, []);
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
    console.log(
      `Triangle budget set to ${maxTriangles.toLocaleString()} triangles per frame`,
    );
    this.invalidate();
  }

  /**
   * Enable or disable triangle budget system
   * @param {boolean} enabled - Whether to use triangle budgeting
   */
  setUseTriangleBudget(enabled) {
    this.useTriangleBudget = enabled;
    console.log(`Triangle budget ${enabled ? "enabled" : "disabled"}`);
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
