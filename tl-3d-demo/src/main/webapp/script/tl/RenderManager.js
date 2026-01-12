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

    // Additional render targets (like NavigationCube)
    this.renderTargets = [];

    // Statistics for debugging
    this.stats = {
      frameCount: 0,
      lastFrameTime: 0,
      fps: 0,
    };
  }

  /**
   * Mark the scene as needing a re-render.
   * This is the ONLY method that should be called from outside.
   */
  invalidate() {
    if (this.isDirty) return; // Already scheduled

    this.isDirty = true;

    if (!this.isRendering) {
      this.scheduleRender();
    }
  }

  /**
   * Schedule a render for the next animation frame.
   * @private
   */
  scheduleRender() {
    if (this.rafId !== null) {
      return; // Already scheduled
    }

    this.rafId = requestAnimationFrame(() => {
      this.render();
    });
  }

  /**
   * Perform the actual render if dirty.
   * @private
   */
  render() {
    this.rafId = null;

    if (!this.isDirty) {
      return; // Nothing to render
    }

    this.isDirty = false;
    this.isRendering = true;

    try {
      // Render main scene
      this.renderer.render(this.scene, this.camera);

      // Render additional targets (navigation cube, etc.)
      this.renderTargets.forEach((target) => {
        if (target.shouldRender && target.shouldRender()) {
          target.render();
        }
      });

      // Update stats
      this.updateStats();
    } catch (error) {
      console.error("Render error:", error);
    } finally {
      this.isRendering = false;
    }
  }

  /**
   * Force an immediate render (use sparingly).
   * Useful for initial setup or screenshots.
   */
  forceRender() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isDirty = true;
    this.render();
  }

  /**
   * Register an additional render target (like NavigationCube).
   */
  registerRenderTarget(target) {
    if (!this.renderTargets.includes(target)) {
      this.renderTargets.push(target);
    }
  }

  /**
   * Unregister a render target.
   */
  unregisterRenderTarget(target) {
    const index = this.renderTargets.indexOf(target);
    if (index > -1) {
      this.renderTargets.splice(index, 1);
    }
  }

  /**
   * Start a continuous render loop (for animations).
   * Returns a function to stop the loop.
   */
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
   * Clean up resources.
   */
  dispose() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.renderTargets = [];
  }
}
