/**
 * SceneOctree
 *
 * Spatial indexing for instanced 3D objects using an octree structure.
 * Optimised for frustum culling of instances with proper bounding box storage.
 *
 * Usage:
 *   const octree = SceneOctree.fromInstanceManager(
 *     instanceManager,
 *     instanceGroups,
 *     sceneBoundingBox,
 *     coordinateTransform
 *   );
 *
 *   // Each frame:
 *   const frustum = new Frustum();
 *   frustum.setFromProjectionMatrix(...);
 *   const visible = octree.queryFrustum(frustum);
 *   // visible is array of {type, assetKey, instanceID, boundingBox}
 */

import { Box3, Box3Helper, Frustum, Group, Vector3 } from "three";

export class SceneOctree {
  constructor(boundingBox, maxDepth = 8, maxObjectsPerNode = 16) {
    this.boundingBox = boundingBox; // Box3
    this.maxDepth = maxDepth;
    this.maxObjectsPerNode = maxObjectsPerNode;
    this.root = new OctreeNode(boundingBox, 0, this);

    // Statistics
    this.stats = {
      totalObjects: 0,
      totalInstances: 0,
      leafNodes: 0,
      maxDepthReached: 0,
    };
  }

  /**
   * Insert an object into the octree.
   * @param {Object} object - The object to insert
   *   For instances: {type: 'instance', assetKey, instanceID, boundingBox, partNode}
   */
  insert(object) {
    const inserted = this.root.insert(object);
    if (inserted) {
      this.stats.totalObjects++;
      if (object.type === "instance") {
        this.stats.totalInstances++;
      }
    }
    return inserted;
  }

  /**
   * Remove an object from the octree.
   * @param {Object} object - The object to remove
   */
  remove(object) {
    const removed = this.root.remove(object);
    if (removed) {
      this.stats.totalObjects--;
      if (object.type === "instance") {
        this.stats.totalInstances--;
      }
    }
    return removed;
  }

  /**
   * Clear all objects from the octree.
   */
  clear() {
    this.root = new OctreeNode(this.boundingBox, 0, this);
    this.stats.totalObjects = 0;
    this.stats.totalInstances = 0;
    this.stats.leafNodes = 0;
    this.stats.maxDepthReached = 0;
  }

  /**
   * Query objects within camera frustum.
   * @param {Frustum} frustum - Camera frustum
   * @returns {Array} Array of objects within frustum
   */
  queryFrustum(frustum) {
    const results = new Set();
    this.root.queryFrustum(frustum, results);
    return Array.from(results);
  }

  /**
   * Query objects intersected by a ray.
   * @param {Ray} ray - Ray to test
   * @returns {Array} Array of candidate objects the ray might intersect
   */
  queryRay(ray) {
    const results = new Set();
    this.root.queryRay(ray, results);
    return Array.from(results);
  }

  /**
   * Query objects within distance from point.
   * @param {Vector3} point - Centre point
   * @param {number} radius - Search radius
   * @returns {Array} Array of objects within radius
   */
  queryRadius(point, radius) {
    const results = new Set();
    this.root.queryRadius(point, radius, results);
    return Array.from(results);
  }

  /**
   * Query objects within a bounding box.
   * @param {Box3} box - Bounding box to query
   * @returns {Array} Array of objects within box
   */
  queryBox(box) {
    const results = new Set();
    this.root.queryBox(box, results);
    return Array.from(results);
  }

  /**
   * Get all leaf nodes (for debugging or analysis).
   * @returns {Array} Array of leaf nodes
   */
  getLeafNodes() {
    const leaves = [];
    this.root.collectLeaves(leaves);
    this.stats.leafNodes = leaves.length;
    return leaves;
  }

  /**
   * Update statistics about the octree.
   */
  updateStats() {
    this.stats.leafNodes = this.getLeafNodes().length;
    this.stats.maxDepthReached = this.root.getMaxDepth();
  }

  /**
   * Get octree statistics.
   * @returns {Object} Statistics object
   */
  getStats() {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Create debug visualisation of octree structure.
   * @param {Scene} scene - Three.js scene to add visualisation to
   * @returns {Group} Debug helper group
   */
  createDebugVisualisation(scene) {
    // Remove existing debug helper
    const existing = scene.getObjectByName("OctreeDebugHelper");
    if (existing) {
      scene.remove(existing);
    }

    const helper = new Group();
    helper.name = "OctreeDebugHelper";

    this.root.addDebugLines(helper);
    scene.add(helper);

    return helper;
  }

  /**
   * Build octree from instanced meshes.
   * @param {InstancedMeshManager} instanceManager - The instance manager
   * @param {Map} instanceGroups - Map of assetKey -> {asset, instances[]}
   * @param {Box3} sceneBoundingBox - Overall scene bounds (optional, will compute if not provided)
   * @param {Matrix4} coordinateTransform - Optional transform to apply to all bounding boxes (e.g., zUpRoot rotation)
   * @returns {SceneOctree} Constructed octree
   */
  static fromInstanceManager(
    instanceManager,
    instanceGroups,
    sceneBoundingBox = null,
    coordinateTransform = null,
  ) {
    // Calculate bounding box if not provided
    let bbox = sceneBoundingBox;
    let totalInstances = 0;

    if (!bbox) {
      bbox = new Box3();

      for (const [assetKey, data] of instanceManager.managedMeshes) {
        const group = instanceGroups.get(assetKey);
        if (!group) continue;

        const baseBox = data.baseBoundingBox;
        if (!baseBox) {
          console.warn(`No base bounding box for ${assetKey}`);
          continue;
        }

        // Expand bbox by all instance bounding boxes
        for (const instance of data.instanceData) {
          const instanceBox = baseBox.clone();
          instanceBox.applyMatrix4(instance.matrix);

          // Apply coordinate transform if provided
          if (coordinateTransform) {
            instanceBox.applyMatrix4(coordinateTransform);
          }

          bbox.union(instanceBox);
          totalInstances++;
        }
      }

      if (totalInstances === 0) {
        console.warn("SceneOctree: No instances found in scene");
        // Return octree with default bounds
        return new SceneOctree(
          new Box3(
            new Vector3(-10000, -10000, -10000),
            new Vector3(10000, 10000, 10000),
          ),
        );
      }

      // Add some padding
      const size = bbox.getSize(new Vector3());
      const padding = size.length() * 0.1;
      bbox.expandByScalar(padding);
    }

    console.log(`SceneOctree: Building octree for ${totalInstances} instances`);
    console.log(`SceneOctree: Bounds:`, bbox.min, bbox.max);

    const octree = new SceneOctree(bbox);

    // Insert all instances
    for (const [assetKey, data] of instanceManager.managedMeshes) {
      const group = instanceGroups.get(assetKey);
      if (!group) continue;

      const baseBox = data.baseBoundingBox;
      if (!baseBox) {
        console.warn(`No base bounding box for ${assetKey}`);
        continue;
      }

      for (const instance of data.instanceData) {
        // Transform base bounding box by instance matrix
        const instanceBox = baseBox.clone();
        instanceBox.applyMatrix4(instance.matrix);

        // Apply coordinate transform if provided
        if (coordinateTransform) {
          instanceBox.applyMatrix4(coordinateTransform);
        }

        // Store reference with all needed info
        octree.insert({
          type: "instance",
          assetKey: assetKey,
          instanceID: instance.id,
          boundingBox: instanceBox,
          partNode: instance.partNode, // Reference back to data model if needed
        });
      }
    }

    octree.updateStats();
    console.log(`SceneOctree: Built successfully`, octree.getStats());

    return octree;
  }
}

class OctreeNode {
  constructor(boundingBox, depth, octree) {
    this.boundingBox = boundingBox; // Box3
    this.depth = depth;
    this.octree = octree;
    this.objects = []; // Objects in this node: {object, boundingBox}
    this.children = null; // Array of 8 child nodes (if subdivided)
    this.isLeaf = true;
  }

  /**
   * Insert an object with its bounding box.
   * @param {Object} object - The object data (must contain boundingBox property)
   */
  insert(object) {
    const boundingBox = object.boundingBox;

    // Check if bounding box intersects this node
    if (!this.boundingBox.intersectsBox(boundingBox)) {
      return false;
    }

    // If leaf and under capacity, add here
    if (this.isLeaf) {
      this.objects.push({ object, boundingBox });

      // Check if we need to subdivide
      if (
        this.objects.length > this.octree.maxObjectsPerNode &&
        this.depth < this.octree.maxDepth
      ) {
        this.subdivide();
      }

      return true;
    }

    // Otherwise, insert into appropriate child(ren)
    // An object can be in multiple children if it spans boundaries
    let inserted = false;
    for (const child of this.children) {
      if (child.insert(object)) {
        inserted = true;
      }
    }

    return inserted;
  }

  remove(object) {
    if (this.isLeaf) {
      const index = this.objects.findIndex((item) => item.object === object);
      if (index > -1) {
        this.objects.splice(index, 1);
        return true;
      }
      return false;
    } else {
      let removed = false;
      for (const child of this.children) {
        if (child.remove(object)) {
          removed = true;
        }
      }
      return removed;
    }
  }

  subdivide() {
    const center = this.boundingBox.getCenter(new Vector3());
    const min = this.boundingBox.min;
    const max = this.boundingBox.max;

    this.children = [];

    // Create 8 octants
    for (let x = 0; x < 2; x++) {
      for (let y = 0; y < 2; y++) {
        for (let z = 0; z < 2; z++) {
          const childMin = new Vector3(
            x === 0 ? min.x : center.x,
            y === 0 ? min.y : center.y,
            z === 0 ? min.z : center.z,
          );

          const childMax = new Vector3(
            x === 0 ? center.x : max.x,
            y === 0 ? center.y : max.y,
            z === 0 ? center.z : max.z,
          );

          const childBox = new Box3(childMin, childMax);
          const childNode = new OctreeNode(
            childBox,
            this.depth + 1,
            this.octree,
          );
          this.children.push(childNode);
        }
      }
    }

    // Redistribute objects to children
    // Note: objects can end up in multiple children if they span boundaries
    for (const { object, boundingBox } of this.objects) {
      let inserted = false;
      for (const child of this.children) {
        if (child.insert(object)) {
          inserted = true;
        }
      }

      if (!inserted) {
        console.warn(
          "SceneOctree: Failed to insert object during subdivision",
          object,
        );
      }
    }

    // Clear objects from this node
    this.objects = [];
    this.isLeaf = false;
  }

  queryFrustum(frustum, results) {
    // Check if frustum intersects this node's bounding box
    if (!frustum.intersectsBox(this.boundingBox)) {
      return;
    }

    if (this.isLeaf) {
      // Test each object's bounding box against frustum
      for (const { object, boundingBox } of this.objects) {
        if (frustum.intersectsBox(boundingBox)) {
          results.add(object);
        }
      }
    } else {
      // Recurse into children
      for (const child of this.children) {
        child.queryFrustum(frustum, results);
      }
    }
  }

  queryRay(ray, results) {
    // Test ray against this node's bounding box
    if (!ray.intersectsBox(this.boundingBox)) {
      return;
    }

    if (this.isLeaf) {
      // Test each object's bounding box against ray
      for (const { object, boundingBox } of this.objects) {
        if (ray.intersectsBox(boundingBox)) {
          results.add(object);
        }
      }
    } else {
      // Recurse into children
      for (const child of this.children) {
        child.queryRay(ray, results);
      }
    }
  }

  queryRadius(point, radius, results) {
    // Quick rejection test
    const distance = this.boundingBox.distanceToPoint(point);
    if (distance > radius) {
      return;
    }

    if (this.isLeaf) {
      // Check each object's bounding box
      for (const { object, boundingBox } of this.objects) {
        if (boundingBox.distanceToPoint(point) <= radius) {
          results.add(object);
        }
      }
    } else {
      // Recurse into children
      for (const child of this.children) {
        child.queryRadius(point, radius, results);
      }
    }
  }

  queryBox(box, results) {
    // Check if boxes intersect
    if (!this.boundingBox.intersectsBox(box)) {
      return;
    }

    if (this.isLeaf) {
      // Check each object's bounding box
      for (const { object, boundingBox } of this.objects) {
        if (box.intersectsBox(boundingBox)) {
          results.add(object);
        }
      }
    } else {
      // Recurse into children
      for (const child of this.children) {
        child.queryBox(box, results);
      }
    }
  }

  collectLeaves(results) {
    if (this.isLeaf) {
      results.push(this);
    } else {
      for (const child of this.children) {
        child.collectLeaves(results);
      }
    }
  }

  getMaxDepth() {
    if (this.isLeaf) {
      return this.depth;
    }

    let maxDepth = this.depth;
    for (const child of this.children) {
      maxDepth = Math.max(maxDepth, child.getMaxDepth());
    }
    return maxDepth;
  }

  addDebugLines(group) {
    // Colour code by depth
    const colors = [
      0xff0000, // Red - depth 0
      0xff7700, // Orange - depth 1
      0xffff00, // Yellow - depth 2
      0x00ff00, // Green - depth 3
      0x00ffff, // Cyan - depth 4
      0x0000ff, // Blue - depth 5
      0xff00ff, // Magenta - depth 6
      0x888888, // Grey - depth 7+
    ];

    const color = colors[Math.min(this.depth, colors.length - 1)];
    const box = new Box3Helper(this.boundingBox, color);
    box.userData.octreeDepth = this.depth;
    box.userData.objectCount = this.objects.length;
    group.add(box);

    // Recurse to children
    if (!this.isLeaf) {
      for (const child of this.children) {
        child.addDebugLines(group);
      }
    }
  }
}
