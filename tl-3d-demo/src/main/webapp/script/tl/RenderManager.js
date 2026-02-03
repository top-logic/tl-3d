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

    this.useBVH = false;

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

    // Progressive filling-in when camera stops
    this.drawnInstances = new Map(); // Map<assetKey, Set<instanceID>>
    this.isFillingIn = false;

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
    // If we're not using BVH, camera movement is irrelevant to instance
    // visibility. Just invalidate and return.
    if (!this.useBVH) {
      this.invalidate();
      return;
    }

    this.cameraIsMoving = true;

    // Stop progressive filling-in during camera movement
    this.isFillingIn = false;

    // Stop background accumulation during camera movement
    this.stopBackgroundAccumulation();

    // Clear any existing "stopped" timer
    if (this.cameraStopTimer) {
      clearTimeout(this.cameraStopTimer);
    }

    // Set timer to detect when camera stops (minimal timeout)
    this.cameraStopTimer = setTimeout(() => {
      this.cameraIsMoving = false;

      // Reset progressive filling-in state
      this.drawnInstances.clear();
      this.isFillingIn = true;

      // Start background accumulation when camera stops
      this.startBackgroundAccumulation();

      // Start progressive filling-in immediately
      this.invalidate();
    }, 50); // Minimal timeout to debounce camera movement

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
        if (!this.useBVH) {
          // Simple path: just show every instance, every frame.
          for (const [assetKey, meshData] of this.instanceManager
            .managedMeshes) {
            const allIDs = meshData.instanceData.map((d) => d.id);
            this.instanceManager.updateVisibleInstances(assetKey, allIDs);
          }
        } else if (this.cameraIsMoving && this.sceneBVH) {
          this.renderer.clear(true, true);

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
        } else if (this.isFillingIn) {
          // Camera stopped: progressively fill in instances
          // Draw a new batch each frame - previous batches remain visible via preserved buffers
          let hasMoreToFill = false;

          for (const [assetKey, meshData] of this.instanceManager
            .managedMeshes) {
            // Get or initialize drawn instances for this asset
            if (!this.drawnInstances.has(assetKey)) {
              this.drawnInstances.set(assetKey, new Set());
            }

            const drawnSet = this.drawnInstances.get(assetKey);
            const totalInstances = meshData.instanceData.length;

            let batchForThisFrame = [];

            if (drawnSet.size < totalInstances) {
              hasMoreToFill = true;

              // Randomly select a batch of instances to draw this frame
              const batchSize = Math.min(
                Math.ceil((totalInstances - drawnSet.size) * 0.2),
                250,
              );

              // Pick random undrawn instances without creating full arrays
              const batchSet = new Set();
              let attempts = 0;
              const maxAttempts = batchSize * 10; // Prevent infinite loop

              while (batchSet.size < batchSize && attempts < maxAttempts) {
                const randomIndex = Math.floor(Math.random() * totalInstances);
                const instanceID = meshData.instanceData[randomIndex].id;

                if (!drawnSet.has(instanceID)) {
                  batchSet.add(instanceID);
                  drawnSet.add(instanceID);
                }
                attempts++;
              }

              batchForThisFrame = Array.from(batchSet);
            }

            // Update visible instances to draw ONLY the new batch this frame
            // Previous batches remain visible due to preserved color/depth buffers
            this.instanceManager.updateVisibleInstances(
              assetKey,
              batchForThisFrame,
            );
          }

          // If there are still instances to fill, schedule another frame
          if (hasMoreToFill) {
            this.invalidate();
          } else {
            // All instances are drawn, stop filling-in
            this.isFillingIn = false;
          }
        } else {
          // Camera stopped and filling complete: show all instances
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
   * Switch between BVH-culled rendering and simple "render all" rendering.
   * Safe to call at any time; cleans up in-progress state from the previous mode.
   * @param {boolean} enabled - true = use BVH culling; false = render all instances every frame
   */
  setUseBVH(enabled) {
    this.useBVH = enabled;

    if (!enabled) {
      // We're going into simple mode. Stop anything the BVH path may have
      // started, and make sure all instances are visible on the next frame.
      this.isFillingIn = false;
      this.drawnInstances.clear();
      this.stopBackgroundAccumulation();
      this.cameraIsMoving = false;

      this.renderer.autoClearColor = true;
      this.renderer.autoClearDepth = true;

      this.invalidate();
    } else {
      // When using the BVH, disable auto clear color and depth to allow for
      // the scene to fill in over multiple frames.
      this.renderer.autoClearColor = false;
      this.renderer.autoClearDepth = false;
    }
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
