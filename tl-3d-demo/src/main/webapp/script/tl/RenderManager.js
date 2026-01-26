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

    // Background accumulation
    this.accumulationIntervalId = null;
    this.isAccumulating = false;
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

    // Stop background accumulation during camera movement
    this.stopBackgroundAccumulation();

    // Clear any existing "stopped" timer
    if (this.cameraStopTimer) {
      clearTimeout(this.cameraStopTimer);
    }

    // Set timer to detect when camera stops
    this.cameraStopTimer = setTimeout(() => {
      this.cameraIsMoving = false;
      this.invalidate(); // Render full scene when stopped

      // Start background accumulation when camera stops
      this.startBackgroundAccumulation();
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
        // Update camera position for impostor billboards
        this.updateImpostorCameraUniforms();

        for (const [assetKey, meshData] of this.instanceManager.managedMeshes) {
          if (assetKey.endsWith("_impostor")) {
            // Show all impostor instances
            const allIDs = meshData.instanceData.map((d) => d.id);
            this.instanceManager.updateVisibleInstances(assetKey, allIDs);
            meshData.mesh.visible = true;
          } else {
            // Hide all real geometry
            meshData.mesh.visible = false;
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

  updateImpostorCameraUniforms() {
    // Update camera position uniform for all impostor materials
    for (const [assetKey, meshData] of this.instanceManager.managedMeshes) {
      if (assetKey.endsWith("_impostor")) {
        const material = meshData.mesh.material;
        if (material.uniforms && material.uniforms.cameraPosition) {
          material.uniforms.cameraPosition.value.copy(this.camera.position);
        }
      }
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
   * Start background accumulation of visible instances when camera is stopped.
   * This runs continuously to build up an accurate collection for when the camera starts moving.
   */
  startBackgroundAccumulation() {
    if (this.isAccumulating || !this.sceneBVH || !this.instanceManager) {
      return;
    }

    this.isAccumulating = true;

    // Use setInterval to run independently of render cycles
    // Run at ~60fps (16ms) to accumulate visible instances continuously
    this.accumulationIntervalId = setInterval(() => {
      if (!this.isAccumulating) {
        return;
      }

      // Query visible instances with fewer rays since we're not in a hurry
      // This accumulates over time to build a comprehensive visible set
      this.sceneBVH.queryVisibleInstances(this.camera, 500);
    }, 16);
  }

  /**
   * Stop background accumulation of visible instances.
   */
  stopBackgroundAccumulation() {
    this.isAccumulating = false;
    if (this.accumulationIntervalId !== null) {
      clearInterval(this.accumulationIntervalId);
      this.accumulationIntervalId = null;
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
    this.stopBackgroundAccumulation();
    this.renderTargets = [];
  }
}
