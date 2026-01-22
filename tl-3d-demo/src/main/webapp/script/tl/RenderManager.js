/**
 * Centralized render management with dirty flag system.
 * Ensures exactly one render per animation frame when needed.
 */

export class RenderManager {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    this.isDirty = false;
    this.isRendering = false;
    this.rafId = null;

    this.renderTargets = [];

    this.stats = {
      frameCount: 0,
      lastFrameTime: 0,
      fps: 0,
    };

    this.sceneBVH = null;
    this.instanceManager = null;

    // Camera tracking
    this.cameraIsMoving = false;
    this.cameraStopTimer = null;
  }

  setSceneBVH(sceneBVH) {
    this.sceneBVH = sceneBVH;
  }

  setInstanceManager(instanceManager) {
    this.instanceManager = instanceManager;
  }

  /**
   * Call this when the camera changes (from orbit controls, etc.)
   */
  onCameraMove() {
    this.cameraIsMoving = true;

    // Clear any existing "stopped" timer
    if (this.cameraStopTimer) {
      clearTimeout(this.cameraStopTimer);
    }

    // Set timer to detect when camera stops
    this.cameraStopTimer = setTimeout(() => {
      this.cameraIsMoving = false;
      this.invalidate(); // Render full scene when stopped
    }, 1000);

    this.invalidate();
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
        if (this.cameraIsMoving && this.sceneBVH) {
          // Camera moving: use BVH to accumulate visible instances
          this.sceneBVH.queryVisibleInstances(
            this.camera,
            500, // maxRays during motion
          );

          // Get the accumulated visible instances
          const visible = this.sceneBVH.getVisibleInstances();

          for (const [assetKey, instanceIDs] of visible) {
            this.instanceManager.updateVisibleInstances(
              assetKey,
              Array.from(instanceIDs),
            );
          }

          // For any asset types not in the visible map, show none
          for (const [assetKey, meshData] of this.instanceManager
            .managedMeshes) {
            if (!visible.has(assetKey)) {
              this.instanceManager.updateVisibleInstances(assetKey, []);
            }
          }
        } else {
          // Camera stopped: restore all instances
          for (const [assetKey, meshData] of this.instanceManager
            .managedMeshes) {
            const allIDs = meshData.instanceData.map((d) => d.id);
            this.instanceManager.updateVisibleInstances(assetKey, allIDs);
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
