/**
 * Data Models for ThreeJS Control
 * Contains all data model classes used in the 3D scene management like SharedObjects and its extensions
 */

import {
  C_P_RADIUS,
  GREEN,
  HEIGHT_SEGMENTS,
  INSTANCING_MIN_COPIES,
  RED,
  WIDTH_SEGMENTS,
} from "./Constants.js";

import {
  BoxGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";

import {
  applyColorToObject,
  disposeMaterial,
  disposeMaterialWithTextures,
  materialsOf,
  toMatrix,
  toTX,
  transform,
} from "./ThreeJsUtils.js";

import { InstancedMeshManager } from "./InstancedMeshManager.js";

import { ImpostorManager } from "./ImpostorManager.js";

import { GLTFLoader } from "GLTFLoader";
import { mergeGeometries } from "BufferGeometryUtils";
import { DRACOLoader } from "DRACOLoader";
import { KTX2Loader } from "KTX2Loader";
import { MeshoptDecoder } from "MeshoptDecoder";
import { InsertElement, RemoveElement, SetProperty } from "./Commands.js";

/**
 * The URL from which the GLTF of the given asset is loaded, and the key of the loaded GLTF in
 * Scope.gltfs. An uploaded image (dynamicImage) takes precedence over the static URL.
 *
 * @returns {string|null} The URL, or null if the asset has no GLTF source.
 */
export function gltfUrlOf(ctrl, asset) {
  if (asset.dynamicImage) {
    return ctrl.imageUrl + "/" + asset.dynamicImage.imageID;
  } else if (asset.url) {
    return ctrl.contextPath + asset.url;
  } else {
    return null;
  }
}

/**
 * Inverse of the layout point transformation of the given asset, or null if it has none.
 *
 * The normal rendering moves the model by this matrix (see GltfAsset.build), so that the
 * layout point of the asset lies at the origin of the part.
 */
export function layoutPointInverse(asset) {
  const transform = asset?.layoutPoint?.transform;
  return transform ? toMatrix(transform).invert() : null;
}

/**
 * Key of the instancing group of the given asset: the URL its GLTF is loaded from and, if
 * present, its layout point. Assets with the same key are rendered identically and can share
 * one instanced mesh (and impostor). Null if the asset has no GLTF.
 */
export function instanceKey(ctrl, asset) {
  const gltfUrl = gltfUrlOf(ctrl, asset);
  if (gltfUrl == null) {
    return null;
  }
  const layoutTransform = asset.layoutPoint?.transform;
  return layoutTransform ? gltfUrl + "#layout=" + layoutTransform.join(",") : gltfUrl;
}

/**
 * Builds the geometry and material for rendering the given GLTF instanced, so that it looks
 * like the normal rendering of the asset (GltfAsset.build / setGLTF):
 *
 * - all meshes of the GLTF are merged into one geometry, each transformed by its world matrix
 *   within the GLTF scene, with one geometry group and material per mesh,
 * - the inverse of the layout point of the asset is applied.
 *
 * Returns {geometry, material, triangleCount} (material is an array for several meshes), or
 * null if the GLTF has no mesh. The geometry is new; the materials are the ones of the GLTF
 * (the InstancedMeshManager clones them).
 */
function instanceTemplate(gltf, asset, assetKey) {
  const meshes = [];
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((obj) => {
    if (obj.isMesh) {
      meshes.push(obj);
    }
  });
  if (meshes.length === 0) {
    return null;
  }

  const layoutInverse = layoutPointInverse(asset);
  const toModel = (mesh) => {
    const matrix = mesh.matrixWorld.clone();
    if (layoutInverse) {
      matrix.premultiply(layoutInverse);
    }
    return matrix;
  };
  // GLTFLoader creates one mesh per primitive, so a mesh has a single material.
  const materialOf = (mesh) =>
    Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;

  let geometry;
  let material;
  if (meshes.length === 1) {
    geometry = meshes[0].geometry.clone().applyMatrix4(toModel(meshes[0]));
    material = materialOf(meshes[0]);
  } else {
    // mergeGeometries needs the same attributes and indexing in all geometries.
    const names = Object.keys(meshes[0].geometry.attributes).filter((name) =>
      meshes.every((mesh) => mesh.geometry.attributes[name] !== undefined),
    );
    const indexed = meshes.every((mesh) => mesh.geometry.index !== null);
    const parts = meshes.map((mesh) => {
      let part = mesh.geometry.clone();
      if (!indexed && part.index !== null) {
        part = part.toNonIndexed();
      }
      for (const name of Object.keys(part.attributes)) {
        if (!names.includes(name)) {
          part.deleteAttribute(name);
        }
      }
      part.morphAttributes = {};
      return part.applyMatrix4(toModel(mesh));
    });
    geometry = mergeGeometries(parts, true);
    parts.forEach((part) => part.dispose());
    if (geometry == null) {
      console.warn(
        `Cannot merge the ${meshes.length} meshes of ${assetKey}, instancing shows only the first one.`,
      );
      geometry = meshes[0].geometry.clone().applyMatrix4(toModel(meshes[0]));
      material = materialOf(meshes[0]);
    } else {
      material = meshes.map(materialOf);
    }
  }

  const triangleCount =
    (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
  return { geometry, material, triangleCount };
}

/**
 * The URL path of a library folder of the three.js examples (examples/jsm/libs/<folder>/), found
 * relative to the loader module with the given import specifier.
 */
function libraryPath(loaderSpecifier, folder) {
  return new URL(`../libs/${folder}/`, import.meta.resolve(loaderSpecifier)).pathname;
}

/** Number of GLTF files loaded at the same time. */
const PARALLEL_DOWNLOADS = 6;

/**
 * Makes the materials of a placeholder mesh a red wire frame, which tells a part whose GLTF
 * could not be loaded from one that is still loading. The colour is kept when selection colours are
 * restored (originalColor).
 */
function markFailedPlaceholder(mesh) {
  for (const material of materialsOf(mesh)) {
    material.color.set(RED);
    material.userData.originalColor = material.color.clone();
    material.wireframe = true;
  }
}

/** Releases the geometries, materials and textures (with their image bitmaps) of a GLTF. */
function disposeGltf(gltf) {
  gltf.scene.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry.dispose();
      disposeMaterialWithTextures(obj.material);
    }
  });
}

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
   * Analyse the scene graph to find duplicate assets that should be instanced
   *
   * The instancing marks of all part nodes (willBeInstanced, assetKey, instanceID) are
   * recomputed: nodes survive a reload of the scene, and a node whose asset is no longer
   * instanced must be built normally again.
   *
   * @returns {Map} Map of assetKey -> {asset, instances[]}, see instanceKey()
   */
  analyzeForInstancing(ctrl) {
    const instanceGroups = new Map();

    const collectPartNodes = (node, parentTransform = new Matrix4()) => {
      if (!node) return;

      let worldTransform = parentTransform.clone();
      if (node.transform && node.transform.length > 0) {
        worldTransform.multiply(toMatrix(node.transform));
      }

      if (node instanceof PartNode) {
        node.willBeInstanced = false;
        node.assetKey = null;
        node.instanceID = null;

        const asset = node.asset;
        const assetKey = instanceKey(ctrl, asset);
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

    // Filter to only assets with enough copies to benefit from instancing
    const result = new Map();
    for (const [assetKey, group] of instanceGroups) {
      if (group.instances.length >= INSTANCING_MIN_COPIES) {
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

      // Prepare instance data with IDs and matrices, annotate partNodes
      const instanceData = instances.map((instance, index) => {
        instance.partNode.instanceID = index;
        instance.partNode.assetKey = assetKey;
        return {
          id: index,
          matrix: instance.worldTransform,
          partNode: instance.partNode,
        };
      });

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

      // Add to scene
      ctrl.zUpRoot.add(instancedMesh);

      // Apply initial per-instance state
      this.applyInitialInstanceState(assetKey, instances);
    }
  }

  /**
   * Apply initial per-instance GPU state (hidden, color) from the data model.
   * Called after creating or recreating instanced mesh textures.
   */
  applyInitialInstanceState(assetKey, instances) {
    for (const instance of instances) {
      const partNode = instance.partNode;

      if (isEffectivelyHidden(partNode)) {
        this.instanceManager.setInstanceHidden(assetKey, partNode.instanceID, true);
      }

      // Color: apply if set
      if (partNode.color && partNode.color.trim() !== "") {
        this.instanceManager.setInstanceColor(assetKey, partNode.instanceID, partNode.color);
      }
    }
  }

  /**
   * Replace placeholder InstancedMesh objects with real GLTF geometry
   */
  updateInstancedMeshesWithGLTF(ctrl) {
    if (!this.instanceGroups || this.instanceGroups.size === 0) {
      return;
    }

    const assetKeys = Array.from(this.instanceGroups.keys());

    for (const assetKey of assetKeys) {
      const group = this.instanceGroups.get(assetKey);
      if (!group) {
        continue;
      }

      const asset = group.asset;

      const gltfUrl = gltfUrlOf(ctrl, asset);
      if (gltfUrl == null) {
        continue;
      }

      const gltf = this.gltfs[gltfUrl];

      if (!gltf) {
        console.warn(`GLTF not loaded for ${gltfUrl} (asset ${assetKey})`);
        const placeholder = this.instanceManager.managedMeshes.get(assetKey)?.mesh;
        if (placeholder) {
          markFailedPlaceholder(placeholder);
        }
        continue;
      }

      const template = instanceTemplate(gltf, asset, assetKey);
      if (!template) {
        console.warn(`No mesh found in GLTF for ${assetKey}`);
        continue;
      }
      const { geometry: templateGeometry, material: templateMaterial, triangleCount } = template;

      // Get the old placeholder mesh from the manager
      const oldMeshData = this.instanceManager.managedMeshes.get(assetKey);
      if (!oldMeshData) {
        console.warn(`No managed mesh data found for ${assetKey}`);
        continue;
      }

      const oldMesh = oldMeshData.mesh;

      // Remove old placeholder from scene
      ctrl.zUpRoot.remove(oldMesh);

      // Dispose old placeholder resources
      oldMesh.geometry.dispose();
      disposeMaterial(oldMesh.material);

      // Prepare instance data with IDs and matrices
      const instanceData = group.instances.map((instance, index) => ({
        id: index,
        matrix: instance.worldTransform,
        partNode: instance.partNode,
      }));

      // Create new InstancedMesh with real geometry using the manager
      const newInstancedMesh = this.instanceManager.createInstancedMesh(
        assetKey,
        templateGeometry,
        templateMaterial,
        group.instances.length,
        instanceData,
        triangleCount,
      );
      // The manager copies the geometry into an instanced geometry.
      templateGeometry.dispose();

      // Copy over important userData
      newInstancedMesh.userData.isInstancedMesh = true;
      newInstancedMesh.userData.assetKey = assetKey;

      // Add to scene
      ctrl.zUpRoot.add(newInstancedMesh);

      this.createImpostorMesh(ctrl, assetKey, group);

      // Re-apply per-instance state after texture recreation
      this.applyInitialInstanceState(assetKey, group.instances);
    }
  }

  /**
   * Update which instances are visible for a specific asset
   * This will be called by the octree/visibility system
   */
  updateVisibleInstances(assetKey, visibleInstanceIDs) {
    this.instanceManager.updateVisibleInstances(assetKey, visibleInstanceIDs);
  }

  /**
   * Dispose and remove cached GLTF entries whose URLs are not in keepUrls.
   * Called on scene reload to free CPU/GPU memory from the previous scene's assets.
   */
  clearStaleGltfs(keepUrls) {
    for (const [url, gltf] of Object.entries(this.gltfs)) {
      if (!keepUrls.has(url)) {
        disposeGltf(gltf);
        delete this.gltfs[url];
      }
    }
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
      let obj;
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
        case "Cube":
          obj = new Cube(id);
          break;
        default:
          // A type of a newer server: shown as nothing instead of stopping the whole scene.
          console.error(`3D viewer: unknown scene object type '${json[0]}'.`);
          obj = new UnknownObject(id);
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

  /**
   * Abort any in-flight asset loading from a previous scene.
   * Called at the start of reload() to prevent old and new loading
   * pipelines from running concurrently.
   */
  abortAssetLoading() {
    this._loadAbortController?.abort();
    this._loadAbortController = null;
    this._impostorAbortController?.abort();
    this._impostorAbortController = null;
  }

  /**
   * The GLTF loader of this scope, created on first use.
   *
   * Besides plain glTF, the loader reads the compressions that tools like gltf-transform or
   * gltfpack produce: geometry compressed with DRACO (KHR_draco_mesh_compression) or meshopt
   * (EXT_meshopt_compression), and textures in the KTX2 / Basis Universal format
   * (KHR_texture_basisu).
   *
   * All loading pipelines share one loader, so that there is only one DRACO decoder and one
   * KTX2 transcoder, each with a pool of web workers. They are released when the current
   * pipeline ends (see releaseDecoders()) and created again by the next pipeline.
   *
   * @param renderer The renderer that displays the textures; it determines the GPU texture
   *        formats into which KTX2 textures are transcoded.
   */
  gltfLoader(renderer) {
    if (!this._gltfLoader) {
      this._gltfLoader = new GLTFLoader();
      // Decodes in the main thread, does not need to be released.
      this._gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    }
    if (!this._dracoLoader) {
      // The decoders lie next to the loaders in the examples of three.js. Since the path of
      // the loader modules contains the version number, it is derived from the module URL.
      this._dracoLoader = new DRACOLoader();
      this._dracoLoader.setDecoderPath(libraryPath("DRACOLoader", "draco"));
      this._gltfLoader.setDRACOLoader(this._dracoLoader);

      this._ktx2Loader = new KTX2Loader();
      this._ktx2Loader.setTranscoderPath(libraryPath("KTX2Loader", "basis"));
      this._ktx2Loader.detectSupport(renderer);
      this._gltfLoader.setKTX2Loader(this._ktx2Loader);
    }
    return this._gltfLoader;
  }

  /**
   * Terminates the web workers of the DRACO decoder and the KTX2 transcoder and releases their
   * WebAssembly memory.
   *
   * A disposed DRACOLoader or KTX2Loader cannot be used any more (it revokes the source URL of
   * its workers), so the next call of gltfLoader() creates new ones. Must not be called while a
   * pipeline decodes, since pending decodings of terminated workers never finish.
   */
  releaseDecoders() {
    this._dracoLoader?.dispose();
    this._dracoLoader = null;
    // Only a KTX2Loader that has loaded its transcoder has workers. Disposing an unused one would
    // decrement the module wide count of active loaders below zero (and silence its warning
    // about several active loaders).
    if (this._ktx2Loader?.transcoderPending) {
      this._ktx2Loader.dispose();
    }
    this._ktx2Loader = null;
  }

  /** Stops loading and releases the decoder. Called when the control is disposed. */
  dispose() {
    this.disposed = true;
    this.abortAssetLoading();
    this.releaseDecoders();
    // The GLTFs with their images (ImageBitmaps are not garbage collected by themselves) and
    // the instanced meshes are no longer shown.
    this.clearStaleGltfs(new Set());
    this.instanceManager.dispose();
  }

  /**
   * Loads the GLTF files of all assets. The impostors are generated on demand (ensureImpostors()).
   *
   * A previous loading pipeline is aborted. The returned promise resolves to true when
   * all assets are loaded, and to false when this pipeline was aborted (by a later call or
   * by abortAssetLoading()); in that case the caller must not continue with the scene,
   * since it may already show different content.
   *
   * Downloads already started by an aborted pipeline are not cancelled: three.js shares
   * pending requests for the same URL between loaders, so the next pipeline may wait for
   * them. Only the batches not yet started are skipped.
   */
  loadAssets(ctrl) {
    // Abort any previous loading pipeline
    this.abortAssetLoading();
    const abortController = new AbortController();
    this._loadAbortController = abortController;
    this._pipelineRunning = true;
    const signal = abortController.signal;

    const gltfLoader = this.gltfLoader(ctrl.renderer);

    const loadUrl = (url) => {
      return gltfLoader.loadAsync(url).then(
        (gltf) => {
          if (signal.aborted) {
            // Not used by the scene that replaced this one.
            disposeGltf(gltf);
            return;
          }
          // Release the parser to free the raw ArrayBuffer data it retains.
          // The parser is only needed during the initial parse and is never
          // used after loadAsync resolves.
          delete gltf.parser;
          // store gltf in the cache
          this.gltfs[url] = gltf;
        },
        (reason) => {
          if (signal.aborted) return;
          const msg = "Failed to load '" + url + "': " + reason;
          console.error(msg);
        },
      );
    };

    const assetsByURL = Map.groupBy(this.assets, (asset) =>
      gltfUrlOf(ctrl, asset),
    );
    // No need to load "null" URL.
    assetsByURL.delete(null);

    // URLs not loaded yet; the others are shown at once.
    const urls = [...assetsByURL.keys()].filter(
      (url) => !this.setGLTF(ctrl, url, assetsByURL),
    );

    // A fixed number of downloads at a time, each model shown as soon as it is loaded: a batch
    // of downloads would wait for its slowest file before the next batch starts.
    let next = 0;
    const loadNext = async () => {
      while (next < urls.length && !signal.aborted) {
        const url = urls[next++];
        await loadUrl(url);
        if (signal.aborted) return;
        if (!this.setGLTF(ctrl, url, assetsByURL)) {
          // Without a model the parts would stay white boxes like those still loading.
          for (const asset of assetsByURL.get(url)) {
            asset.markLoadFailed();
          }
        }
        ctrl.invalidate();
      }
    };
    const loaders = [];
    for (let i = 0; i < Math.min(PARALLEL_DOWNLOADS, urls.length); i++) {
      loaders.push(loadNext());
    }

    return Promise.all(loaders)
      .then(() => {
        // All GLTFs of this pipeline are decoded. A later pipeline that is already running
        // still needs the workers; it releases them when it ends.
        if (this._loadAbortController === abortController) {
          this._pipelineRunning = false;
          this.releaseDecodersWhenIdle();
        }
        return !signal.aborted;
      });
  }

  /** Releases the decoders unless a loading pipeline or an additional loading is running. */
  releaseDecodersWhenIdle() {
    if (!this._pipelineRunning && !this._additionalLoads) {
      this.releaseDecoders();
    }
  }

  /**
   * Shows the models of the parts in the given subtree that has just been built (e.g. parts
   * the server added to the scene): from the cache, or loaded in addition to a running
   * loading pipeline, which is not aborted.
   */
  showModels(ctrl, node) {
    const missing = new Map();
    const visit = (n) => {
      if (n instanceof PartNode) {
        if (!n.node || !n.asset) {
          return;
        }
        const url = gltfUrlOf(ctrl, n.asset);
        const gltf = n.asset.gltf ?? (url != null ? this.gltfs[url] : null);
        if (gltf) {
          n.asset.setGLTF(gltf, ctrl);
        } else if (url != null) {
          const assets = missing.get(url) ?? [];
          assets.push(n.asset);
          missing.set(url, assets);
        }
      } else if (n.contents) {
        n.contents.forEach(visit);
      }
    };
    visit(node);

    for (const [url, assets] of missing) {
      this.loadAdditionalGLTF(ctrl, url, assets);
    }
  }

  /** Loads a GLTF that a loading pipeline did not load and shows it in the given assets. */
  loadAdditionalGLTF(ctrl, url, assets) {
    this._additionalLoads = (this._additionalLoads ?? 0) + 1;
    this.gltfLoader(ctrl.renderer)
      .loadAsync(url)
      .then(
        (gltf) => {
          if (this.disposed) {
            // The viewer has been closed meanwhile.
            disposeGltf(gltf);
            return;
          }
          delete gltf.parser;
          this.gltfs[url] = gltf;
          for (const asset of assets) {
            // Skip assets that have been removed from the scene meanwhile.
            if (this.objects[asset.id] === asset && !ctrl.disposed) {
              asset.setGLTF(gltf, ctrl);
            }
          }
          ctrl.invalidate();
        },
        (reason) => {
          console.error("Failed to load '" + url + "': " + reason);
          assets.forEach((asset) => asset.markLoadFailed());
          ctrl.invalidate();
        },
      )
      .finally(() => {
        this._additionalLoads--;
        this.releaseDecodersWhenIdle();
      });
  }

  /**
   * Creates the impostor mesh of the given instanced asset, if its impostor has been generated.
   */
  createImpostorMesh(ctrl, assetKey, group) {
    const impostorData = ctrl.impostorManager?.impostorData.get(assetKey);
    if (!impostorData || !this.instanceManager.managedMeshes.has(assetKey)) {
      return;
    }
    const { colorTexture, centerOffset, faceCornerUVData } = impostorData;

    // Prepare instance data (same as for real meshes)
    const instanceData = group.instances.map((instance, index) => ({
      id: index,
      matrix: instance.worldTransform,
      partNode: instance.partNode,
    }));

    const impostorMesh = this.instanceManager.createImpostorMesh(
      assetKey,
      colorTexture,
      centerOffset,
      group.instances.length,
      instanceData,
      faceCornerUVData,
    );
    if (impostorMesh) {
      ctrl.zUpRoot.add(impostorMesh);
    }
  }

  /**
   * Generates the impostors of the instanced assets, unless they exist or are being generated.
   *
   * Impostors are drawn only on the octree path, for the instances beyond the triangle budget
   * (see RenderManager): a small scene never needs them, and generating them costs 26 render
   * passes and a read back of the atlas per asset. Called when the octree path is switched on.
   */
  ensureImpostors(ctrl) {
    if (!this.instanceGroups || this.instanceGroups.size === 0) {
      return;
    }
    // Generating already, or all impostors exist (e.g. kept over a reload).
    const running =
      this._impostorAbortController && !this._impostorAbortController.signal.aborted;
    const missing = [...this.instanceGroups.keys()].some(
      (assetKey) => !ctrl.impostorManager?.impostorData.has(assetKey),
    );
    if (running || !missing) {
      return;
    }
    const abortController = new AbortController();
    this._impostorAbortController = abortController;
    const signal = abortController.signal;

    // Each impostor is shown as soon as it is generated; until then the render loop draws the
    // instances of the asset in full.
    this.generateImpostors(ctrl, signal, (assetKey) => {
      if (ctrl.disposed) {
        return;
      }
      this.createImpostorMesh(ctrl, assetKey, this.instanceGroups.get(assetKey));
      ctrl.invalidate();
    });
  }

  /**
   * @param onGenerated Optional function called with the asset key of each generated impostor.
   */
  async generateImpostors(ctrl, signal, onGenerated) {
    if (!this.instanceGroups || this.instanceGroups.size === 0) {
      return;
    }

    if (!ctrl.impostorManager) {
      ctrl.impostorManager = new ImpostorManager(
        ctrl.renderer,
        ctrl.contextPath,
      );
    }
    const impostorManager = ctrl.impostorManager;

    // Only generate impostors for instanced assets — non-instanced models
    // don't use impostors and generating atlases for all of them is extremely
    // expensive (26 render passes per model). Impostors kept over a reload are not generated
    // again.
    const entries = [];
    for (const [assetKey, group] of this.instanceGroups) {
      if (impostorManager.impostorData.has(assetKey)) {
        continue;
      }
      const gltfUrl = gltfUrlOf(ctrl, group.asset);
      const gltf = gltfUrl ? this.gltfs[gltfUrl] : null;
      if (gltf) {
        entries.push([assetKey, gltf, layoutPointInverse(group.asset)]);
      }
    }

    for (const [assetKey, gltf, layoutInverse] of entries) {
      // One asset per task (26 render passes and a read back), so that the view stays
      // responsive while the impostors are generated.
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (signal?.aborted) {
        // The scene was reloaded meanwhile, the manager is disposed or replaced.
        return;
      }
      await impostorManager.generateImpostorForAsset(assetKey, gltf, layoutInverse);
      if (signal?.aborted) {
        return;
      }
      onGenerated?.(assetKey);
    }

    // Shared render target is no longer needed after all impostors are generated
    impostorManager.disposeSharedRenderTarget();
    this.releaseInstancedGltfGeometries(ctrl);
    if (this._impostorAbortController?.signal === signal) {
      this._impostorAbortController = null;
    }
  }

  /**
   * Releases the GPU buffers of the GLTF geometries of instanced assets. Rendering the impostors
   * uploads them, but the scene draws the instanced copies only. The data stays in memory (for a
   * reload or new impostors); three.js uploads it again if it is drawn once more.
   */
  releaseInstancedGltfGeometries(ctrl) {
    if (!this.instanceGroups) {
      return;
    }
    // GLTFs also shown as normal (not instanced) parts are drawn and keep their buffers.
    const drawn = new Set();
    for (const asset of this.assets) {
      if (asset._clonedModel && asset.gltf) {
        drawn.add(asset.gltf);
      }
    }
    for (const group of this.instanceGroups.values()) {
      const gltf = this.gltfs[gltfUrlOf(ctrl, group.asset)];
      if (!gltf || drawn.has(gltf)) {
        continue;
      }
      gltf.scene.traverse((object) => {
        if (object.isMesh) {
          object.geometry.dispose();
        }
      });
    }
  }

  /**
   * Renders the impostor atlases of all instanced assets again and hands them to their
   * impostor meshes.
   *
   * Called when the WebGL context has been restored: three.js uploads geometries and
   * textures again, but the atlases exist on the GPU only (their pixels are dropped after the
   * upload).
   */
  async regenerateImpostors(ctrl) {
    const impostorManager = ctrl.impostorManager;
    if (!impostorManager || !this.instanceGroups) {
      return;
    }
    // The atlases belong to the lost context (nothing to release). Until an atlas is rendered
    // again, its asset has no impostor mesh and the render loop draws the instances in full.
    const regenerate = [];
    for (const [assetKey, group] of this.instanceGroups) {
      if (!impostorManager.impostorData.has(assetKey)) {
        // Not yet generated, the loading pipeline still does that.
        continue;
      }
      impostorManager.impostorData.delete(assetKey);
      this.instanceManager.removeImpostorMesh(assetKey, false);
      const gltf = this.gltfs[gltfUrlOf(ctrl, group.asset)];
      if (gltf) {
        regenerate.push([assetKey, group, gltf]);
      }
    }
    ctrl.invalidate();

    for (const [assetKey, group, gltf] of regenerate) {
      await impostorManager.generateImpostorForAsset(
        assetKey,
        gltf,
        layoutPointInverse(group.asset),
      );
      if (ctrl.disposed || ctrl.impostorManager !== impostorManager) {
        return;
      }
      this.createImpostorMesh(ctrl, assetKey, group);
      ctrl.invalidate();
    }
    impostorManager.disposeSharedRenderTarget();
    this.releaseInstancedGltfGeometries(ctrl);
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
    const idx = this.selection.indexOf(node);
    if (idx < 0) {
      return null;
    }
    this.selection.splice(idx, 1);
    return RemoveElement.prototype.create(this.id, "selection", idx);
  }

  addSelected(node) {
    const idx = this.selection.indexOf(node);
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
    // Cancel any in-flight asset loading from the previous scene to prevent
    // old and new loading pipelines from running concurrently.
    scope.abortAssetLoading();

    // Collect the set of objects reachable from the NEW scene graph root
    // before disposing, so we know what the new scene actually needs.
    const reachableIds = new Set();
    const collectReachable = (node) => {
      if (!node) return;
      reachableIds.add(node.id);
      if (node instanceof PartNode) {
        if (node.asset) {
          reachableIds.add(node.asset.id);
          if (node.asset.dynamicImage) reachableIds.add(node.asset.dynamicImage.id);
          if (node.asset.layoutPoint) reachableIds.add(node.asset.layoutPoint.id);
          node.asset.snappingPoints?.forEach((p) => reachableIds.add(p.id));
        }
      } else if (node instanceof GroupNode && node.contents) {
        node.contents.forEach(collectReachable);
      }
    };
    collectReachable(this.root);
    reachableIds.add(this.id);

    // Dispose GPU resources for OLD assets (those not in the new scene)
    for (const obj of Object.values(scope.objects)) {
      if (obj instanceof GltfAsset && !reachableIds.has(obj.id)) {
        obj.dispose();
      }
    }
    scope.instanceManager.dispose();
    this.ctrl.resetSceneOctree();
    this.ctrl.instancedSnappingPoints.dispose();
    // The impostors are kept: the atlas of an asset does not change with the scene (see below).

    // Compute needed URLs from the NEW scene's assets only
    const neededUrls = new Set();
    for (const id of reachableIds) {
      const obj = scope.objects[id];
      if (obj instanceof GltfAsset) {
        const gltfUrl = gltfUrlOf(this.ctrl, obj);
        if (gltfUrl != null) neededUrls.add(gltfUrl);
      }
    }
    scope.clearStaleGltfs(neededUrls);

    // Purge stale objects from scope.objects to prevent unbounded growth
    for (const id of Object.keys(scope.objects)) {
      // scope.objects keys are coerced to strings; IDs in reachableIds are numbers
      const numId = Number(id);
      if (!reachableIds.has(numId) && !isNaN(numId)) {
        delete scope.objects[id];
      }
    }

    this.ctrl.zUpRoot.clear();
    this.ctrl.multiTransformGroup.clear();

    // Re-analyse for instancing
    scope.analyzeForInstancing(this.ctrl);

    // Keep the impostors of assets that are still instanced; generating an atlas costs 26
    // render passes and a read back per asset.
    this.ctrl.impostorManager?.retain(new Set(scope.instanceGroups?.keys() ?? []));

    this.build(this.ctrl.zUpRoot);

    // Recreate instanced meshes
    scope.createInstancedMeshes(this.ctrl);

    // The selection and the gizmo refer to the new 3D objects at once: until the assets are
    // loaded, the gizmo would otherwise stay at the removed object.
    this.ctrl.applySelection(this.selection);
    this.ctrl.updateTransformControls();

    scope.loadAssets(this.ctrl).then((loaded) => {
      // Aborted by a later reload, which continues with the then current scene.
      if (!loaded) return;

      // Update instanced meshes with real geometry
      scope.updateInstancedMeshesWithGLTF(this.ctrl);

      // Re-evaluate whether octree is needed now that real geometry is loaded
      this.ctrl.buildSceneOctree();
      this.ctrl.createBoundingBox();
      this.ctrl.refreshInstancedSnappingPoints();

      this.ctrl.applyColors();
      this.ctrl.applySelection(this.selection);
      this.ctrl.updateTransformControls();
      this.ctrl.invalidate();
    }).catch((error) => this.ctrl.showLoadError(error));

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

  /** Releases the marker sphere of this point (geometry and material). */
  dispose() {
    this.pointGeometry?.dispose();
    this.pointMaterial?.dispose();
    this.pointGeometry = null;
    this.pointMaterial = null;
  }

  build(parentGroup, layoutPoint) {
    this.dispose();

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

/**
 * Builds a group or part node that is shown, but has no 3D object.
 *
 * build() skips hidden nodes, so a node that was hidden when the scene was built has no 3D
 * object. When it is shown later, it is built below the 3D object of its parent, with the
 * colour inherited from its ancestors, and already loaded GLTFs replace the placeholders. If
 * the parent has no 3D object either (because it is hidden as well), nothing happens: the
 * node is built together with its parent.
 */
/**
 * Whether the given scene node is not shown: it or one of its ancestors is hidden. Instances
 * are not part of the 3D object tree of their ancestors and do not inherit its visibility.
 */
function isEffectivelyHidden(node) {
  for (let n = node; n; n = n.parent) {
    if (n.hidden) {
      return true;
    }
  }
  return false;
}

function buildWhenShown(node) {
  const parent = node.parent;
  let ctrl = null;
  let color = null;
  for (let ancestor = parent; ancestor; ancestor = ancestor.parent) {
    if (ancestor instanceof SceneGraph) {
      ctrl = ancestor.ctrl;
      break;
    }
    if (color == null && ancestor.color) {
      color = ancestor.color;
    }
  }
  if (ctrl == null) {
    return;
  }
  const parentGroup = parent instanceof SceneGraph ? ctrl.zUpRoot : parent?.node;
  if (!parentGroup) {
    return;
  }

  node.build(parentGroup, { color });
  ctrl.scope.showModels(ctrl, node);
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

    // Apply colour to this group node
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
        // Update the Three.js node's matrix to match the new transform
        if (this.node) {
          this.node.matrix.identity();
          this.node.position.set(0, 0, 0);
          this.node.rotation.set(0, 0, 0);
          this.node.scale.set(1, 1, 1);
          if (value && value.length > 0) {
            this.node.applyMatrix4(toMatrix(value));
          }
        }
        // Recompute GPU matrices for instanced descendants (e.g., server undo/cancel)
        this.recomputeInstancedChildrenMatrices(scope);
        break;
      case "color":
        this.color = value;
        if (this.node) {
          this.node.userData.color = value || null;
          if (value) {
            applyColorToObject(this.node, value);
          }
        }
        this.setInstancedChildrenColor(scope, value);
        break;
      case "hidden": {
        const wasHidden = this.hidden;
        this.hidden = value;
        if (this.node) {
          this.node.visible = !value;
        } else if (wasHidden && !value) {
          buildWhenShown(this);
        }
        // A hidden ancestor keeps the instances hidden when this group is shown.
        this.setInstancedChildrenHidden(scope, isEffectivelyHidden(this));
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

  /**
   * Recursively set hidden state on instanced PartNode descendants.
   * The effective hidden state is the OR of the node's own hidden flag
   * and any ancestor's hidden flag.
   */
  setInstancedChildrenHidden(scope, parentHidden) {
    if (!this.contents) return;
    for (const child of this.contents) {
      if (child instanceof PartNode && child.willBeInstanced && child.assetKey != null) {
        const effectiveHidden = parentHidden || child.hidden;
        scope.instanceManager.setInstanceHidden(child.assetKey, child.instanceID, effectiveHidden);
      } else if (child instanceof GroupNode) {
        // If this child group is also hidden, its descendants stay hidden regardless
        const effectiveHidden = parentHidden || child.hidden;
        child.setInstancedChildrenHidden(scope, effectiveHidden);
      }
    }
  }

  /**
   * Recursively set color on instanced PartNode descendants.
   * A child's own color takes priority over the parent's color.
   */
  setInstancedChildrenColor(scope, parentColor) {
    if (!this.contents) return;
    for (const child of this.contents) {
      if (child instanceof PartNode && child.willBeInstanced && child.assetKey != null) {
        const effectiveColor = child.color || parentColor;
        if (effectiveColor) {
          scope.instanceManager.setInstanceColor(child.assetKey, child.instanceID, effectiveColor);
        } else {
          scope.instanceManager.clearInstanceColor(child.assetKey, child.instanceID);
        }
      } else if (child instanceof GroupNode) {
        const effectiveColor = child.color || parentColor;
        child.setInstancedChildrenColor(scope, effectiveColor);
      }
    }
  }

  /**
   * Recompute GPU instance matrices for all instanced PartNode descendants.
   * Walks up the parent chain to compute this node's world transform, then
   * walks down through descendants, accumulating transforms.
   */
  recomputeInstancedChildrenMatrices(scope) {
    // Compute this GroupNode's world transform by walking up the parent chain
    const worldTransform = this._computeWorldTransform();
    this._recomputeDescendantMatrices(scope, worldTransform);
  }

  _computeWorldTransform() {
    const transforms = [];
    let current = this;
    while (current) {
      if (current.transform && current.transform.length > 0) {
        transforms.unshift(current.transform);
      }
      current = current.parent;
    }
    const result = new Matrix4();
    for (const t of transforms) {
      result.multiply(toMatrix(t));
    }
    return result;
  }

  _recomputeDescendantMatrices(scope, parentWorldTransform) {
    if (!this.contents) return;
    for (const child of this.contents) {
      let childWorld = parentWorldTransform.clone();
      if (child.transform && child.transform.length > 0) {
        childWorld.multiply(toMatrix(child.transform));
      }

      if (child instanceof PartNode && child.willBeInstanced && child.assetKey != null) {
        scope.instanceManager.updateInstanceMatrix(child.assetKey, child.instanceID, childWorld);
      }

      if (child instanceof GroupNode && child.contents) {
        child._recomputeDescendantMatrices(scope, childWorld);
      }
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
      case "transform": {
        if (this.willBeInstanced && this.assetKey != null) {
          // Recompute the full instance matrix (which has ancestor transforms
          // baked in). Derive parentWorldMatrix from the current instance matrix
          // by stripping the old local transform, then apply the new one.
          const oldLocal = toMatrix(this.transform);
          this.transform = value;
          const newLocal = toMatrix(this.transform);

          const data = scope.instanceManager.managedMeshes.get(this.assetKey);
          if (data && data.instanceData[this.instanceID]) {
            const instanceMatrix = data.instanceData[this.instanceID].matrix;
            const parentWorld = instanceMatrix.clone().multiply(oldLocal.clone().invert());
            const newInstanceMatrix = parentWorld.clone().multiply(newLocal);
            scope.instanceManager.updateInstanceMatrix(this.assetKey, this.instanceID, newInstanceMatrix);

            // Update proxy position if one exists (e.g., during cancel/undo)
            if (this.node && this.node.userData.isInstanceProxy) {
              this.node.position.set(0, 0, 0);
              this.node.rotation.set(0, 0, 0);
              this.node.scale.set(1, 1, 1);
              this.node.updateMatrix();
              this.node.applyMatrix4(newInstanceMatrix);
              // Update stored parentWorldMatrix for future drag calculations
              this.node.userData.parentWorldMatrix = parentWorld;
            }
          }
        } else {
          this.transform = value;
          if (this.node) {
            this.node.matrix.identity();
            this.node.position.set(0, 0, 0);
            this.node.rotation.set(0, 0, 0);
            this.node.scale.set(1, 1, 1);
            if (value && value.length > 0) {
              this.node.applyMatrix4(toMatrix(value));
            }
          }
        }
        break;
      }
      case "color":
        this.color = value;
        // Update 3D object colour
        if (this.willBeInstanced && this.assetKey != null) {
          if (value) {
            scope.instanceManager.setInstanceColor(this.assetKey, this.instanceID, value);
          } else {
            scope.instanceManager.clearInstanceColor(this.assetKey, this.instanceID);
          }
        } else if (this.node) {
          this.node.userData.color = value || null;
          if (value) {
            applyColorToObject(this.node, value);
          }
        }
        break;
      case "hidden": {
        const wasHidden = this.hidden;
        this.hidden = value;
        if (this.willBeInstanced && this.assetKey != null) {
          // A hidden ancestor keeps the instance hidden when this part is shown.
          scope.instanceManager.setInstanceHidden(
            this.assetKey,
            this.instanceID,
            isEffectivelyHidden(this),
          );
        } else if (this.node) {
          this.node.visible = !value;
        } else if (wasHidden && !value) {
          buildWhenShown(this);
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

/**
 * The model of a part, loaded from a GLTF.
 *
 * Holds the 3D objects of exactly one part (group, placeholder, model): the server creates an
 * asset for each part (ThreejsGltf.createNode() on the server), scripts cannot pass an existing
 * asset object. An asset shared by several parts would be shown for the last built part only.
 */
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

    // Ensure group is initialised before trying to use it
    if (!this.group) {
      return;
    }

    // Dispose placeholder resources
    if (this.placeholder) {
      this.group.remove(this.placeholder);
      this.placeholder.geometry.dispose();
      this.placeholder.material.dispose();
      this.placeholder = null;
    }

    // Dispose previous cloned model's materials (geometries are shared with the GLTF cache)
    if (this._clonedModel) {
      this._clonedModel.traverse((obj) => {
        if (obj.isMesh) obj.material?.dispose();
      });
      this.group.remove(this._clonedModel);
      this._clonedModel = null;
    }

    const model = this.gltf.scene.clone();
    model.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        // Own materials per part: colours and transparency are set per part.
        const clones = materialsOf(obj).map((material) => {
          const clone = material.clone();
          clone.userData.originalColor = clone.color.clone();
          return clone;
        });
        obj.material = Array.isArray(obj.material) ? clones : clones[0];
      }
    });
    this._clonedModel = model;
    this.group.add(model);

    // The model keeps the colours of its materials unless the scene colours the part or it is
    // selected. The colour of the placeholder must not be taken over: it would overwrite the
    // colours of all materials (and of the point markers).
    ctrl.restoreColor(this.group);
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

  /** Shows the placeholder as a red wire frame: the GLTF of this asset could not be loaded. */
  markLoadFailed() {
    this.loadFailed = true;
    if (this.placeholder) {
      markFailedPlaceholder(this.placeholder);
    }
  }

  dispose() {
    if (this.placeholder) {
      this.placeholder.geometry.dispose();
      this.placeholder.material.dispose();
      this.placeholder = null;
    }
    if (this._clonedModel) {
      this._clonedModel.traverse((obj) => {
        if (obj.isMesh) obj.material?.dispose();
      });
      this._clonedModel = null;
    }
    this.layoutPoint?.dispose();
    this.snappingPoints?.forEach((point) => point.dispose());
    this.group = null;
  }
}

/**
 * An asset showing a box of the given size (protocol type Cube), with layout and snapping
 * points like a GLTF asset.
 */
export class Cube extends GltfAsset {
  constructor(id) {
    super(id);
  }

  build(parentGroup) {
    const group = super.build(parentGroup);
    const material = new MeshStandardMaterial();
    material.userData.originalColor = material.color.clone();
    this.box = new Mesh(this.boxGeometry(), material);
    group.add(this.box);
    return group;
  }

  loadJson(scope, json) {
    super.loadJson(scope, json);
    this.setProperty(scope, "width", json.width);
    this.setProperty(scope, "height", json.height);
    this.setProperty(scope, "depth", json.depth);
  }

  setProperty(scope, property, value) {
    switch (property) {
      case "width":
      case "height":
      case "depth":
        this[property] = value;
        if (this.box) {
          this.box.geometry.dispose();
          this.box.geometry = this.boxGeometry();
        }
        break;
      default:
        super.setProperty(scope, property, value);
        break;
    }
  }

  /** The box in the z-up coordinates of the scene: the height is along z. */
  boxGeometry() {
    return new BoxGeometry(this.width || 0, this.depth || 0, this.height || 0);
  }

  dispose() {
    if (this.box) {
      this.box.geometry.dispose();
      this.box.material.dispose();
      this.box = null;
    }
    super.dispose();
  }
}

/** An object of a type this client does not know (see Scope.loadJson()); shows nothing. */
export class UnknownObject extends SharedObject {
  constructor(id) {
    super(id);
  }

  loadJson(scope, json) {}

  setProperty(scope, property, value) {}

  insertElementAt(scope, property, idx, value) {}

  removeElementAt(scope, property, idx) {}

  build(parentGroup) {
    const group = new Group();
    parentGroup.add(group);
    return group;
  }
}
