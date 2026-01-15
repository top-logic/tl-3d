/**
 * Data Models for ThreeJS Control
 * Contains all data model classes used in the 3D scene management like SharedObjects and its extensions
 */

import {
  C_P_RADIUS,
  GREEN,
  HEIGHT_SEGMENTS,
  RED,
  WIDTH_SEGMENTS,
} from "./Constants.js";

import {
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
} from "three";

import {
  applyColorToObject,
  toMatrix,
  toTX,
  transform,
} from "./ThreeJsUtils.js";

import { InstancedMeshManager } from "./InstancedMeshManager.js";

import { GLTFLoader } from "GLTFLoader";
import { InsertElement, RemoveElement, SetProperty } from "./Commands.js";

export class Scope {
  constructor() {
    this.objects = {};
    // cache for gltfs by url
    this.gltfs = {};
    // Instancing-related data structures
    this.instanceGroups = null;
    this.instanceManager = new InstancedMeshManager();
  }

  get assets() {
    return Object.values(this.objects).filter(
      (obj) => obj instanceof GltfAsset,
    );
  }

  /**
   * Analyze the scene graph to find duplicate assets that should be instanced
   * @returns {Map} Map of assetKey -> {asset, instances[]}
   */
  analyzeForInstancing() {
    const instanceGroups = new Map();

    const collectPartNodes = (node, parentTransform = new Matrix4()) => {
      if (!node) return;

      let worldTransform = parentTransform.clone();
      if (node.transform) {
        worldTransform.multiply(toMatrix(node.transform));
      }

      if (node instanceof PartNode) {
        const asset = node.asset;
        const assetKey =
          asset.url || (asset.dynamicImage ? asset.dynamicImage.imageID : null);

        if (!assetKey) return;

        if (!instanceGroups.has(assetKey)) {
          instanceGroups.set(assetKey, {
            asset: asset,
            instances: [],
          });
        }

        instanceGroups.get(assetKey).instances.push({
          partNode: node,
          worldTransform: worldTransform.clone(),
          color: node.color,
          hidden: node.hidden,
        });
      }

      if (node instanceof GroupNode && node.contents) {
        for (const child of node.contents) {
          collectPartNodes(child, worldTransform);
        }
      }
    };

    const sceneGraph = Object.values(this.objects).find(
      (obj) => obj instanceof SceneGraph,
    );

    if (sceneGraph && sceneGraph.root) {
      collectPartNodes(sceneGraph.root);
    }

    // Filter to only assets with 2+ instances
    const result = new Map();
    for (const [assetKey, group] of instanceGroups) {
      if (group.instances.length >= 2) {
        result.set(assetKey, group);
      }
    }

    // Mark all PartNodes that will be instanced
    for (const [_assetKey, group] of result) {
      for (const instance of group.instances) {
        instance.partNode.willBeInstanced = true;
      }
    }

    // Store the instance groups
    this.instanceGroups = result;

    return result;
  }

  /**
   * Create placeholder InstancedMesh objects before assets are loaded
   */
  createInstancedMeshes(ctrl) {
    if (!this.instanceGroups || this.instanceGroups.size === 0) {
      return;
    }

    for (const [assetKey, group] of this.instanceGroups) {
      const { asset, instances } = group;

      // Prepare instance data with IDs and matrices
      const instanceData = instances.map((instance, index) => ({
        id: index, // Use index as ID for now (could be partNode.id)
        matrix: instance.worldTransform,
        partNode: instance.partNode,
      }));

      // Create placeholder InstancedMesh using the manager
      const geometry = new BoxGeometry(500, 500, 500);
      const material = new MeshBasicMaterial({ wireframe: false });

      const instancedMesh = this.instanceManager.createInstancedMesh(
        assetKey,
        geometry,
        material,
        instances.length,
        instanceData,
      );

      // Mark userData for later identification
      instancedMesh.userData.isInstancedMesh = true;
      instancedMesh.userData.assetKey = assetKey;
      instancedMesh.userData.instances = instances.map((i) => i.partNode);

      // Add to scene
      ctrl.zUpRoot.add(instancedMesh);
    }
  }

  /**
   * Replace placeholder InstancedMesh objects with real GLTF geometry
   */
  updateInstancedMeshesWithGLTF(ctrl) {
    if (!this.instanceGroups || this.instanceGroups.size === 0) {
      return;
    }

    // Get list of all managed asset keys
    const assetKeys = Array.from(this.instanceGroups.keys());

    for (const assetKey of assetKeys) {
      const group = this.instanceGroups.get(assetKey);
      if (!group) {
        continue;
      }

      const asset = group.asset;

      // Determine GLTF URL
      let gltfUrl;
      if (asset.url) {
        gltfUrl = ctrl.contextPath + asset.url;
      } else if (asset.dynamicImage) {
        gltfUrl = ctrl.imageUrl + "/" + asset.dynamicImage.imageID;
      } else {
        continue;
      }

      const gltf = this.gltfs[gltfUrl];

      if (!gltf) {
        console.warn(`GLTF not loaded for ${assetKey}`);
        continue;
      }

      // Get the first mesh from the GLTF to use as template
      let templateMesh = null;
      gltf.scene.traverse((obj) => {
        if (obj.isMesh && !templateMesh) {
          templateMesh = obj;
        }
      });

      if (!templateMesh) {
        console.warn(`No mesh found in GLTF for ${assetKey}`);
        continue;
      }

      // Get the old placeholder mesh from the manager
      const oldMeshData = this.instanceManager.managedMeshes.get(assetKey);
      if (!oldMeshData) {
        console.warn(`No managed mesh data found for ${assetKey}`);
        continue;
      }

      const oldMesh = oldMeshData.instancedMesh;

      // Remove old placeholder from scene
      ctrl.zUpRoot.remove(oldMesh);

      // Dispose old placeholder resources
      oldMesh.geometry.dispose();
      oldMesh.material.dispose();

      // Prepare instance data with IDs and matrices
      const instanceData = group.instances.map((instance, index) => ({
        id: index,
        matrix: instance.worldTransform,
        partNode: instance.partNode,
      }));

      // Create new InstancedMesh with real geometry using the manager
      const newInstancedMesh = this.instanceManager.createInstancedMesh(
        assetKey,
        templateMesh.geometry,
        templateMesh.material.clone(),
        group.instances.length,
        instanceData,
      );

      // Copy over important userData
      newInstancedMesh.userData.isInstancedMesh = true;
      newInstancedMesh.userData.assetKey = assetKey;
      newInstancedMesh.userData.instances = group.instances.map(
        (i) => i.partNode,
      );

      // Add to scene
      ctrl.zUpRoot.add(newInstancedMesh);
    }
  }

  /**
   * Update which instances are visible for a specific asset
   * This will be called by the BVH/visibility system
   */
  updateVisibleInstances(assetKey, visibleInstanceIDs) {
    this.instanceManager.updateVisibleInstances(assetKey, visibleInstanceIDs);
  }

  /**
   * Update a specific instance's transform
   * This will be called when an instance is moved/rotated
   */
  updateInstanceTransform(assetKey, instanceID, newMatrix) {
    this.instanceManager.updateInstanceMatrix(assetKey, instanceID, newMatrix);
  }

  getNode(id) {
    return this.objects[id];
  }

  loadAll(json) {
    return json.flatMap((value) => this.loadJson(value));
  }

  loadJson(json) {
    if (json == null) {
      return null;
    }
    if (json instanceof Array) {
      const id = json[1];
      var obj;
      switch (json[0]) {
        case "SceneGraph":
          obj = new SceneGraph(id);
          break;
        case "GroupNode":
          obj = new GroupNode(id);
          break;
        case "PartNode":
          obj = new PartNode(id);
          break;
        case "GltfAsset":
          obj = new GltfAsset(id);
          break;
        case "ImageData":
          obj = new ImageData(id);
          break;
        case "ConnectionPoint":
          obj = new ConnectionPoint(id);
          break;
      }
      this.objects[id] = obj;
      obj.loadJson(this, json[2]);
      return obj;
    } else if (typeof json === "number") {
      // Is a reference.
      return this.objects[json];
    } else {
      throw new Error("Invalid graph specifier: " + json);
    }
  }

  loadAssets(ctrl) {
    const gltfLoader = new GLTFLoader();

    const loadUrl = (url) => {
      return gltfLoader.loadAsync(url).then(
        (gltf) => {
          // store gltf in the cache
          this.gltfs[url] = gltf;
        },
        (reason) => {
          const msg = "Failed to load '" + url + "': " + reason;
          console.error(msg);
        },
      );
    };

    const loadURLs = (urls, assetsByURL) => {
      return Promise.all(urls.map(loadUrl))
        .then(() => {
          for (const url of urls) {
            this.setGLTF(ctrl, url, assetsByURL);
          }
        })
        .then(() => {
          ctrl.invalidate();
        });
    };

    // load assets in batches to prevent overwhelming the browser
    const assetsByURL = Map.groupBy(this.assets, (asset) => {
      if (asset.dynamicImage) {
        return ctrl.imageUrl + "/" + asset.dynamicImage.imageID;
      } else if (asset.url) {
        return ctrl.contextPath + asset.url;
      } else {
        return null;
      }
    });

    // No need to load "null" URL.
    assetsByURL.delete(null);
    const batchSize = 10;
    const batches = [];
    let urls = [];

    for (const key of assetsByURL.keys()) {
      if (urls.length === batchSize) {
        batches.push(urls);
        urls = [];
      }
      if (this.setGLTF(ctrl, key, assetsByURL)) {
        // URL already successfully loaded.
        continue;
      }
      urls.push(key);
    }

    if (urls.length > 0) {
      batches.push(urls);
    }

    // Load batches sequentially
    return batches.reduce((promise, batch) => {
      return promise.then(() => loadURLs(batch, assetsByURL));
    }, Promise.resolve());
  }

  setGLTF(ctrl, url, assetsByURL) {
    const gltf = this.gltfs[url];
    if (gltf != null) {
      for (const asset of assetsByURL.get(url)) {
        asset.setGLTF(gltf, ctrl);
      }
      return true;
    } else {
      return false;
    }
  }
}

export class SharedObject {
  constructor(id) {
    this.id = id;
  }

  notifyTransform(diffMatrix) {
    const currentTransformation = toMatrix(this.transform);
    const newTransformation = currentTransformation.multiply(diffMatrix);
    this.transform = toTX(newTransformation);
    return SetProperty.prototype.create(this.id, "transform", this.transform);
  }

  setProperty(scope, property, value) {
    switch (property) {
      case "parent":
        this.parent = scope.loadJson(value);
        break;
      default:
        break;
    }
  }
}

export class SceneGraph extends SharedObject {
  constructor(id) {
    super(id);
  }

  buildGraph(ctrl) {
    this.ctrl = ctrl;

    this.build(ctrl.zUpRoot);
    this.ctrl.applySelection(this.selection);
    this.ctrl.updateTransformControls();
  }

  build(zUpRoot) {
    this.root.build(zUpRoot);
  }

  loadJson(scope, json) {
    this.setProperty(scope, "root", json.root);
    this.setProperty(scope, "selection", json.selection);
    this.setProperty(scope, "coordinateSystem", json.coordinateSystem);
    this.setProperty(scope, "translateStepSize", json.translateStepSize);
    this.setProperty(scope, "rotateStepSize", json.rotateStepSize);
    this.setProperty(scope, "numberOfFloors", json.numberOfFloors);
  }

  removeSelected(node) {
    var idx = this.selection.indexOf(node);
    if (idx < 0) {
      return null;
    }
    this.selection.splice(idx, 1);
    return RemoveElement.prototype.create(this.id, "selection", idx);
  }

  addSelected(node) {
    var idx = this.selection.indexOf(node);
    if (idx >= 0) {
      return null;
    }

    this.selection.push(node);
    return InsertElement.prototype.create(
      this.id,
      "selection",
      this.selection.length - 1,
      node.id,
    );
  }

  clearSelection() {
    if (this.selection.length == 0) {
      return null;
    }
    this.selection.length = 0;
    return SetProperty.prototype.create(this.id, "selection", []);
  }

  setProperty(scope, property, value) {
    switch (property) {
      case "root": {
        if (this.root != null) {
          this.root.parent = null;
        }
        this.root = scope.loadJson(value);
        if (this.root != null) {
          this.root.parent = this;
        }
        break;
      }
      case "selection":
        this.selection = scope.loadAll(value);
        break;
      case "coordinateSystem":
        this.coordinateSystem = value;
        break;
      case "translateStepSize":
        this.translateStepSize = value;
        break;
      case "rotateStepSize":
        this.rotateStepSize = value;
        break;
      case "numberOfFloors":
        this.numberOfFloors = value;
        break;
      default:
        super.setProperty(scope, property, value);
        break;
    }
  }

  insertElementAt(scope, property, idx, value) {
    switch (property) {
      case "selection":
        const sharedObject = scope.loadJson(value);
        this.selection.splice(idx, 0, sharedObject);
        break;
      case "coordinateSystem":
        this.coordinateSystem.splice(idx, 0, value);
        break;
    }
  }

  removeElementAt(scope, property, idx) {
    switch (property) {
      case "selection":
        this.selection.splice(idx, 1);
        break;
      case "coordinateSystem":
        this.coordinateSystem.splice(idx, 1);
        break;
    }
  }

  reload(scope) {
    this.ctrl.zUpRoot.clear();
    this.ctrl.multiTransformGroup.clear();

    // Re-analyze for instancing
    scope.analyzeForInstancing();

    this.build(this.ctrl.zUpRoot);

    // Recreate instanced meshes
    scope.createInstancedMeshes(this.ctrl);

    scope.loadAssets(this.ctrl).then(() => {
      // Update instanced meshes with real geometry
      scope.updateInstancedMeshesWithGLTF(this.ctrl);

      this.ctrl.applySelection(this.selection);
      this.ctrl.updateTransformControls();
      this.ctrl.invalidate();
    });

    this.ctrl.toggleWorkplane(this.ctrl.isWorkplaneVisible);
  }
}

export class ImageData extends SharedObject {
  constructor(id) {
    super(id);
  }

  loadJson(scope, json) {
    this.setProperty(scope, "imageID", json.imageID);
  }

  setProperty(scope, property, value) {
    switch (property) {
      case "imageID":
        this.imageID = value;
        break;
      default:
        super.setProperty(scope, property, value);
        break;
    }
  }

  insertElementAt(scope, property, idx, value) {
    switch (property) {
    }
  }

  removeElementAt(scope, property, idx) {
    switch (property) {
    }
  }
}

export class ConnectionPoint extends SharedObject {
  constructor(id) {
    super(id);
  }

  loadJson(scope, json) {
    this.setProperty(scope, "transform", json.transform);
    this.setProperty(scope, "classifiers", json.classifiers);
  }

  build(parentGroup, layoutPoint) {
    const group = new Group();
    parentGroup.add(group);

    transform(group, this.transform);

    this.pointMaterial = new MeshBasicMaterial({
      color: layoutPoint ? RED : GREEN,
    });
    this.pointGeometry = new SphereGeometry(
      C_P_RADIUS,
      WIDTH_SEGMENTS,
      HEIGHT_SEGMENTS,
    );
    this.pointMaterial.userData.originalColor =
      this.pointMaterial.color.clone();

    const sphere = new Mesh(this.pointGeometry, this.pointMaterial);

    if (layoutPoint) {
      // mark this as a layout point sphere
      sphere.userData.isLayoutPoint = true;
    } else {
      // mark this as a connection point sphere
      sphere.userData.isConnectionPoint = true;
    }
    sphere.visible = false;

    group.add(sphere);

    this.node = group;
    return group;
  }

  setProperty(scope, property, value) {
    switch (property) {
      case "transform":
        this.transform = value;
        break;
      case "classifiers":
        this.classifiers = value;
        break;
      default:
        super.setProperty(scope, property, value);
        break;
    }
  }

  insertElementAt(scope, property, idx, value) {
    switch (property) {
      case "transform":
        this.transform.splice(idx, 0, value);
        break;
      case "classifiers":
        this.classifiers.splice(idx, 0, value);
        break;
    }
  }

  removeElementAt(scope, property, idx) {
    switch (property) {
      case "transform":
        this.transform.splice(idx, 1);
        break;
      case "classifiers":
        this.classifiers.splice(idx, 1);
        break;
    }
  }
}

export class GroupNode extends SharedObject {
  constructor(id) {
    super(id);
  }

  build(parentGroup, parentContext) {
    if (this.hidden) {
      return;
    }

    const group = new Group();
    parentGroup.add(group);

    const context = {
      color: this.color || parentContext?.color,
    };

    transform(group, this.transform);
    this.contents.forEach((c) => c.build(group, context));

    // Apply color to this group node
    if (this.color) {
      applyColorToObject(group, this.color);
    }

    // Link to scene node
    group.userData = {
      ...group.userData,
      nodeRef: this,
      color: this.color || null,
    };

    // Set initial visibility
    group.visible = !this.hidden;

    this.node = group;
  }

  loadJson(scope, json) {
    this.setProperty(scope, "contents", json.contents);
    this.setProperty(scope, "transform", json.transform);
    this.setProperty(scope, "hidden", json.hidden);
    this.setProperty(scope, "selectable", json.selectable);
    this.setProperty(scope, "color", json.color);
  }

  setProperty(scope, property, value) {
    switch (property) {
      case "contents": {
        if (this.contents) {
          this.contents.forEach((c) => (c.parent = null));
        }
        this.contents = scope.loadAll(value);
        this.contents.forEach((c) => (c.parent = this));
        break;
      }
      case "transform":
        this.transform = value;
        break;
      case "color":
        this.color = value;
        if (this.node && value) {
          applyColorToObject(this.node, value);
        }
        break;
      case "hidden":
        this.hidden = value;
        if (this.node) {
          this.node.visible = !value;
        }
        break;
      case "selectable":
        this.selectable = value;
        break;
      default:
        super.setProperty(scope, property, value);
        break;
    }
  }

  insertElementAt(scope, property, idx, value) {
    switch (property) {
      case "contents": {
        const newContent = scope.loadJson(value);
        newContent.parent = this;
        this.contents.splice(idx, 0, newContent);
        break;
      }
      case "transform":
        this.transform.splice(idx, 0, value);
        break;
    }
  }

  removeElementAt(scope, property, idx) {
    switch (property) {
      case "contents": {
        this.contents[idx].parent = null;
        this.contents.splice(idx, 1);
        break;
      }
      case "transform":
        this.transform.splice(idx, 1);
        break;
    }
  }
}

export class PartNode extends SharedObject {
  constructor(id) {
    super(id);
  }

  build(parentGroup, parentContext) {
    if (this.hidden) {
      return;
    }

    // Skip building if this node will be instanced
    if (this.willBeInstanced) {
      return;
    }

    const group = new Group();
    parentGroup.add(group);

    transform(group, this.transform);

    const node = this.asset.build(group);
    group.add(node);

    const color = this.color || parentContext?.color;
    if (color) {
      applyColorToObject(group, color);
    }

    // Link to scene node.
    group.userData = {
      ...group.userData,
      nodeRef: this,
      color: this.color || null,
    };

    // Set initial visibility
    group.visible = !this.hidden;

    this.node = group;
  }

  loadJson(scope, json) {
    this.setProperty(scope, "asset", json.asset);
    this.setProperty(scope, "transform", json.transform);
    this.setProperty(scope, "hidden", json.hidden);
    this.setProperty(scope, "selectable", json.selectable);
    this.setProperty(scope, "color", json.color);
  }

  setProperty(scope, property, value) {
    switch (property) {
      case "asset":
        this.asset = scope.loadJson(value);
        break;
      case "transform":
        this.transform = value;
        break;
      case "color":
        this.color = value;
        // Update 3D object color
        if (this.node && value) {
          applyColorToObject(this.node, value);
        }
        break;
      case "hidden": {
        this.hidden = value;
        // Update 3D object visibility
        if (this.node) {
          this.node.visible = !value;
        }
        break;
      }
      case "selectable":
        this.selectable = value;
        break;
      default:
        super.setProperty(scope, property, value);
        break;
    }
  }

  insertElementAt(scope, property, idx, value) {
    switch (property) {
      case "transform":
        this.transform.splice(idx, 0, value);
        break;
    }
  }

  removeElementAt(scope, property, idx) {
    switch (property) {
      case "transform":
        this.transform.splice(idx, 1);
        break;
    }
  }
}

export class GltfAsset extends SharedObject {
  constructor(id) {
    super(id);
  }

  build(parentGroup) {
    this.group = new Group();
    parentGroup.add(this.group);

    this.layoutPoint?.build(this.group, true);
    if (this.layoutPoint?.transform) {
      this.group.applyMatrix4(toMatrix(this.layoutPoint.transform).invert());
    }
    this.snappingPoints?.forEach((point) => point.build(this.group, false));

    if (this.url || this.dynamicImage) {
      const geometry = new BoxGeometry(500, 500, 500);
      const material = new MeshBasicMaterial({ wireframe: false });
      const mesh = new Mesh(geometry, material);
      mesh.userData.originalMaterial = mesh.material;
      mesh.material = mesh.material.clone();
      mesh.material.userData.originalColor = mesh.material.color.clone();

      this.placeholder = mesh;
      this.group.add(this.placeholder);
    }

    return this.group;
  }

  setGLTF(newGLTF, ctrl) {
    if (!newGLTF) {
      return;
    }

    this.gltf = newGLTF;

    // Ensure group is initialized before trying to use it
    if (!this.group) {
      return;
    }

    this.group.remove(this.placeholder);

    const model = this.gltf.scene.clone();
    model.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.userData.originalMaterial = obj.material;
        obj.material = obj.material.clone();
        obj.material.userData.originalColor = obj.material.color.clone();
      }
    });
    this.group.add(model);

    const currentColor = this.placeholder.material.color;
    ctrl.setColor(this.group, currentColor);
  }

  loadJson(scope, json) {
    this.setProperty(scope, "url", json.url);
    this.setProperty(scope, "dynamicImage", json.dynamicImage);
    this.setProperty(scope, "layoutPoint", json.layoutPoint);
    this.setProperty(scope, "snappingPoints", json.snappingPoints);
  }

  setProperty(scope, property, value) {
    switch (property) {
      case "url":
        this.url = value;
        break;
      case "dynamicImage":
        this.dynamicImage = scope.loadJson(value);
        break;
      case "layoutPoint":
        this.layoutPoint = scope.loadJson(value);
        break;
      case "snappingPoints":
        this.snappingPoints = scope.loadAll(value);
        break;
      default:
        super.setProperty(scope, property, value);
        break;
    }
  }
  insertElementAt(scope, property, idx, value) {
    switch (property) {
      case "snappingPoints":
        this.snappingPoints.splice(idx, 0, scope.loadJson(value));
        break;
    }
  }

  removeElementAt(scope, property, idx) {
    switch (property) {
      case "snappingPoints":
        this.snappingPoints.splice(idx, 1);
        break;
    }
  }
}
