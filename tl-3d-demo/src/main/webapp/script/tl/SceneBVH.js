/**
 * SceneBVH.js
 *
 * Builds a BVH from bounding boxes of all instanced objects in the scene.
 * Uses three-mesh-bvh for fast raycasting to determine visible instances.
 *
 * Accumulates visible instances across frames and prunes based on stale time.
 * Respects a maximum triangle budget for the total accumulated collection.
 *
 * Usage:
 *   const bvh = new SceneBVH();
 *   bvh.buildFromInstanceManager(instanceManager, instanceGroups);
 *
 *   // Configure settings (optional)
 *   bvh.setMaxTriangles(5_000_000);
 *   bvh.setStaleFrameThreshold(30);
 *
 *   // Each frame: update accumulated visible instances
 *   bvh.queryVisibleInstances(camera, maxRays);
 *
 *   // Get current accumulated visible instances
 *   const visible = bvh.getVisibleInstances();
 *   // visible is Map<assetKey, Set<instanceID>>
 */

import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "https://cdn.jsdelivr.net/npm/three-mesh-bvh@latest/build/index.module.js";
import {
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  Raycaster,
  Vector2,
  Vector3,
} from "three";

// Extend Three.js prototypes for BVH
if (!BufferGeometry.prototype.computeBoundsTree) {
  BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
  BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
  Mesh.prototype.raycast = acceleratedRaycast;
}

export class SceneBVH {
  constructor() {
    this.proxyMesh = null;
    this.indexMap = []; // Array of {assetKey, instanceID}
    this.stats = {
      totalInstances: 0,
      totalTriangles: 0,
      buildTime: 0,
    };
    this.raycaster = new Raycaster();

    // Instance tracking for accumulation-based visibility
    // Map<assetKey, Map<instanceID, {lastSeenFrame: number, triangleCount: number}>>
    this.visibleInstances = new Map();
    this.currentFrame = 0;
    this.staleFrameThreshold = 30; // Prune instances not seen for 30 frames
    this.maxTriangles = 10_000_000; // Maximum triangles in accumulated collection
    this.currentTriangleCount = 0; // Running total of triangles in visible instances
  }

  /**
   * Build BVH from all instances in the scene
   * @param {InstancedMeshManager} instanceManager - The instance manager
   * @param {Map} instanceGroups - Map of assetKey -> {asset, instances[]}
   */
  buildFromInstanceManager(instanceManager, instanceGroups) {
    const startTime = performance.now();

    // Store reference for triangle count lookups
    this.instanceManager = instanceManager;

    const boxGeometries = [];
    this.indexMap = [];
    let totalInstances = 0;

    // For each asset type, create bounding boxes for all instances
    for (const [assetKey, data] of instanceManager.managedMeshes) {
      const group = instanceGroups.get(assetKey);
      if (!group) continue;

      const { instanceData } = data;

      // Get base bounding box (single object, not all instances)
      const baseBox = data.baseBoundingBox;
      if (!baseBox) {
        console.warn(`No base bounding box for ${assetKey}`);
        continue;
      }
      const baseSize = new Vector3();
      baseBox.getSize(baseSize);
      const baseCenter = new Vector3();
      baseBox.getCenter(baseCenter);

      // Create a box for each instance
      instanceData.forEach((instance) => {
        const matrix = instance.matrix;

        // Create base box geometry centered at origin
        const baseSize = new Vector3();
        baseBox.getSize(baseSize);
        const boxGeom = new BoxGeometry(baseSize.x, baseSize.y, baseSize.z);

        // Get the base box center offset
        const baseCenter = new Vector3();

        // First translate to account for base center offset
        boxGeom.translate(baseCenter.x, baseCenter.y, baseCenter.z);

        // Then apply instance transformation (translation, rotation, scale)
        boxGeom.applyMatrix4(matrix);

        boxGeometries.push(boxGeom);

        this.indexMap.push({
          assetKey: assetKey,
          instanceID: instance.id,
        });

        totalInstances++;
      });
    }

    if (boxGeometries.length === 0) {
      console.warn("SceneBVH: No instances to build BVH from");
      return;
    }

    // Merge all box geometries into one
    const mergedGeometry = this.mergeBoxGeometries(boxGeometries);

    // Build BVH
    mergedGeometry.computeBoundsTree();

    // Create proxy mesh for raycasting
    if (this.proxyMesh) {
      this.proxyMesh.geometry.disposeBoundsTree();
      this.proxyMesh.geometry.dispose();
    }

    this.proxyMesh = new Mesh(mergedGeometry);
    this.proxyMesh.visible = false; // Invisible, just for raycasting

    const buildTime = performance.now() - startTime;

    this.stats = {
      totalInstances,
      totalTriangles: mergedGeometry.index.count / 3,
      buildTime: buildTime.toFixed(2),
    };
  }

  /**
   * Query visible instances by casting random rays from the camera.
   * Accumulates instances across frames and prunes based on stale time.
   * Respects maxTriangles budget for the total accumulated collection.
   * @param {Camera} camera - The camera to cast rays from
   * @param {number} maxRays - Maximum number of rays to cast per frame
   */
  queryVisibleInstances(camera, maxRays = 100) {
    if (!this.proxyMesh) {
      console.warn("SceneBVH: BVH not built yet");
      return;
    }

    // Increment frame counter
    this.currentFrame++;

    // Buffer to cast rays slightly outside clip space (0.1 = 10% margin)
    const buffer = 0.1;

    const min = -1 - buffer;
    const max = 1 + buffer;
    const range = max - min;

    // Cast rays at random screen positions
    for (let i = 0; i < maxRays; i++) {
      // Random normalized coordinates with buffer
      const ndcX = Math.random() * range + min;
      const ndcY = Math.random() * range + min;

      this.raycaster.setFromCamera(new Vector2(ndcX, ndcY), camera);
      const intersects = this.raycaster.intersectObject(this.proxyMesh, false);

      // Process the first hit if there is one
      if (intersects.length > 0) {
        const hit = intersects[0];
        const faceIndex = hit.faceIndex;
        const indexAttr = this.proxyMesh.geometry.index;
        const vertexIndex = indexAttr.getX(faceIndex * 3);

        const boxIndexAttr = this.proxyMesh.geometry.attributes.boxIndex;
        const boxIndex = boxIndexAttr.getX(vertexIndex);
        const instanceInfo = this.indexMap[boxIndex];

        if (!instanceInfo) {
          console.warn(`SceneBVH: Invalid box index ${boxIndex}`);
          continue;
        }

        const { assetKey, instanceID } = instanceInfo;

        // Get or create asset map
        if (!this.visibleInstances.has(assetKey)) {
          this.visibleInstances.set(assetKey, new Map());
        }
        const assetMap = this.visibleInstances.get(assetKey);

        // Get triangle count for this asset type
        const triangleCount =
          this.instanceManager.managedMeshes.get(assetKey).triangleCount;

        // Check if this is a new instance
        const isNewInstance = !assetMap.has(instanceID);

        // Only add new instances if we haven't exceeded the budget
        if (isNewInstance) {
          if (this.currentTriangleCount + triangleCount > this.maxTriangles) {
            // Budget exceeded, skip this instance
            continue;
          }
          // Update running total for new instances
          this.currentTriangleCount += triangleCount;
        }

        // Update or add instance with current frame number
        assetMap.set(instanceID, {
          lastSeenFrame: this.currentFrame,
          triangleCount: triangleCount,
        });
      }
    }

    // Prune stale instances
    this.pruneStaleInstances();
  }

  /**
   * Prune instances that haven't been seen in staleFrameThreshold frames
   */
  pruneStaleInstances() {
    const staleFrame = this.currentFrame - this.staleFrameThreshold;

    for (const [assetKey, assetMap] of this.visibleInstances) {
      for (const [instanceID, data] of assetMap) {
        if (data.lastSeenFrame < staleFrame) {
          // Subtract from running total before removing
          this.currentTriangleCount -= data.triangleCount;
          assetMap.delete(instanceID);
        }
      }

      // Clean up empty asset maps
      if (assetMap.size === 0) {
        this.visibleInstances.delete(assetKey);
      }
    }
  }

  /**
   * Get the current accumulated visible instances
   * @returns {Map<string, Set<number>>} Map of assetKey -> Set of visible instanceIDs
   */
  getVisibleInstances() {
    const result = new Map();

    for (const [assetKey, assetMap] of this.visibleInstances) {
      const instanceIDs = new Set(assetMap.keys());
      if (instanceIDs.size > 0) {
        result.set(assetKey, instanceIDs);
      }
    }

    return result;
  }

  /**
   * Set the stale frame threshold (number of frames before pruning)
   * @param {number} threshold - Frame count threshold
   */
  setStaleFrameThreshold(threshold) {
    this.staleFrameThreshold = threshold;
  }

  /**
   * Set the maximum triangle budget for accumulated instances
   * @param {number} maxTriangles - Maximum triangles allowed
   */
  setMaxTriangles(maxTriangles) {
    this.maxTriangles = maxTriangles;
  }

  /**
   * Clear all accumulated visible instances
   */
  clearVisibleInstances() {
    this.visibleInstances.clear();
    this.currentFrame = 0;
    this.currentTriangleCount = 0;
  }

  /**
   * Merge scene object box geometries into a single consolidated geometry.
   * Returns the merged geometry with a custom vertex attribute for box indices,
   * which allow for looking up the object that should be instanced in that
   * position.
   */
  mergeBoxGeometries(boxGeometries) {
    if (boxGeometries.length === 0) {
      throw new Error("No geometries to merge");
    }

    const positions = [];
    const indices = [];
    const boxIndices = [];
    let vertexOffset = 0;

    for (let i = 0; i < boxGeometries.length; i++) {
      const geometry = boxGeometries[i];

      // Get position attribute
      const posAttr = geometry.attributes.position;
      const posArray = posAttr.array;

      // Add positions
      for (let j = 0; j < posArray.length; j++) {
        positions.push(posArray[j]);
      }

      // Add box index for each VERTEX (not face)
      for (let j = 0; j < posAttr.count; j++) {
        boxIndices.push(i);
      }

      // Get indices (or create them if non-indexed geometry)
      let indexArray;
      if (geometry.index) {
        indexArray = geometry.index.array;
      } else {
        // Create sequential indices
        indexArray = [];
        for (let j = 0; j < posAttr.count; j++) {
          indexArray.push(j);
        }
      }

      // Add indices with vertex offset
      for (let j = 0; j < indexArray.length; j++) {
        indices.push(indexArray[j] + vertexOffset);
      }

      vertexOffset += posAttr.count;
    }

    // Create merged geometry
    const mergedGeometry = new BufferGeometry();
    mergedGeometry.setAttribute(
      "position",
      new Float32BufferAttribute(positions, 3),
    );
    mergedGeometry.setIndex(indices);

    // Add custom attribute to store original box index per VERTEX
    mergedGeometry.setAttribute(
      "boxIndex",
      new Float32BufferAttribute(boxIndices, 1),
    );

    return mergedGeometry;
  }

  /**
   * Get statistics about the BVH
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * Dispose resources
   */
  dispose() {
    if (this.proxyMesh) {
      this.proxyMesh.geometry.disposeBoundsTree();
      this.proxyMesh.geometry.dispose();
      this.proxyMesh = null;
    }
    this.indexMap = [];
  }
}
