/**
 * Data Models for ThreeJS Control
 * Contains all data model classes used in the 3D scene management like SharedObjects and its extensions
 */

import {
  LOD_HIGH, 
  LOD_MEDIUM, 
  LOD_LOW, 
  LOD_MEDIUM_DISTANCE, 
  LOD_LOW_DISTANCE, 
  C_P_RADIUS, 
  WIDTH_SEGMENTS, 
  HEIGHT_SEGMENTS, 
  RED, 
  GREEN
} from './Constants.js';

import { 
  LOD,
  Group, 
  SphereBufferGeometry, 
  MeshBasicMaterial, 
  Mesh, 
  BoxGeometry 
} from "three";

import { 
  toMatrix, 
  toTX, 
  transform, 
  applyColorToObject,
} from './ThreeJsUtils.js';

import { InsertElement, RemoveElement, SetProperty } from './Commands.js';
import { GLTFLoader } from "GLTFLoader";

export class Scope {
  constructor() {
    this.objects = {};
    // cache for gltfs by url
    this.gltfs = {};
  }

  get assets() {
    return Object.values(this.objects).filter((obj) => obj instanceof GltfAsset);
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
        case 'SceneGraph': obj = new SceneGraph(id); break;
        case 'GroupNode': obj = new GroupNode(id); break;
        case 'PartNode': obj = new PartNode(id); break;
        case 'GltfAsset': obj = new GltfAsset(id); break;
        case 'ImageData': obj = new ImageData(id); break;
        case 'ConnectionPoint': obj = new ConnectionPoint(id); break;
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

  async loadAssets(ctrl) {
    const gltfLoader = new GLTFLoader();
    
    // track loading progress
    let totalAssets = 0;
    let loadedAssets = 0;

    const loadUrl = (url) =>
      new Promise((resolve, reject) => {
        if (url == null) {
            resolve(null);
            return;
        }
        try {
          totalAssets++;
          
          // if gltf for the given url exists in the cache let's return it
          if (this.gltfs[url]) {
            loadedAssets++;

            resolve(this.gltfs[url]);
            return;
          }

          gltfLoader.load(url, (gltf) => {
              loadedAssets++;
              // store gltf in the cache
              this.gltfs[url] = gltf;
              resolve(gltf);
          }, null, function (error) {
            const msg = "Failed to load '" + url + "'.";
            console.error(msg);
            resolve(null);
           });
        } catch (err) {
          const msg = "Failed to load '" + url + "': " + err;
          console.log(msg);
          reject(msg);
        }
      });
    const loadURLs = async (urls, assetsByURL) => {

      await Promise.all(urls.map(loadUrl));
      for (const url of urls) {
        const gltf = this.gltfs[url];
        if (gltf != null) {
          for (const asset of assetsByURL.get(url)) {
            asset.setGLTF(gltf, ctrl);
          }
        }
      }
      ctrl.render();
    };

    // load assets in batches to prevent overwhelming the browser
    const assetsByURL = Map.groupBy(this.assets, asset => {
      if (asset.dynamicImage) {
        return ctrl.imageUrl + "/" + asset.dynamicImage.imageID;
      } else if (asset.url) {
        return ctrl.contextPath + asset.url;
      } else {
        return null;
      }
    });
    const batchSize = 10;

    var urls = new Array(batchSize);
    var index = 0;
    for (const key of assetsByURL.keys()) {
      if (index == batchSize) {
        index = 0;
        await loadURLs(urls, assetsByURL);
        urls = new Array(batchSize);
      }
      urls[index] = key;
      index++;
    }
    if (index > 0) {
      await loadURLs(urls.slice(0, index), assetsByURL);
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
    return SetProperty.prototype.create(this.id, 'transform', this.transform);
  }
  
  setProperty(scope, property, value) {
    switch (property) {
      case 'parent': 
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
    this.setProperty(scope, 'root', json.root);
    this.setProperty(scope, 'selection', json.selection);
    this.setProperty(scope, 'coordinateSystem', json.coordinateSystem);
    this.setProperty(scope, 'translateStepSize', json.translateStepSize);
    this.setProperty(scope, 'rotateStepSize', json.rotateStepSize);
    this.setProperty(scope, 'numberOfFloors', json.numberOfFloors);
  }
  
  removeSelected(node) {
    var idx = this.selection.indexOf(node);
    if (idx < 0) {
      return null;
    }
    this.selection.splice(idx, 1);
    return RemoveElement.prototype.create(this.id, 'selection', idx);
  }
  
  addSelected(node) {
    var idx = this.selection.indexOf(node);
    if (idx >= 0) {
      return null;
    }
    
    this.selection.push(node);
  return InsertElement.prototype.create(this.id, 'selection', this.selection.length - 1, node.id);
  }
  
  clearSelection() {
    if (this.selection.length == 0) {
      return null;
    }
    this.selection.length = 0;
    return SetProperty.prototype.create(this.id, 'selection', []);
  } 

  setProperty(scope, property, value) {
    switch (property) {
      case 'root': {
        if (this.root != null) {
          this.root.parent = null;
        }
        this.root = scope.loadJson(value); 
        if (this.root != null) {
          this.root.parent = this;
        }
        break;
      }
      case 'selection': 
        this.selection = scope.loadAll(value);
        break; 
      case 'coordinateSystem': 
        this.coordinateSystem = value;
        break; 
      case 'translateStepSize': 
        this.translateStepSize = value;
        break; 
      case 'rotateStepSize': 
        this.rotateStepSize = value;
        break; 
      case 'numberOfFloors':
        this.numberOfFloors = value;
        break;
      default:
        super.setProperty(scope, property, value);
        break;
    }
  }
  
  insertElementAt(scope, property, idx, value) {
    switch (property) {
      case 'selection': 
        const sharedObject = scope.loadJson(value);
        this.selection.splice(idx, 0, sharedObject); 
        break; 
      case 'coordinateSystem': 
        this.coordinateSystem.splice(idx, 0, value); 
        break; 
    }
  }
  
  removeElementAt(scope, property, idx) {
    switch (property) {
      case 'selection': 
        this.selection.splice(idx, 1);
        break; 
      case 'coordinateSystem': 
        this.coordinateSystem.splice(idx, 1);
        break; 
    }
  }

  reload(scope) {
    this.ctrl.zUpRoot.clear();
    this.ctrl.multiTransformGroup.clear();
    this.build(this.ctrl.zUpRoot);

    scope.loadAssets(this.ctrl).then(() => {
      this.ctrl.applySelection(this.selection);
      this.ctrl.updateTransformControls();
      this.ctrl.render();
    });
    
    this.ctrl.toggleWorkplane(this.ctrl.isWorkplaneVisible);
  }
}

export class ImageData extends SharedObject {
  constructor(id) {
    super(id);
  }

  loadJson(scope, json) {
    this.setProperty(scope, 'imageID', json.imageID);
  }
  
  setProperty(scope, property, value) {
    switch (property) {
      case 'imageID': this.imageID = value; break;
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
    this.setProperty(scope, 'transform', json.transform);
    this.setProperty(scope, 'classifiers', json.classifiers);
  }
  
  build(parentGroup, layoutPoint) {
    const group = new Group();
    parentGroup.add(group);

    transform(group, this.transform);

    this.pointMaterial = new MeshBasicMaterial({ color: layoutPoint ? RED : GREEN });
    this.pointGeometry = new SphereBufferGeometry(C_P_RADIUS, WIDTH_SEGMENTS, HEIGHT_SEGMENTS);
    this.pointMaterial.userData.originalColor = this.pointMaterial.color.clone();
    
    const sphere = new Mesh(
      this.pointGeometry, 
      this.pointMaterial
    );
    
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
      case 'transform': this.transform = value; break;
      case 'classifiers': this.classifiers = value; break;
      default:
        super.setProperty(scope, property, value);
        break;
    }
  }
  
  insertElementAt(scope, property, idx, value) {
    switch (property) {
      case 'transform': this.transform.splice(idx, 0, value); break;
      case 'classifiers': this.classifiers.splice(idx, 0, value); break;
    }
  }
  
  removeElementAt(scope, property, idx) {
    switch (property) {
      case 'transform': this.transform.splice(idx, 1); break;
      case 'classifiers': this.classifiers.splice(idx, 1); break;
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
      color: this.color || parentContext?.color
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
      color: this.color || null
    };
    
    // Set initial visibility
    group.visible = !this.hidden;
    
    this.node = group;
  }

  loadJson(scope, json) {
    this.setProperty(scope, 'contents', json.contents);
    this.setProperty(scope, 'transform', json.transform);
    this.setProperty(scope, 'hidden', json.hidden);
    this.setProperty(scope, 'selectable', json.selectable);
    this.setProperty(scope, 'color', json.color);
  }

  setProperty(scope, property, value) {
    switch (property) {
      case 'contents': {
        if (this.contents) {
        this.contents.forEach((c) => c.parent = null);
        }
        this.contents = scope.loadAll(value);
      this.contents.forEach((c) => c.parent = this);
        break;
      } 
      case 'transform': this.transform = value; break;
      case 'color': 
        this.color = value; 
        if (this.node && value) {
          applyColorToObject(this.node, value);
        }
        break;
      case 'hidden': 
        this.hidden = value; 
        if (this.node) {
          this.node.visible = !value;
        }
        break;
      case 'selectable': this.selectable = value; break;
      default:
        super.setProperty(scope, property, value);
        break;
   }
  }

  insertElementAt(scope, property, idx, value) {
    switch (property) {
      case 'contents': {
        const newContent = scope.loadJson(value);
        newContent.parent = this;
        this.contents.splice(idx, 0, newContent);
        break;
      } 
      case 'transform': this.transform.splice(idx, 0, value); break;
    }
  }

  removeElementAt(scope, property, idx) {
    switch (property) {
      case 'contents': {
        this.contents[idx].parent = null;
        this.contents.splice(idx, 1);
        break;
      } 
      case 'transform': this.transform.splice(idx, 1); break;
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
      color: this.color || null
    };
    
    // Set initial visibility
    group.visible = !this.hidden;
    
    this.node = group;
  }

  loadJson(scope, json) {
    this.setProperty(scope, 'asset', json.asset);
    this.setProperty(scope, 'transform', json.transform);
    this.setProperty(scope, 'hidden', json.hidden);
    this.setProperty(scope, 'selectable', json.selectable);
    this.setProperty(scope, 'color', json.color);
  }

  setProperty(scope, property, value) {
    switch (property) {
      case 'asset': this.asset = scope.loadJson(value); break; 
      case 'transform': this.transform = value; break;
      case 'color': 
        this.color = value; 
        // Update 3D object color
        if (this.node && value) {
          applyColorToObject(this.node, value);
        }
        break;
      case 'hidden': {
        this.hidden = value; 
        // Update 3D object visibility
        if (this.node) {
          this.node.visible = !value;
        }
        break;
      } 
      case 'selectable': this.selectable = value; break;
      default:
        super.setProperty(scope, property, value);
        break;
    }
  }

  insertElementAt(scope, property, idx, value) {
    switch (property) {
      case 'transform': this.transform.splice(idx, 0, value); break;
    }
  }
  
  removeElementAt(scope, property, idx) {
    switch (property) {
      case 'transform': this.transform.splice(idx, 1); break;
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
    
    if (this.url) {
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

    const useLOD = true;
    
    if (useLOD) {
      // create LOD object
      const lod = new LOD();
      this.group.add(lod);
      
      // create high detail model (original)
      const highDetailModel = this.createDetailLevel(this.gltf.scene, LOD_HIGH);
      lod.addLevel(highDetailModel, 0);  // visible from distance 0 to medium distance
      
      // create medium detail model (simplified)
      const mediumDetailModel = this.createDetailLevel(this.gltf.scene, LOD_MEDIUM);
      lod.addLevel(mediumDetailModel, LOD_MEDIUM_DISTANCE);  // visible from medium to low distance
      
      // create low detail model (very simplified)
      const lowDetailModel = this.createDetailLevel(this.gltf.scene, LOD_LOW);
      lod.addLevel(lowDetailModel, LOD_LOW_DISTANCE);  // visible from low distance and beyond
      
    } else {
      // standard non-LOD rendering
      const model = this.gltf.scene.clone();
      model.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          obj.userData.originalMaterial = obj.material;
          obj.material = obj.material.clone();
          obj.material.userData.originalColor = obj.material.color.clone();
        }
      });
      this.group.add(model);
    }

    const currentColor = this.placeholder.material.color;
    ctrl.setColor(this.group, currentColor);
  }
  
  // create a model with specific level of detail
  createDetailLevel(originalScene, detailLevel) {
    const model = originalScene.clone();

    model.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.userData.originalMaterial = obj.material;
        obj.material = obj.material.clone();
        obj.material.userData.originalColor = obj.material.color.clone();

        // apply detail level specific optimizations
        switch (detailLevel) {
          case LOD_HIGH:
            // high detail - keep original quality
            break;
            
          case LOD_MEDIUM:
            // medium detail - reduce material complexity
            this.simplifyMaterial(obj.material, LOD_MEDIUM);
            break;
            
          case LOD_LOW:
            // low detail - maximum simplification
            this.simplifyMaterial(obj.material, LOD_LOW);
            break;
        }
      }
    });
    //   group.add(model);
    // return group;
    return model;
  }
      
      // simplify material based on detail level
  simplifyMaterial(material, detailLevel) {
    if (Array.isArray(material)) {
      material.forEach(mat => this.applySimplerMaterial(mat, detailLevel));
    } else {
      const result = this.applySimplerMaterial(material, detailLevel);
      if (result && detailLevel === LOD_LOW) {
        return result;
      }
    }
  }
  
  // apply simpler material properties based on detail level
  applySimplerMaterial(material, detailLevel) {
    // for medium detail
    if (detailLevel === LOD_MEDIUM) {
      // reduce texture quality
      if (material.map) {
        material.map.anisotropy = 1;
        material.map.minFilter = LinearFilter;
      }
      
      // simplify material properties
      material.fog = false;
      material.flatShading = true;
      
      // reduce shadow quality
      material.shadowSide = null;
      return material;
    }
    // for low detail
    else if (detailLevel === LOD_LOW) {
      // replace with basic material for maximum performance
      const color = material.color ? material.color.clone() : new Color(0xcccccc);
      
      // create a new basic material
      const basicMaterial = new MeshBasicMaterial({
        color: color,
        wireframe: false,
        transparent: material.transparent,
        opacity: material.opacity
      });
      
      return basicMaterial;
    }
  }

  loadJson(scope, json) {
    this.setProperty(scope, 'url', json.url);
    this.setProperty(scope, 'dynamicImage', json.dynamicImage);
    this.setProperty(scope, 'layoutPoint', json.layoutPoint);
    this.setProperty(scope, 'snappingPoints', json.snappingPoints);
  }

  setProperty(scope, property, value) {
    switch (property) {
      case 'url': this.url = value; break;
      case 'dynamicImage': this.dynamicImage = scope.loadJson(value); break;
      case 'layoutPoint': this.layoutPoint = scope.loadJson(value); break; 
      case 'snappingPoints': this.snappingPoints = scope.loadAll(value); break; 
      default:
        super.setProperty(scope, property, value);
        break;
    }
  }
  insertElementAt(scope, property, idx, value) {
    switch (property) {
      case 'snappingPoints': this.snappingPoints.splice(idx, 0, scope.loadJson(value)); break; 
    }
  }

  removeElementAt(scope, property, idx) {
    switch (property) {
      case 'snappingPoints': this.snappingPoints.splice(idx, 1); break; 
    }
  }
}
