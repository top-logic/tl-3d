/**
 * Main class for managing 3D scenes using Three.js library.
 * Provides methods for initialising and controlling a 3D scene with various functionalities.
 */

import {
  AxesHelper,
  Box3,
  Box3Helper,
  Color,
  Frustum,
  Group,
  Matrix4,
  Scene,
  Sphere,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

import { OrbitControls } from "OrbitControls";
import { TransformControls } from "TransformControls";
import { gsap } from "gsap";
import { InsertElement, RemoveElement, SetProperty } from "./Commands.js";
import { Scope, SharedObject, GroupNode, PartNode } from "./DataModels.js";
import { NavigationCube } from "./NavigationCube.js";
import { RenderManager } from "./RenderManager.js";
import { SceneOctree } from "./SceneOctree.js";
import { SkyboxManager } from "./SkyboxManager.js";
import { InstancedSnappingPoints } from "./SnappingPoints.js";
import {
  CameraUtils,
  SceneUtils,
  applyColorToObject,
  getLocalMatrix,
  getMatrixDiff,
  getRaycaster,
  isDescendantOfAny,
  disposeOrbitControls,
  isPointMarker,
  materialsOf,
  rememberRootNode,
  sceneColor,
  throttle,
  toMatrix,
} from "./ThreeJsUtils.js";

import {
  ANTIALIAS_MAX_PIXEL_RATIO,
  CAMERA_MOVE_DURATION,
  C_P_RADIUS,
  CLICK_MAX_DURATION,
  CLICK_MAX_MOVE,
  GREEN,
  GRID_SMALL_CELL,
  GRID_SNAP_THRESHOLD,
  HEIGHT_SEGMENTS,
  INSTANCING_BVH_TRIANGLE_THRESHOLD,
  OPTIMIZED_PIXEL_RATIO,
  SELECTION_COLOR,
  SNAP_THRESHOLD,
  TRANSPARENCY_LEVEL,
  WHITE,
  WIDTH_SEGMENTS,
  YELLOW,
  ZOOM_SPEED,
  _90_DEGREE,
} from "./Constants.js";

/**
 * The nearest grid line of the workplane, if the value is close enough to it (within
 * GRID_SNAP_THRESHOLD), otherwise the value itself.
 */
function snapToGridLine(value) {
  const nearest = Math.round(value / GRID_SMALL_CELL) * GRID_SMALL_CELL;
  return Math.abs(value - nearest) <= GRID_SNAP_THRESHOLD ? nearest : value;
}

/** Whether the given object and all its ancestors are visible. */
function isShown(object) {
  for (let o = object; o != null; o = o.parent) {
    if (!o.visible) {
      return false;
    }
  }
  return true;
}

/**
 * The hits of the given ray on the shown objects below the given roots that can be picked, the
 * nearest first. Hidden subtrees, instanced and impostor meshes (picked by their instances, see
 * raycastInstancedMeshes()) and the workplane are not tested at all: testing them costs time
 * with every click (the merged triangles of an instanced asset, thousands of grid lines).
 */
function raycastPickable(raycaster, roots, excluded) {
  const hits = [];
  const visit = (object) => {
    if (
      !object.visible ||
      object.userData.isInstancedMesh ||
      object.userData.isImpostorMesh ||
      excluded.includes(object)
    ) {
      return;
    }
    object.raycast(raycaster, hits);
    for (const child of object.children) {
      visit(child);
    }
  };
  roots.forEach(visit);
  return hits.sort((a, b) => a.distance - b.distance);
}

/** The selectable scene node the given 3D object belongs to, or null. */
function selectableNodeOf(object) {
  for (let o = object; o != null; o = o.parent) {
    const sharedNode = o.userData?.nodeRef;
    if (sharedNode instanceof SharedObject && sharedNode.selectable) {
      return sharedNode;
    }
  }
  return null;
}

/**
 * Initial state configuration for ThreeJsControl.
 * @typedef {Object} ThreeJsControlState
 * @property {string} controlId - The ID of the control element.
 * @property {string} contextPath - The context path for loading resources.
 * @property {string} dataUrl - The URL to fetch the scene data.
 * @property {string} imageUrl - Base URL to fetch the dynamic image data.
 * @property {boolean} isWorkplaneVisible - Visibility state of the workplane.
 * @property {boolean} isSkyboxVisible - Visibility state of the Skybox.
 * @property {boolean} isInEditMode - State of the edit mode.
 * @property {boolean} isRotateMode - State of the rotate mode.
 * @property {boolean} areObjectsTransparent - State of selection mode: opaque/transparent.
 */
class ThreeJsControl {
  /**
   * Constructs a new instance of the ThreeJsControl class.
   * @param {ThreeJsControlState} initialState - Initial state configuration.
   */
  constructor(initialState) {
    this.prevClosestSnappingPoint = null;
    this.controlId = initialState.controlId;
    this.contextPath = initialState.contextPath;
    this.dataUrl = initialState.dataUrl;
    this.imageUrl = initialState.imageUrl;
    this.scope = new Scope();
    this.scope.ctrl = this;

    this.zUpRoot = new Group();
    this.zUpEnvironment = new Group();
    this.multiTransformGroup = new Group();
    this.areObjectsTransparent = initialState.areObjectsTransparent;
    this.useScreenSpaceSnapping = true;

    this.skyboxManager = new SkyboxManager(this);
    this.initScene();
    this.initRenderer();
    this.initControls();

    this.renderManager = new RenderManager(
      this.renderer,
      this.scene,
      this.camera,
    );
    this.renderManager.beforeRender = () => this.updateClippingPlanes();

    this.impostorManager = null;

    this.sceneOctree = null;

    // Snapping points of instanced parts, built in edit mode.
    this.instancedSnappingPoints = new InstancedSnappingPoints(this.zUpRoot);

    this.initTransformControls();
    this.initNavigationCube();
    // The cube follows the camera on changes; show the initial view direction at once.
    this.navigationCube.updateFromMainCamera();

    this.renderManager.setSceneOctree(this.sceneOctree);
    this.renderManager.setInstanceManager(this.scope.instanceManager);
    this.scope.instanceManager.setTransparentMode(this.areObjectsTransparent);

    // Initial render
    this.renderManager.forceRender();

    this.isEditMode = false;

    this.loadErrorMessage = initialState.loadErrorMessage;
    this.loadScene()
      .then(() =>
        setTimeout(() => {
          if (this.disposed) {
            return;
          }
          this.createBoundingBox();
          this.toggleWorkplane(initialState.isWorkplaneVisible);
          this.updateWorkplanePosition();
          this.toggleEditMode(initialState.isInEditMode);
          this.toggleRotateMode(initialState.isRotateMode);
          this.zoomOut();

          this.skyboxManager
            .initSkybox()
            .then(() =>
              this.skyboxManager.toggleSkybox(initialState.isSkyboxVisible),
            );
        }, 100),
      )
      .catch((error) => this.showLoadError(error));
  }

  /**
   * Reports that the scene could not be loaded (server error, expired session), instead of
   * leaving the view empty without a hint.
   */
  showLoadError(error) {
    console.error("3D viewer: loading the scene failed.", error);
    // Changes for a scene that is not loaded cannot be applied.
    this.pendingChanges = null;
    if (this.disposed || !this.container) {
      return;
    }
    const message = document.createElement("div");
    message.className = "tl3dLoadError";
    message.textContent = this.loadErrorMessage || String(error);
    Object.assign(message.style, {
      position: "absolute",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      maxWidth: "80%",
      padding: "1em 1.5em",
      background: "rgba(255, 255, 255, 0.9)",
      border: "1px solid #c00",
      color: "#c00",
      zIndex: "1001",
    });
    this.container.append(message);
  }

  initScene() {
    // Filled in loadScene().
    this.sceneGraph = null;
    // Scene changes received before the scene data is loaded, with their revision, see
    // loadScene().
    this.pendingChanges = [];
    this.selection = [];

    this.scene = new Scene();
    this.scene.background = new Color("skyblue");

    this.createCamera();
    this.addLights();
    this.addAxesHelper(this.scene);

    this.zUpRoot.rotation.x = -_90_DEGREE;
    this.scene.add(this.zUpRoot);
    this.scene.add(this.zUpEnvironment);
    // Skybox and floors are added and removed as a whole (see SkyboxManager.toggleSkybox()).
    this.zUpEnvironment.addEventListener("childadded", () => this.invalidateContentBounds());
    this.zUpEnvironment.addEventListener("childremoved", () => this.invalidateContentBounds());
    this.multiTransformGroup.rotation.x = -_90_DEGREE;
    this.scene.add(this.multiTransformGroup);
  }

  initRenderer() {
    const container = this.container;
    // Every frame is drawn completely, the drawing buffer need not be preserved (which would
    // cost a copy per frame on many GPUs).
    this.renderer = new WebGLRenderer({
      powerPreference: "high-performance",
      // Smooth the edges on normal screens. On high resolution screens, steps are hardly
      // visible, but multisampling would be expensive with up to OPTIMIZED_PIXEL_RATIO times
      // the pixels in both directions.
      antialias: window.devicePixelRatio < ANTIALIAS_MAX_PIXEL_RATIO,
    });

    this.renderer.setSize(container.clientWidth, container.clientHeight);

    // Adjust pixel ratio for performance (limit to 1.7 for high-DPI screens)
    const pixelRatio = Math.min(window.devicePixelRatio, OPTIMIZED_PIXEL_RATIO);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.autoUpdate = false;

    this.canvas = this.renderer.domElement;
    this.canvas.style.maxWidth = "100%";
    this.canvas.style.maxHeight = "100%";
    container.append(this.canvas);
    // update objects' size when the size of the canvas changes
    this.resizeObserver = this.createResizeObserver(this.canvas);
    this.resizeObserver.observe(this.canvas);
    // Removed in dispose(): three.js may keep the canvas (and with it its listeners) alive after
    // the renderer is disposed (a module wide texture caches the WebGL texture of each
    // renderer), the listeners must not keep this control and its scene alive.
    this.canvasListeners = new AbortController();
    const signal = this.canvasListeners.signal;
    this.canvas.addEventListener(
      "mousedown",
      (event) => this.onMouseDown(event),
      { signal },
    );
    this.canvas.addEventListener("mouseup", (event) => this.onMouseUp(event), {
      signal,
    });

    // The browser may drop the WebGL context (GPU reset, driver update, too many contexts,
    // a mobile device in the background). three.js keeps the context restorable and sets up
    // its state again when it comes back; the viewer must render what exists on the GPU only.
    this.canvas.addEventListener(
      "webglcontextlost",
      () => {
        // Disposing the control drops the context on purpose.
        if (!this.disposed) {
          console.warn("3D viewer: WebGL context lost, waiting for its restoration.");
          this.impostorManager?.onContextLost();
        }
      },
      { signal },
    );
    this.canvas.addEventListener(
      "webglcontextrestored",
      () => this.onContextRestored(),
      { signal },
    );

    // Create a MutationObserver to detect DOM changes that might affect layout
    this.mutationObserver = new MutationObserver(() => {
      this.updateRendererSize();
    });

    // Observe the container and its parent for attribute changes
    this.mutationObserver.observe(container, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    if (container.parentNode) {
      this.mutationObserver.observe(container.parentNode, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    }
  }

  initControls() {
    this.controls = rememberRootNode(
      new OrbitControls(this.camera, this.renderer.domElement),
    );
    this.controls.reset();
    // Zooming with the mouse wheel is done by the OrbitControls only.
    this.controls.enableZoom = true;
    this.controls.zoomSpeed = ZOOM_SPEED;
    this.controls.screenSpacePanning = true;


    // The user takes over the camera: stop a running flight (zoomToSelection, zoomOut),
    // which would otherwise move the camera back.
    this.controls.addEventListener("start", () => this.stopCameraAnimation());

    this.controls.addEventListener("change", () => {
      if (this.navigationCube) {
        this.navigationCube.updateFromMainCamera();
      }
      this.renderManager.onCameraMove();
    });
  }

  initNavigationCube() {
    this.navigationCube = new NavigationCube(
      this.container,
      this.renderManager,
      this.camera,
      this.controls,
    );
  }

  createCamera() {
    this.camera = CameraUtils.createMainCamera(this.container);
  }

  addLights() {
    SceneUtils.addStandardLights(this.scene);
  }

  toggleWorkplane(visible) {
    if (!this.boundingBox) {
      return;
    }

    if (!this.workplane) {
      const gridSize = this.workplaneSize();
      this.workplane = SceneUtils.createDetailedGrid(gridSize);
      this.workplane.userData.size = gridSize;
      this.snapToWorkplaneEnabled = true;
    }

    // Set before updateWorkplanePosition(), which only places a visible workplane.
    this.isWorkplaneVisible = visible;
    this.invalidateContentBounds();

    if (visible) {
      if (this.workplane.parent) {
        this.workplane.parent.remove(this.workplane);
      }
      this.zUpRoot.add(this.workplane);
      this.snapToWorkplaneEnabled = true;
      this.updateWorkplanePosition();
    } else {
      if (this.workplane.parent) {
        this.workplane.parent.remove(this.workplane);
      }
      this.snapToWorkplaneEnabled = false;
    }

    this.invalidate();
  }

  /** The edge length of the workplane for the current bounds of the scene. */
  workplaneSize() {
    const boxSize = new Vector3();
    this.boundingBox.getSize(boxSize);
    return Math.max(boxSize.x, boxSize.y, boxSize.z) * 1.2;
  }

  /**
   * Builds the workplane again when the scene has outgrown it or has become much smaller (the
   * size is fixed when the workplane is created).
   */
  fitWorkplane() {
    if (!this.workplane || !this.boundingBox || this.boundingBox.isEmpty()) {
      return;
    }
    const size = this.workplaneSize();
    const current = this.workplane.userData.size;
    if (size <= current && size >= current / 2) {
      return;
    }
    this.workplane.removeFromParent();
    this.workplane.traverse((object) => {
      object.geometry?.dispose();
      object.material?.dispose();
    });
    this.workplane = null;
    this.toggleWorkplane(this.isWorkplaneVisible);
  }

  updateWorkplanePosition() {
    if (!this.workplane || !this.isWorkplaneVisible) {
      return;
    }
    // Without a chosen coordinate system, the workplane lies in the world coordinates.
    const coordinateSystem = this.sceneGraph?.coordinateSystem;
    const matrixValues = coordinateSystem
      ? toMatrix(coordinateSystem)
      : new Matrix4();
    this.workplane.applyMatrix4(
      matrixValues.multiply(this.workplane.matrix.clone().invert()),
    );
    this.workplane.updateMatrixWorld(true);
    this.invalidateContentBounds();
    this.invalidate();
  }

  toggleSkybox(visible) {
    this.skyboxManager.toggleSkybox(visible);
  }

  initTransformControls() {
    const outer = this;
    this.translateControls = new TransformControls(
      this.camera,
      this.renderer.domElement,
    );
    this.translateControls.setMode("translate");
    this.translateControls.setSpace("local");
    this.scene.add(this.translateControls.getHelper());

    const updateRenderTransform = (function () {
      let lastMatrix = new Matrix4();
      let lastWorldMatrixes = {};
      // Snapshots of instanced descendant GPU matrices at drag start,
      // keyed by Three.js node id (or "_single" for single-select).
      // Each value is a Map from snapshotInstancedDescendantMatrices.
      // Stored on the instance so objectChange handlers can access it.
      outer._instanceSnapshots = {};

      return (event) => {
        // disable/enable orbit controls when drag starts/ends
        outer.controls.enabled = !event.value;
        outer.zUpRoot.updateMatrixWorld(true);

        const object = event.target.object;

        if (object === outer.multiTransformGroup) {
          // MULTI-SELECT MODE
          object.updateMatrixWorld(true);

          // drag started when event.value is true
          if (event.value) {
            lastWorldMatrixes = {};
            outer._instanceSnapshots = {};

            // The gizmo moves the group, not its children: the step size applies to the group.
            object.userData.dragStartPosition = object.position.clone();

            for (const node of outer.multiTransformGroup.children) {
              lastWorldMatrixes[node.id] = node.matrixWorld.clone();

              // Snapshot instanced descendant matrices for GroupNodes
              const sharedNode = outer.selection.find((s) => s.node === node);
              if (sharedNode instanceof GroupNode && outer.hasInstancedDescendants(sharedNode)) {
                node.userData.dragStartMatrix = node.matrixWorld.clone();
                outer._instanceSnapshots[node.id] = outer.snapshotInstancedDescendantMatrices(sharedNode);
              }
            }

            return;
          }

          // Apply step snapping to the movement of the group
          outer.snapToStepSize(object);
          object.updateMatrixWorld(true);

          // Apply grid snapping to each object in multi-select if both workplane and edit mode are enabled
          if (
            outer.isWorkplaneVisible &&
            outer.isEditMode &&
            outer.snapToWorkplaneEnabled
          ) {
            outer.multiTransformGroup.children.forEach((node) => {
              outer.snapObjectToWorkplane(node);
            });
          }

          // re-map multiTransformGroup children to array of commands
          const commands = outer.multiTransformGroup.children
            .map((node) => {
              // find the shared node in selection that corresponds to this Three.js node
              const sharedNode = outer.selection.find((s) => s.node === node);
              if (!sharedNode) return;

              if (!node.previousParent) {
                console.error("node.previousParent is undefined!");
                return;
              }

              const lastMtrx = lastWorldMatrixes[node.id];
              const currMtrx = node.matrixWorld;

              // save the world matrix of the previous parent
              const parentMtrx = node.previousParent.matrixWorld;

              // transform matrices into a local coordinate system relative to the previous parent node
              const lastLocalMtrx = getLocalMatrix(lastMtrx, parentMtrx);
              const currentLocalMtrx = getLocalMatrix(currMtrx, parentMtrx);

              // calculate difference in the local coordinate system
              const diff = getMatrixDiff(lastLocalMtrx, currentLocalMtrx);

              return sharedNode.notifyTransform(diff);
              // delete undefined if sharedNode is not found
            })
            .filter(Boolean);

          // Recompute GPU matrices for instanced descendants of any GroupNodes
          // (notifyTransform has already updated the data model transforms)
          for (const node of outer.multiTransformGroup.children) {
            const sharedNode = outer.selection.find((s) => s.node === node);
            if (sharedNode instanceof GroupNode && outer.hasInstancedDescendants(sharedNode)) {
              sharedNode.recomputeInstancedChildrenMatrices(outer.scope);
            }
          }

          outer.sendSceneChanges(commands);

          // Update the octree if any instanced matrices changed
          if (Object.keys(outer._instanceSnapshots).length > 0) {
            outer.updateSceneOctree(outer.selection);
          }
          outer._instanceSnapshots = {};
        } else {
          // SINGLE OBJECT MODE
          object.updateMatrixWorld(true);
          const currentMatrix = object.matrix.clone();

          if (event.value) {
            lastMatrix.copy(currentMatrix);
            // Store the starting position for incremental snapping
            object.userData.dragStartPosition = object.position.clone();

            // Snapshot instanced descendant matrices for GroupNodes
            const sharedObject = outer.selection[0];
            outer._instanceSnapshots = {};
            if (sharedObject instanceof GroupNode && outer.hasInstancedDescendants(sharedObject)) {
              // Store start matrix in zUpRoot-local space (matching instance matrix space)
              outer.zUpRoot.updateMatrixWorld(true);
              object.updateMatrixWorld(true);
              object.userData.dragStartMatrix = outer.zUpRoot.matrixWorld.clone().invert().multiply(object.matrixWorld);
              outer._instanceSnapshots._single = outer.snapshotInstancedDescendantMatrices(sharedObject);
            }
            return;
          }

          outer.snapObject(object);

          const sharedObject = outer.selection[0];

          if (sharedObject && sharedObject.willBeInstanced && object.userData.isInstanceProxy) {
            // INSTANCED PROXY MODE
            // Sync the final proxy matrix to the GPU texture for visual update
            outer.scope.instanceManager.updateInstanceMatrix(
              object.userData.assetKey,
              object.userData.instanceID,
              object.matrix,
            );

            // Convert the proxy's new position back to the PartNode's local
            // coordinate space. The instance matrix has all ancestor transforms
            // baked in, so we use parentWorldMatrix (computed at proxy creation)
            // to isolate the PartNode's own local transform.
            const parentWorldMatrix = object.userData.parentWorldMatrix;
            const newLocalMatrix = parentWorldMatrix.clone().invert().multiply(object.matrix);
            const oldLocalMatrix = toMatrix(sharedObject.transform);
            const diffMatrix = oldLocalMatrix.clone().invert().multiply(newLocalMatrix);

            const commands = [sharedObject.notifyTransform(diffMatrix)];
            outer.sendSceneChanges(commands);

            // Instance positions have changed
            outer.updateSceneOctree([sharedObject]);
          } else {
            // REGULAR (non-instanced) SINGLE OBJECT MODE
            const updatedMatrix = object.matrix.clone();
            const diffMatrix = new Matrix4();
            diffMatrix.copy(lastMatrix.clone().invert()).multiply(updatedMatrix);

            if (sharedObject) {
              const commands = [sharedObject.notifyTransform(diffMatrix)];
              outer.sendSceneChanges(commands);

              // Recompute GPU matrices for instanced descendants of GroupNodes
              if (sharedObject instanceof GroupNode && outer.hasInstancedDescendants(sharedObject)) {
                sharedObject.recomputeInstancedChildrenMatrices(outer.scope);
                outer.updateSceneOctree([sharedObject]);
              }
            }
          }

          outer._instanceSnapshots = {};
        }

        outer.invalidate();
      };
    })();

    this.translateControls.addEventListener(
      "dragging-changed",
      updateRenderTransform,
    );
    this.translateControls.addEventListener("dragging-changed", (event) => {
      if (event.value) {
        this.gizmoDragged = true;
      } else {
        // The snapping point marked while dragging is only a preview.
        this.clearSnappingHighlight();
        // The object may have left the bounds (zoomOut, clipping planes).
        this.createBoundingBox();
      }
    });

    this.translateControls.addEventListener("objectChange", (event) => {
      if (event.target.dragging) {
        const selectedObject = event.target.object;
        // Apply step snapping (for a multi-selection to the group, see dragging-changed)
        this.snapToStepSize(selectedObject);

        this.snapObjectToWorkplane(selectedObject);

        if (selectedObject === this.multiTransformGroup) {
          // Live preview: update instanced descendants for GroupNodes in the multi-select
          this._livePreviewInstancedDescendants(selectedObject, this._instanceSnapshots);
          this.invalidate();
          return;
        }

        // Live preview: sync proxy matrix to GPU texture during drag
        if (selectedObject.userData.isInstanceProxy) {
          this.scope.instanceManager.updateInstanceMatrix(
            selectedObject.userData.assetKey,
            selectedObject.userData.instanceID,
            selectedObject.matrix,
          );
        }

        // Live preview: update instanced descendants for a single GroupNode
        this._livePreviewInstancedDescendants(selectedObject, this._instanceSnapshots);

        this.setSnappingHighlight(
          this.throttledFindClosestSnappingPoint(selectedObject),
        );
      }
      this.invalidate();
    });

    this.rotateControls = new TransformControls(
      this.camera,
      this.renderer.domElement,
    );
    this.rotateControls.setMode("rotate");
    this.rotateControls.setSpace("local");
    this.scene.add(this.rotateControls.getHelper());
    this.rotateControls.addEventListener(
      "dragging-changed",
      updateRenderTransform,
    );
    this.rotateControls.addEventListener("dragging-changed", (event) => {
      if (event.value) {
        this.gizmoDragged = true;
        // The step size may have changed since the last drag.
        this.rotateControls.setRotationSnap(this.rotationSnap());
      } else {
        // The rotated object may reach beyond the bounds (zoomOut, clipping planes).
        this.createBoundingBox();
      }
    });
    this.rotateControls.addEventListener("objectChange", (event) => {
      if (event.target.dragging) {
        const selectedObject = event.target.object;
        // Apply step snapping (for a multi-selection to the group, see dragging-changed)
        this.snapToStepSize(selectedObject);

        if (selectedObject === this.multiTransformGroup) {
          // Live preview: update instanced descendants for GroupNodes in the multi-select
          this._livePreviewInstancedDescendants(selectedObject, this._instanceSnapshots);
          this.invalidate();
          return;
        }

        // Live preview: sync proxy matrix to GPU texture during drag
        if (selectedObject.userData.isInstanceProxy) {
          this.scope.instanceManager.updateInstanceMatrix(
            selectedObject.userData.assetKey,
            selectedObject.userData.instanceID,
            selectedObject.matrix,
          );
        }

        // Live preview: update instanced descendants for a single GroupNode
        this._livePreviewInstancedDescendants(selectedObject, this._instanceSnapshots);
      }

      this.invalidate();
    });

    this.translateControls.enabled = false;
    this.rotateControls.enabled = false;
  }

  updateTransformControls() {
    // hides transform controls
    this.deactivateControl();
    // restores original object positions in the sceneGraph (zUpRoot group)
    this.restoreMultiGroup();

    if (this.isEditMode && this.selection.length) {
      // ONE OBJECT SELECTED
      if (this.selection.length === 1) {
        const object = this.selection[0].node;
        if (object) {
          this.activateControl(object);
        } else {
          console.warn("Single object not found in selection[0]");
        }
      }
      // MULTIPLE OBJECTS SELECTED
      else {
        this.prepareMultiGroup();
        if (this.multiTransformGroup) {
          this.activateControl(this.multiTransformGroup);
        } else {
          console.warn("multiTransformGroup not prepared properly");
        }
      }
    }
  }

  prepareMultiGroup() {
    // remove all children from multiTransformGroup
    this.multiTransformGroup.clear();

    // reset group position to 0,0,0 before moving selected nodes in it
    this.multiTransformGroup.position.set(0, 0, 0);
    this.multiTransformGroup.updateMatrixWorld(true);

    // update matrixWorld for all nodes in the sceneGraph including selected ones
    this.zUpRoot.updateMatrixWorld(true);

    // Collect the GroupNodes in selection (needed for data-model ancestor filtering)
    const selectedGroupNodes = this.selection.filter(
      (s) => s instanceof GroupNode,
    );

    // Filter out instanced PartNodes whose ancestor GroupNode is also selected.
    // Proxies are NOT Three.js descendants of the GroupNode, so isDescendantOfAny
    // won't catch them — we must check the data model parent chain instead.
    const filteredSelection = this.selection.filter((s) => {
      if (!s.willBeInstanced) return true;
      // Walk data model parent chain to see if any selected GroupNode is an ancestor
      let ancestor = s.parent;
      while (ancestor) {
        if (selectedGroupNodes.includes(ancestor)) return false;
        ancestor = ancestor.parent;
      }
      return true;
    });

    // get actual Three.js nodes from filtered selection
    const selectedNodes = filteredSelection.map((s) => s.node);

    // filter out nodes that are descendants of others to avoid duplicates in the transform group
    const topLevelNodes = selectedNodes.filter(
      (node) => node && !isDescendantOfAny(node, selectedNodes),
    );

    if (topLevelNodes.length === 0) return;

    const firstNode = topLevelNodes[0];

    const multiGroupMatrix = new Matrix4()
      .copy(firstNode.matrixWorld)
      .multiply(this.multiTransformGroup.matrix.clone().invert());

    this.multiTransformGroup.applyMatrix4(multiGroupMatrix);
    this.multiTransformGroup.updateMatrixWorld(true);

    for (const node of topLevelNodes) {
      // save the current parent to be able to restore the node in zUpRoot later
      node.previousParent = node.parent;
      const worldMatrix = node.matrixWorld.clone();

      // add the object to multiTransformGroup
      this.multiTransformGroup.add(node);

      // calculate the local matrix of the node relative to the new group so that it does not move visually
      const inverseGroupMatrix = new Matrix4()
        .copy(this.multiTransformGroup.matrixWorld)
        .invert();
      const localMatrix = new Matrix4()
        .multiplyMatrices(inverseGroupMatrix, worldMatrix)
        .multiply(node.matrix.clone().invert());

      node.applyMatrix4(localMatrix);
    }
  }

  restoreMultiGroup() {
    this.multiTransformGroup.updateMatrixWorld(true);

    for (const node of this.multiTransformGroup.children.slice()) {
      // if node was moved from zUpRoot to multiTransformGroup
      // then .previousParent should be defined and point to the previous parent node in zUpRoot
      if (node.previousParent) {
        const worldMatrix = node.matrixWorld.clone();

        node.previousParent.add(node);
        node.updateMatrixWorld(true);

        const parentInverse = new Matrix4()
          .copy(node.parent.matrixWorld)
          .invert();
        const localMatrix = new Matrix4()
          .multiplyMatrices(parentInverse, worldMatrix)
          .multiply(node.matrix.clone().invert());

        node.applyMatrix4(localMatrix);

        delete node.previousParent;
      } else {
        console.error(`Node ${node.name} has no previousParent`);
      }
    }

    // after all nodes are moved back to zUpRoot we can clear the group
    this.multiTransformGroup.clear();
  }

  get transformControls() {
    return this.isRotateMode ? this.rotateControls : this.translateControls;
  }

  activateControl(object) {
    if (object) {
      this.transformControls.enabled = true;
      this.transformControls.attach(object);
      this.invalidate();
    }
  }

  deactivateControl() {
    this.transformControls.enabled = false;
    this.transformControls.detach();
    this.invalidate();
  }

  toggleEditMode(editing) {
    this.isEditMode = editing;
    if (editing) {
      this.enableEditing();
    } else {
      this.disableEditing();
    }

    this.updateConnectionPointsVisibility();
    this.refreshInstancedSnappingPoints();

    this.invalidate();
  }

  updateConnectionPointsVisibility() {
    // Get the currently selected objects
    const selectedNodes = this.selection.map((s) => s.node);

    const updateVisibility = (object) => {
      if (object.userData.isConnectionPoint) {
        object.visible = this.isEditMode;
      }
      if (object.userData.isLayoutPoint) {
        const parentObject = findParentObject(object);
        object.visible =
          this.isEditMode && selectedNodes.includes(parentObject);
      }
    };

    function findParentObject(layoutPoint) {
      let current = layoutPoint;
      while (current && current.parent) {
        // Check for asset either directly or through nodeRef
        const parentAsset =
          current.parent?.userData?.asset ||
          current.parent?.userData?.nodeRef?.asset;
        if (current.parent.userData && parentAsset) {
          return current.parent;
        }
        current = current.parent;
      }
      return null;
    }

    this.zUpRoot.traverse(updateVisibility);
    this.multiTransformGroup.traverse(updateVisibility);
  }

  enableEditing() {
    // Create proxies for any already-selected instanced nodes
    for (const s of this.selection) {
      if (s.willBeInstanced && !s.node) {
        this.createInstanceProxy(s);
      }
    }
    this.updateTransformControls();
  }

  disableEditing() {
    if (this.translateControls) {
      this.translateControls.detach();
      this.translateControls.enabled = false;
    }

    if (this.rotateControls) {
      this.rotateControls.detach();
      this.rotateControls.enabled = false;
    }

    // Remove proxies — they're only needed in edit mode
    for (const s of this.selection) {
      if (s.willBeInstanced) {
        this.removeInstanceProxy(s);
      }
    }

    this.updateTransformControls();
  }

  toggleRotateMode(enable) {
    // Keep the mode also outside the edit mode: the server sends it with the initial state,
    // and updateTransformControls() picks the gizmo by it when the edit mode is switched on.
    this.isRotateMode = enable;
    if (!this.isEditMode) {
      return;
    }

    if (enable) {
      this.translateControls.enabled = false;
      this.translateControls.detach();
    } else {
      this.rotateControls.enabled = false;
      this.rotateControls.detach();
    }

    this.updateTransformControls();
    this.invalidate();
  }

  getScreenSpaceDistance(pos1, pos2) {
    const screen1 = pos1.clone().project(this.camera);
    const screen2 = pos2.clone().project(this.camera);
    // In CSS pixels: the drawing buffer has more pixels on high resolution screens, which
    // would make the snapping threshold smaller there.
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    const x1 = ((screen1.x + 1) * width) / 2;
    const y1 = ((-screen1.y + 1) * height) / 2;
    const x2 = ((screen2.x + 1) * width) / 2;
    const y2 = ((-screen2.y + 1) * height) / 2;

    return Math.hypot(x2 - x1, y2 - y1);
  }

  findClosestSnappingPoint(selectedObj) {
    // Check if selectedObj has snapping points either directly or through nodeRef
    const selectedObjAsset =
      selectedObj?.userData?.asset || selectedObj?.userData?.nodeRef?.asset;

    if (!selectedObj) {
      return { closestSnappingPoint: null, closestSnappingPointObject: null };
    }

    // The dragged objects with all their descendants: neither their snapping points are targets
    // nor do they occupy a snapping point.
    const excludedNodes = this.selectedSceneNodes();
    const excludedObjects = this.draggedObjects(selectedObj, excludedNodes);

    // find all other objects in the scene that have snapping points
    const snappableObjects = [];

    this.zUpRoot.traverse((node) => {
      // Check for snapping points either directly or through nodeRef
      const nodeAsset = node?.userData?.asset || node?.userData?.nodeRef?.asset;

      if (
        !excludedObjects.has(node) &&
        nodeAsset &&
        nodeAsset.snappingPoints &&
        nodeAsset.snappingPoints.length > 0
      ) {
        snappableObjects.push(node);
      }
    });

    selectedObj.updateMatrixWorld(true);
    this.zUpRoot.updateMatrixWorld(true);

    // find the closest pair of snapping points
    let closestDistance = SNAP_THRESHOLD;
    let closestSnappingPoint = null;
    let closestSnappingPointObject = null;

    const selectedWorldPosition = new Vector3();
    selectedObj.getWorldPosition(selectedWorldPosition);

    // The world matrices of all objects were updated above (zUpRoot).
    for (const otherObject of snappableObjects) {

      // Get asset either directly or through nodeRef
      const otherObjectAsset =
        otherObject?.userData?.asset || otherObject?.userData?.nodeRef?.asset;

      for (const otherPoint of otherObjectAsset.snappingPoints) {
        const position = new Vector3();
        otherPoint.node.getWorldPosition(position);

        const distance = this.useScreenSpaceSnapping
          ? this.getScreenSpaceDistance(selectedWorldPosition, position)
          : selectedWorldPosition.distanceTo(position);

        if (distance < closestDistance) {
          if (this.isPositionOccupied(position, excludedObjects, excludedNodes)) {
            continue;
          }

          closestDistance = distance;
          closestSnappingPoint = otherPoint;
          closestSnappingPointObject = otherObject;
        }
      }
    }

    // Snapping points of instanced parts, except those of the dragged parts.
    let instancedSnappingPoint = null;
    const entries = this.instancedSnappingPoints.entries;
    const parentMatrixWorld = this.zUpRoot.matrixWorld;
    for (let i = 0; i < entries.length; i++) {
      if (excludedNodes.has(entries[i].partNode)) {
        continue;
      }
      const position = new Vector3()
        .setFromMatrixPosition(entries[i].matrix)
        .applyMatrix4(parentMatrixWorld);
      const distance = this.useScreenSpaceSnapping
        ? this.getScreenSpaceDistance(selectedWorldPosition, position)
        : selectedWorldPosition.distanceTo(position);
      if (distance < closestDistance) {
        if (this.isPositionOccupied(position, excludedObjects, excludedNodes)) {
          continue;
        }
        closestDistance = distance;
        instancedSnappingPoint = i;
        closestSnappingPoint = null;
        closestSnappingPointObject = null;
      }
    }

    const threshold = SNAP_THRESHOLD;
    return closestDistance < threshold
      ? { closestSnappingPoint, closestSnappingPointObject, instancedSnappingPoint }
      : {
          closestSnappingPoint: null,
          closestSnappingPointObject: null,
          instancedSnappingPoint: null,
        };
  }

  // throttled version of findClosestSnappingPoint
  throttledFindClosestSnappingPoint = throttle((selectedObject) => {
    return this.findClosestSnappingPoint(selectedObject);
  }, 100);

  /**
   * Marks the snapping point closest to the dragged object, as found by
   * findClosestSnappingPoint().
   */
  setSnappingHighlight({ closestSnappingPoint, instancedSnappingPoint }) {
    const key =
      closestSnappingPoint ??
      (instancedSnappingPoint != null ? "instanced:" + instancedSnappingPoint : null);
    if (key === this.snappingHighlightKey) {
      return;
    }
    this.clearSnappingHighlight();
    this.snappingHighlightKey = key;

    if (closestSnappingPoint) {
      closestSnappingPoint.pointMaterial.color.set(YELLOW);
      const mesh = closestSnappingPoint.node.children[0];
      if (mesh && mesh.isMesh) {
        const highResGeometry = new SphereGeometry(
          C_P_RADIUS * 1.5,
          WIDTH_SEGMENTS,
          HEIGHT_SEGMENTS,
        );
        if (!mesh.userData.originalGeometry) {
          mesh.userData.originalGeometry = mesh.geometry;
        }
        mesh.geometry = highResGeometry;
      }
      this.prevClosestSnappingPoint = closestSnappingPoint;
    } else if (instancedSnappingPoint != null) {
      this.instancedSnappingPoints.highlight(instancedSnappingPoint);
    }
    this.invalidate();
  }

  /** Removes the mark of the snapping point closest to the dragged object. */
  clearSnappingHighlight() {
    if (this.prevClosestSnappingPoint) {
      this.restoreSnappingPointColor(this.prevClosestSnappingPoint);
      this.prevClosestSnappingPoint = null;
    }
    this.instancedSnappingPoints.clearHighlight();
    this.snappingHighlightKey = null;
    this.invalidate();
  }

  /**
   * Rebuilds the snapping points of instanced parts in edit mode (their positions may have
   * changed), removes them otherwise.
   */
  refreshInstancedSnappingPoints() {
    if (this.isEditMode && this.sceneGraph) {
      this.instancedSnappingPoints.rebuild(
        this.scope.instanceManager,
        this.sceneGraph.root,
      );
    } else {
      this.instancedSnappingPoints.dispose();
    }
    this.snappingHighlightKey = null;
    this.invalidate();
  }

  /** The selected scene nodes and all their descendants. */
  selectedSceneNodes() {
    const nodes = new Set();
    const add = (node) => {
      nodes.add(node);
      node.contents?.forEach(add);
    };
    this.selection.forEach(add);
    return nodes;
  }

  restoreSnappingPointColor(snappingPoint) {
    if (!snappingPoint) return;

    if (snappingPoint.pointMaterial) {
      if (snappingPoint.pointMaterial.userData.originalColor) {
        snappingPoint.pointMaterial.color.copy(
          snappingPoint.pointMaterial.userData.originalColor,
        );
      } else {
        snappingPoint.pointMaterial.color.set(GREEN);
      }
    }
    const mesh = snappingPoint.node.children[0];
    if (mesh && mesh.isMesh && mesh.userData.originalGeometry) {
      mesh.geometry.dispose();
      mesh.geometry = mesh.userData.originalGeometry;
      delete mesh.userData.originalGeometry;
    }
  }

  snapToStepSize(obj) {
    const translateStepSize = this.sceneGraph.translateStepSize;
    const startPos = obj.userData.dragStartPosition;

    if (startPos && translateStepSize > 0) {
      const stepsX = Math.round(
        (obj.position.x - startPos.x) / translateStepSize,
      );
      const stepsY = Math.round(
        (obj.position.y - startPos.y) / translateStepSize,
      );
      const stepsZ = Math.round(
        (obj.position.z - startPos.z) / translateStepSize,
      );

      obj.position.set(
        startPos.x + stepsX * translateStepSize,
        startPos.y + stepsY * translateStepSize,
        startPos.z + stepsZ * translateStepSize,
      );
    }

    // The rotation is snapped by the rotate gizmo (see rotationSnap()): it rounds the angle about
    // the dragged axis. Rounding the Euler angles one by one would tilt the axis of a rotation
    // about a local x or y axis of an object that is already rotated.
  }

  /** The step of the rotate gizmo in radians, null for free rotation. */
  rotationSnap() {
    const rotateStepSize = this.sceneGraph?.rotateStepSize;
    return rotateStepSize > 0 ? (rotateStepSize * Math.PI) / 180 : null;
  }

  snapObjectToWorkplane(object) {
    if (!this.snapToWorkplaneEnabled || !this.workplane) {
      return false;
    }

    object.updateMatrixWorld(true);

    const worldPosition = new Vector3();
    object.getWorldPosition(worldPosition);

    // The workplane lies in the x-y plane of the chosen coordinate system (see
    // updateWorkplanePosition()), with grid lines at multiples of GRID_SMALL_CELL: work in
    // that coordinate system.
    this.workplane.updateMatrixWorld(true);
    const workplaneMatrix = this.workplane.matrixWorld;
    const positionOnWorkplane = worldPosition
      .clone()
      .applyMatrix4(workplaneMatrix.clone().invert());

    const distanceToWorkplane = Math.abs(positionOnWorkplane.z);
    const MAX_SNAP_DISTANCE = 200;

    // An object released near the workplane is put onto it and snapped to the grid.
    if (distanceToWorkplane <= MAX_SNAP_DISTANCE) {
      positionOnWorkplane.z = 0;
      if (this.isWorkplaneVisible && this.isEditMode) {
        // Snap to the nearby grid lines.
        positionOnWorkplane.x = snapToGridLine(positionOnWorkplane.x);
        positionOnWorkplane.y = snapToGridLine(positionOnWorkplane.y);
      }
      const snappedPosition = positionOnWorkplane.applyMatrix4(workplaneMatrix);

      const snapMatrix = new Matrix4().makeTranslation(
        snappedPosition.x - worldPosition.x,
        snappedPosition.y - worldPosition.y,
        snappedPosition.z - worldPosition.z,
      );

      // Apply the translation in world space
      if (object.parent) {
        object.parent.updateMatrixWorld(true);

        // Convert world space translation to object's local space
        const parentWorldInverse = new Matrix4()
          .copy(object.parent.matrixWorld)
          .invert();
        const localSnapMatrix = new Matrix4()
          .copy(parentWorldInverse)
          .multiply(snapMatrix)
          .multiply(object.parent.matrixWorld);

        object.applyMatrix4(localSnapMatrix);
      }

      object.updateMatrixWorld(true);
      return true;
    }

    return false;
  }


  /**
   * The 3D objects of a drag: the dragged object and the objects of the selected scene nodes,
   * each with all descendants.
   */
  draggedObjects(selectedObj, selectedNodes) {
    const objects = new Set();
    const add = (object) => object.traverse((o) => objects.add(o));
    add(selectedObj);
    for (const node of selectedNodes) {
      if (node.node) {
        add(node.node);
      }
    }
    return objects;
  }

  /**
   * Whether a part (other than the excluded 3D objects and scene nodes) is placed at the given
   * world position, i.e. a snapping point there is occupied.
   */
  isPositionOccupied(position, excludedObjects, excludedNodes) {
    const checkRadius = 50;

    // Instanced parts have no 3D objects; their positions are the instance matrices.
    const instanceManager = this.scope.instanceManager;
    const parentMatrixWorld = this.zUpRoot.matrixWorld;
    const instancePosition = new Vector3();
    for (const [assetKey, data] of instanceManager.managedMeshes) {
      if (assetKey.endsWith("_impostor")) continue;
      for (const instance of data.instanceData) {
        if (!instance.partNode || excludedNodes.has(instance.partNode)) continue;
        if (instanceManager.isInstanceHidden(assetKey, instance.id)) continue;
        instancePosition
          .setFromMatrixPosition(instance.matrix)
          .applyMatrix4(parentMatrixWorld);
        if (instancePosition.distanceTo(position) < checkRadius) {
          return true;
        }
      }
    }

    // Find all objects near this connection point
    const nearbyObjects = [];

    this.zUpRoot.traverse((node) => {
      // Skip the objects being moved (traverse visits their descendants, too)
      if (excludedObjects.has(node)) {
        return;
      }

      // Skip spheres and other non-snappable objects
      if (
        node.userData?.isSphere ||
        node.userData?.isGrid ||
        node.userData?.isHelper ||
        (!node.userData?.asset && !node.userData?.nodeRef?.asset)
      ) {
        return;
      }

      // Check if this object is close to the connection point
      const nodePosition = new Vector3();
      node.getWorldPosition(nodePosition);

      // Use 3D distance for proximity check
      const distance = position.distanceTo(nodePosition);

      if (distance < checkRadius) {
        nearbyObjects.push(node);
      }
    });

    const isOccupied = nearbyObjects.length > 0;
    return isOccupied;
  }

  snapObject(selectedObj) {
    // Not throttled: the decision must be based on the position where the object was released.
    const {
      closestSnappingPoint,
      closestSnappingPointObject,
      instancedSnappingPoint,
    } = this.findClosestSnappingPoint(selectedObj);

    let snappingPointWorldMatrix = null;
    if (closestSnappingPoint && closestSnappingPointObject) {
      closestSnappingPointObject.updateMatrixWorld(true);
      closestSnappingPoint.node.updateMatrixWorld(true);
      snappingPointWorldMatrix = closestSnappingPoint.node.matrixWorld.clone();
    } else if (instancedSnappingPoint != null) {
      snappingPointWorldMatrix = this.instancedSnappingPoints.worldMatrix(
        instancedSnappingPoint,
      );
    }

    if (snappingPointWorldMatrix) {
      selectedObj.updateMatrixWorld(true);

      // convert the world matrix to a local matrix
      if (selectedObj.parent) {
        selectedObj.parent.updateMatrixWorld(true);

        // get the inverse of the parent's world matrix
        const parentWorldInverse = new Matrix4()
          .copy(selectedObj.parent.matrixWorld)
          .invert();
        snappingPointWorldMatrix.premultiply(parentWorldInverse);
      }
      selectedObj.applyMatrix4(
        snappingPointWorldMatrix.multiply(selectedObj.matrix.clone().invert()),
      );
      selectedObj.updateMatrixWorld(true);
    } else if (this.snapToWorkplaneEnabled) {
      this.snapObjectToWorkplane(selectedObj);
    }

    this.invalidate();
  }

  addAxesHelper(scene) {
    const axesHelper = new AxesHelper(1000);
    scene.add(axesHelper);
    axesHelper.rotation.x = -_90_DEGREE;
  }

  /**
   * Computes the bounding box of the scene (used by zoomOut() and for the size of the
   * workplane). Instanced meshes count with the bounds of all their instances; impostors are
   * left out (their geometry is a quad at the origin).
   */
  createBoundingBox() {
    this.invalidateContentBounds();
    // The bounds of the instanced meshes only grow while instances are moved.
    for (const assetKey of this.scope.instanceManager.managedMeshes.keys()) {
      if (!assetKey.endsWith("_impostor")) {
        this.scope.instanceManager.updateBounds(assetKey);
      }
    }
    this.boundingBox = new Box3();
    this.zUpRoot.updateMatrixWorld(true);
    this.zUpRoot.traverse((object) => {
      if (object.type === "Mesh" && !object.userData.isImpostorMesh) {
        this.boundingBox.expandByObject(object);
      }
    });
    this.fitWorkplane();
    this.skyboxManager?.fitToScene();
  }

  /**
   * Fits the near and far clipping planes of the camera to the displayed content.
   *
   * The depth buffer resolves a ratio far / near of about 1e5 (24 bit); fixed planes for all
   * scene sizes make distant parts flicker (z-fighting) or cut off objects close to the camera.
   * The far plane lies just behind the content; the near plane just in front of it when the
   * camera is outside, otherwise at a small fraction of the distance to the orbit target.
   */
  updateClippingPlanes() {
    const sphere = this.contentSphere();
    if (!sphere) {
      return;
    }

    const position = this.camera.position;
    const distance = position.distanceTo(sphere.center);
    // Margin for objects moved beyond the bounds that are not yet updated.
    const far = (distance + sphere.radius) * 1.5;
    // Inside the content, a part may be close to the camera although the orbit target is far
    // away: at most NEAR_PLANE_INSIDE_MAX in front of the camera is cut off.
    // Outside the content, the near plane lies in front of it, with a margin for an object
    // that is dragged towards the camera beyond the bounds (updated when the drag ends).
    const margin = sphere.radius * 0.5;
    const near = Math.max(
      far * 1e-5,
      distance > sphere.radius + margin
        ? (distance - sphere.radius - margin) * 0.9
        : Math.min(
            position.distanceTo(this.controls.target) * 0.01,
            NEAR_PLANE_INSIDE_MAX,
          ),
    );

    if (this.camera.near !== near || this.camera.far !== far) {
      this.camera.near = near;
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }
  }

  /**
   * The bounding sphere of the displayed content (parts, skybox, floors, workplane), or null if
   * there is none. Computed only after a change (see invalidateContentBounds()), not for every
   * frame.
   */
  contentSphere() {
    if (this._contentSphere === undefined) {
      const content = new Box3();
      if (this.boundingBox) {
        content.union(this.boundingBox);
      }
      // Skybox, floors and workplane extend beyond the parts.
      content.union(new Box3().setFromObject(this.zUpEnvironment));
      if (this.workplane?.parent) {
        content.union(new Box3().setFromObject(this.workplane));
      }
      this._contentSphere = content.isEmpty()
        ? null
        : content.getBoundingSphere(new Sphere());
    }
    return this._contentSphere;
  }

  /** The displayed content has changed its bounds, see contentSphere(). */
  invalidateContentBounds() {
    this._contentSphere = undefined;
  }

  /** Renders the scene again after the WebGL context has been restored. */
  onContextRestored() {
    if (this.disposed) {
      return;
    }
    this.scope.instanceManager.onContextRestored();
    this.scope.regenerateImpostors(this);
    this.renderManager.forceRender();
  }

  createResizeObserver() {
    const resize = throttle(() => {
      this.updateRendererSize();
    }, 100);
    return new ResizeObserver(() => {
      // Removing the container from the document shrinks the canvas to zero, so the
      // observer also notices that the view has been closed or rendered again. Release the
      // WebGL contexts and GPU memory right away instead of waiting for the next viewer.
      if (!this.container?.isConnected) {
        disposeDetachedControls();
        return;
      }
      resize();
    });
  }

  updateRendererSize() {
    // A throttled call may arrive after the control has been disposed.
    if (!this.container || this.disposed) return;

    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight,
    );
    this.camera.aspect =
      this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();

    // Update navigation cube size if it exists
    if (this.navigationCube) {
      this.navigationCube.updateSize();
    }

    this.invalidate();
  }

  onMouseDown(event) {
    this.clickStart = Date.now();
    this.clickButton = event.button;
    this.clickX = event.clientX;
    this.clickY = event.clientY;
    // Pressing on a handle of the gizmo starts a transformation, not a click on the object
    // behind it. The handle under the pointer is known from the preceding hover.
    this.clickOnGizmo =
      this.translateControls?.axis != null || this.rotateControls?.axis != null;
    this.gizmoDragged = false;
  }

  onMouseUp(event) {
    if (this.clickButton != 0) {
      return; // Not click with middle mouse button.
    }
    if (Date.now() - this.clickStart > CLICK_MAX_DURATION) {
      return; // Not a click.
    }
    const moved = Math.hypot(
      event.clientX - this.clickX,
      event.clientY - this.clickY,
    );
    if (moved > CLICK_MAX_MOVE) {
      return; // The view was dragged.
    }
    if (this.clickOnGizmo || this.gizmoDragged) {
      return; // The gizmo was used.
    }
    const raycaster = getRaycaster(event, this.camera, this.canvas);
    const toggleMode = event.ctrlKey || event.metaKey;

    // Nearest shown and selectable regular object: parts are below zUpRoot, or in
    // multiTransformGroup while a multi-selection is moved.
    const regularHit = raycastPickable(
      raycaster,
      [this.zUpRoot, this.multiTransformGroup],
      [this.workplane],
    ).find((hit) => isShown(hit.object) && selectableNodeOf(hit.object) != null);

    // Nearest instance; the nearer of both is selected.
    const instancedHit = this.raycastInstancedMeshes(raycaster);
    if (
      instancedHit &&
      (!regularHit || instancedHit.distance < regularHit.distance)
    ) {
      this.updateSelectionInstanced(instancedHit.partNode, toggleMode);
    } else if (regularHit) {
      this.updateSelection([regularHit], toggleMode);
    } else {
      // Clicked empty space — clear selection
      this.updateSelection([], toggleMode);
    }
    this.invalidate();
  }

  /**
   * Raycast against instanced meshes using octree (if available) or linear scan to find
   * candidates, which are then tested exactly against their geometry.
   * Returns {partNode, assetKey, instanceID, distance} for the closest hit, or null.
   */
  raycastInstancedMeshes(raycaster) {
    const instanceManager = this.scope.instanceManager;
    if (!instanceManager || instanceManager.managedMeshes.size === 0) {
      return null;
    }

    // Get candidates from octree or linear scan
    let candidates;
    if (this.sceneOctree) {
      candidates = this.sceneOctree.queryRay(raycaster.ray);
    } else {
      // Linear scan over all instances
      candidates = [];
      this.zUpRoot.updateMatrixWorld(true);
      const zUpTransform = this.zUpRoot.matrixWorld;
      for (const [assetKey, data] of instanceManager.managedMeshes) {
        if (assetKey.endsWith("_impostor")) continue;
        const baseBox = data.baseBoundingBox;
        if (!baseBox) continue;

        for (const instance of data.instanceData) {
          const instanceBox = baseBox.clone();
          instanceBox.applyMatrix4(instance.matrix);
          instanceBox.applyMatrix4(zUpTransform);

          if (raycaster.ray.intersectsBox(instanceBox)) {
            candidates.push({
              type: "instance",
              assetKey,
              instanceID: instance.id,
              boundingBox: instanceBox,
              partNode: instance.partNode,
            });
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    // Exact test against the geometry of each candidate; hidden instances are skipped.
    this.zUpRoot.updateMatrixWorld(true);
    let closest = null;
    for (const candidate of candidates) {
      const hit = instanceManager.raycastInstance(
        candidate.assetKey,
        candidate.instanceID,
        raycaster,
        this.zUpRoot.matrixWorld,
      );
      if (hit && (closest == null || hit.distance < closest.distance)) {
        closest = hit;
      }
    }
    return closest;
  }

  /**
   * Update selection from an instanced mesh click.
   */
  updateSelectionInstanced(partNode, toggleMode) {
    const changes = [];

    if (!toggleMode) {
      const clearCmd = this.clearSelection();
      if (clearCmd != null) {
        changes.push(clearCmd);
      }
    }

    if (partNode instanceof SharedObject && partNode.selectable) {
      const doSelect = toggleMode
        ? !this.selection.includes(partNode)
        : true;
      const setCmd = this.setSelected(partNode, doSelect);
      if (setCmd != null) {
        changes.push(setCmd);
      }
    }

    if (changes.length > 0) {
      this.sendSceneChanges(changes);
    }
  }

  /**
   * Create a proxy Object3D for an instanced PartNode so that TransformControls
   * can attach to it. The proxy is positioned at the instance's current world
   * location (derived from its GPU matrix in zUpRoot-local space). Setting
   * partNode.node = proxy allows the existing updateTransformControls() path
   * to work unchanged — it just calls activateControl(selection[0].node).
   */
  createInstanceProxy(partNode) {
    const data = this.scope.instanceManager.managedMeshes.get(partNode.assetKey);
    if (!data || !data.instanceData[partNode.instanceID]) {
      console.warn("Cannot create proxy: instance data not found");
      return;
    }

    const instanceMatrix = data.instanceData[partNode.instanceID].matrix.clone();
    const localTransform = toMatrix(partNode.transform);

    const proxy = new Group();
    proxy.name = `instanceProxy_${partNode.assetKey}_${partNode.instanceID}`;
    proxy.userData.isInstanceProxy = true;
    proxy.userData.assetKey = partNode.assetKey;
    proxy.userData.instanceID = partNode.instanceID;

    // parentWorldMatrix is the accumulated ancestor transforms (everything
    // baked into the instance matrix EXCEPT the PartNode's own local transform).
    // Stored at creation time for coordinate conversion during drag-end.
    proxy.userData.parentWorldMatrix = instanceMatrix.clone().multiply(
      localTransform.clone().invert(),
    );

    // Position the proxy at the instance's location in zUpRoot-local space
    proxy.applyMatrix4(instanceMatrix);
    this.zUpRoot.add(proxy);

    partNode.node = proxy;
  }

  /**
   * Remove a previously created instance proxy and clear the partNode.node ref.
   */
  removeInstanceProxy(partNode) {
    if (partNode.node && partNode.node.userData.isInstanceProxy) {
      partNode.node.removeFromParent();
      partNode.node = null;
    }
  }

  /**
   * Walk a node's descendants and call fn(partNode) for each instanced PartNode found.
   */
  forEachInstancedDescendant(node, fn) {
    if (node instanceof PartNode && node.willBeInstanced && node.assetKey != null) {
      fn(node);
    }
    if (node instanceof GroupNode && node.contents) {
      for (const child of node.contents) {
        this.forEachInstancedDescendant(child, fn);
      }
    }
  }

  /**
   * Check if a node (typically a GroupNode) has any instanced PartNode descendants.
   */
  hasInstancedDescendants(node) {
    if (node instanceof PartNode && node.willBeInstanced && node.assetKey != null) {
      return true;
    }
    if (node instanceof GroupNode && node.contents) {
      for (const child of node.contents) {
        if (this.hasInstancedDescendants(child)) return true;
      }
    }
    return false;
  }

  /**
   * Snapshot the current GPU matrices of all instanced descendants of a node.
   * Returns a Map of "assetKey:instanceID" -> Matrix4.
   * Used at drag start for delta-based live preview.
   */
  snapshotInstancedDescendantMatrices(node) {
    const snapshots = new Map();
    this.forEachInstancedDescendant(node, (pn) => {
      const data = this.scope.instanceManager.managedMeshes.get(pn.assetKey);
      if (data && data.instanceData[pn.instanceID]) {
        snapshots.set(
          pn.assetKey + ":" + pn.instanceID,
          { assetKey: pn.assetKey, instanceID: pn.instanceID, matrix: data.instanceData[pn.instanceID].matrix.clone() },
        );
      }
    });
    return snapshots;
  }

  /**
   * Apply a delta transform to all snapshotted instance matrices.
   * Used during drag for live preview of GroupNode movement on instanced descendants.
   */
  applyDeltaToInstanceSnapshots(delta, snapshots) {
    for (const { assetKey, instanceID, matrix } of snapshots.values()) {
      const newMatrix = delta.clone().multiply(matrix);
      this.scope.instanceManager.updateInstanceMatrix(assetKey, instanceID, newMatrix);
    }
  }

  /**
   * Live preview: apply delta transforms to instanced descendants during a drag.
   * Handles both single-select (one node) and multi-select (multiTransformGroup).
   * @param {Object3D} object - The dragged object (a single node or multiTransformGroup)
   * @param {Object} snapshots - Map of node.id or "_single" -> snapshot from snapshotInstancedDescendantMatrices
   */
  _livePreviewInstancedDescendants(object, snapshots) {
    if (!snapshots || Object.keys(snapshots).length === 0) return;

    if (object === this.multiTransformGroup) {
      // Multi-select: each child of multiTransformGroup may be a GroupNode
      for (const node of this.multiTransformGroup.children) {
        const snap = snapshots[node.id];
        if (!snap) continue;
        const startMatrix = node.userData.dragStartMatrix;
        if (!startMatrix) continue;
        node.updateMatrixWorld(true);
        const delta = node.matrixWorld.clone().multiply(startMatrix.clone().invert());
        this.applyDeltaToInstanceSnapshots(delta, snap);
      }
    } else {
      // Single-select
      const snap = snapshots._single;
      if (!snap) return;
      const startMatrix = object.userData.dragStartMatrix;
      if (!startMatrix) return;
      // Compute delta in zUpRoot-local space (matching instance matrix space)
      object.updateMatrixWorld(true);
      const currentZUpLocal = this.zUpRoot.matrixWorld.clone().invert().multiply(object.matrixWorld);
      const delta = currentZUpLocal.multiply(startMatrix.clone().invert());
      this.applyDeltaToInstanceSnapshots(delta, snap);
    }
  }

  /**
   * Compute a world-space bounding box for a selected node.
   * Handles instanced PartNodes, GroupNodes with instanced descendants,
   * and regular nodes with Three.js scene objects.
   */
  computeSelectionBoundingBox(node) {
    const instanceManager = this.scope.instanceManager;
    this.zUpRoot.updateMatrixWorld(true);
    const zUpTransform = this.zUpRoot.matrixWorld;

    if (node.willBeInstanced && node.assetKey != null) {
      // Single instanced PartNode
      const data = instanceManager.managedMeshes.get(node.assetKey);
      if (!data || !data.baseBoundingBox) return null;
      const instance = data.instanceData.find((d) => d.id === node.instanceID);
      if (!instance) return null;
      const box = data.baseBoundingBox.clone();
      box.applyMatrix4(instance.matrix);
      box.applyMatrix4(zUpTransform);
      return box;
    }

    if (node instanceof GroupNode && this.hasInstancedDescendants(node)) {
      // GroupNode: union of instanced descendants + any non-instanced node
      const box = new Box3();
      this.forEachInstancedDescendant(node, (pn) => {
        const data = instanceManager.managedMeshes.get(pn.assetKey);
        if (!data || !data.baseBoundingBox) return;
        const instance = data.instanceData.find((d) => d.id === pn.instanceID);
        if (!instance) return;
        const instanceBox = data.baseBoundingBox.clone();
        instanceBox.applyMatrix4(instance.matrix);
        instanceBox.applyMatrix4(zUpTransform);
        box.union(instanceBox);
      });
      // Also include the non-instanced Three.js node if it exists
      if (node.node) {
        box.union(new Box3().setFromObject(node.node));
      }
      return box.isEmpty() ? null : box;
    }

    // Non-instanced: use Three.js node directly
    if (node.node) {
      return new Box3().setFromObject(node.node);
    }
    return null;
  }

  zoomToSelection() {
    // All selected nodes, not only the first one.
    const boundingBox = new Box3();
    for (const selected of this.selection) {
      const box = this.computeSelectionBoundingBox(selected);
      if (box && !box.isEmpty()) {
        boundingBox.union(box);
      }
    }
    if (boundingBox.isEmpty()) return;

    const center = new Vector3();
    boundingBox.getCenter(center);

    const size = new Vector3();
    boundingBox.getSize(size);

    const maxSize = Math.max(size.x, size.y);
    const fov = this.camera.fov * (Math.PI / 180);
    // Distance from the front of the bounding box at which its width and height fit into the
    // view; the camera looks along -z.
    const targetDistance = maxSize / 2 / Math.tan(fov / 2);
    const targetPositionZ = center.z + size.z / 2 + targetDistance;

    this.stopCameraAnimation();
    gsap.to(this.controls.object.position, {
      x: center.x,
      // Looking a bit from the top, relative to the distance.
      y: center.y + targetDistance * VIEW_OFFSET,
      z: targetPositionZ,
      duration: CAMERA_MOVE_DURATION,
      ease: "power3.inOut",
      onUpdate: () => {
        this.controls.update();
        this.invalidate();
      },
    });

    gsap.to(this.controls.target, {
      x: center.x,
      y: center.y,
      z: center.z,
      duration: CAMERA_MOVE_DURATION,
      ease: "power3.inOut",
      onUpdate: () => {
        this.controls.update();
        this.invalidate();
      },
    });
    this.invalidate();
  }

  /**
   * Stops a running camera flight (zoomToSelection, zoomOut), so that a new one does not run
   * against it.
   */
  stopCameraAnimation() {
    gsap.killTweensOf([this.controls.object.position, this.controls.target]);
    // A flight started from the navigation cube moves the cube camera, which drives the main
    // camera.
    this.navigationCube?.stopCameraAnimation();
  }

  zoomOut() {
    if (!this.boundingBox) {
      return;
    }

    const center = new Vector3();
    this.boundingBox.getCenter(center);

    const size = new Vector3();
    this.boundingBox.getSize(size);

    const maxSize = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    const distance = maxSize / 2 / Math.tan(fov / 2);

    this.stopCameraAnimation();
    // Looking a bit at the right side and from the top, relative to the distance, so that
    // small and large scenes are seen from the same angle.
    const targetZoomOutPosition = new Vector3(
      center.x + distance * VIEW_OFFSET,
      center.y + distance * VIEW_OFFSET,
      center.z + distance,
    );

    gsap.to(this.controls.object.position, {
      x: targetZoomOutPosition.x,
      y: targetZoomOutPosition.y,
      z: targetZoomOutPosition.z,
      duration: CAMERA_MOVE_DURATION,
      ease: "power3.inOut",
      onUpdate: () => {
        this.controls.update();
        this.invalidate();
      },
    });

    gsap.to(this.controls.target, {
      x: center.x,
      y: center.y,
      z: center.z,
      duration: CAMERA_MOVE_DURATION,
      ease: "power3.inOut",
      onUpdate: () => {
        this.controls.update();
        this.invalidate();
      },
      onComplete: () => {
        this.controls.update();
        this.invalidate();
      },
    });
  }

  /** Applies the changes in the scene as received from the server. */
  /**
   * Applies changes of the scene sent by the server.
   *
   * @param revision Number of the change on the server (increasing, as string). The data loaded
   *        by loadScene() contains the changes up to its revision.
   */
  applySceneChanges(changesString, revision) {
    if (this.sceneGraph == null) {
      // The scene data is still loading (see loadScene()); a failed load has no buffer.
      this.pendingChanges?.push({ changes: changesString, revision });
      return;
    }
    try {
      const changed = new Set();
      const needsFullReload = this.applySceneCommands(changesString, changed);
      if (needsFullReload) {
        this.sceneGraph.reload(this.scope);
      } else {
        // Rebuild only what depends on the changes: a selection made in another component
        // must not rebuild the octree of a large scene.
        const structure = changed.has(STRUCTURE_CHANGE) || changed.has("parent");
        const colors = structure || changed.has("color");
        if (colors) {
          this.applyColors();
        }
        // Colours overwrite the selection colour; in the transparency mode, this traverses the
        // whole scene.
        if (colors || changed.has("selection") || changed.has("hidden")) {
          this.applySelection(this.sceneGraph.selection);
        }
        if (structure || changed.has("selection") || changed.has("transform")) {
          this.updateTransformControls();
        }
        if (structure) {
          this.buildSceneOctree();
        } else if (changed.has("transform")) {
          // Only the moved instances (the octree also holds hidden instances).
          this.updateSceneOctree(changed.transformed ?? []);
        }
        if (structure || changed.has("transform") || changed.has("hidden")) {
          this.refreshInstancedSnappingPoints();
          // Parts may have been added or moved beyond the bounds (zoomOut, clipping planes).
          this.createBoundingBox();
        }
        this.invalidate();
      }
    } catch (ex) {
      // The data model may be half patched; later changes refer to the state of the server.
      this.resyncScene(ex);
    }
  }

  /**
   * Loads the scene again from the server, after a change could not be applied: otherwise
   * client and server would differ from then on. The server sends the complete current state
   * (and resets its references, see ThreeJsControl.handleContent() on the server); changes that
   * arrive meanwhile are applied by their revision (see loadScene()).
   */
  async resyncScene(reason) {
    if (this._resyncing || this.disposed) {
      return;
    }
    this._resyncing = true;
    console.error("3D viewer: a scene change failed, the scene is loaded again.", reason);
    try {
      this.selection = [];
      this.updateTransformControls();
      this.scope.dispose();
      this.impostorManager?.dispose();
      this.impostorManager = null;
      this.resetSceneOctree();
      this.instancedSnappingPoints.dispose();
      this.zUpRoot.clear();
      this.multiTransformGroup.clear();

      this.scope = new Scope();
      this.scope.ctrl = this;
      this.renderManager.setInstanceManager(this.scope.instanceManager);
      this.scope.instanceManager.setTransparentMode(this.areObjectsTransparent);
      this.sceneGraph = null;
      this.pendingChanges = [];

      await this.loadScene();
      if (this.disposed) {
        return;
      }
      this.createBoundingBox();
      // The workplane was a child of the cleared root.
      this.toggleWorkplane(this.isWorkplaneVisible);
      this.refreshInstancedSnappingPoints();
      this.invalidate();
    } catch (error) {
      this.showLoadError(error);
    } finally {
      this._resyncing = false;
    }
  }

  /**
   * Applies the commands of a scene change to the data model.
   *
   * @returns whether the 3D scene must be rebuilt completely.
   */
  applySceneCommands(changesString, changed = new Set()) {
    const changes = JSON.parse(changesString);
    let needsFullReload = false;

    for (const change of changes) {
      const command = change[0];
      const cmdProps = command[1];

      let cmd;
      switch (command[0]) {
        case "R":
          cmd = new RemoveElement(cmdProps["id"]);
          break;
        case "I":
          cmd = new InsertElement(cmdProps["id"]);
          break;
        case "S":
          cmd = new SetProperty(cmdProps["id"]);
          break;
        default:
          // A command this client does not know: rebuild the scene from the data model
          // instead of stopping in the middle of the patch.
          console.error("3D viewer: unknown scene change command", command);
          needsFullReload = true;
          continue;
      }

      // Only allow known safe incremental properties for SetProperty commands.
      // Insert/Remove commands don't have a "p" key and are handled separately.
      if (command[0] === "S") {
        const safeIncrementalProperties = [
          "selection",
          "parent",
          "hidden",
          "color",
          "selectable",
          "transform",
          "translateStepSize",
          "rotateStepSize",
        ];

        if (!safeIncrementalProperties.includes(cmdProps["p"])) {
          needsFullReload = true;
        }
      }
      // The changed properties, or STRUCTURE_CHANGE for inserted / removed elements.
      changed.add(command[0] === "S" ? cmdProps["p"] : STRUCTURE_CHANGE);
      const movedId = command[0] === "S" && cmdProps["p"] === "transform" ? cmdProps["id"] : null;

      change.shift();
      cmd.loadJson(cmdProps, change);
      cmd.apply(this.scope);
      if (movedId != null) {
        // The moved scene nodes, see applySceneChanges().
        changed.transformed = changed.transformed ?? [];
        const moved = this.scope.getNode(movedId);
        if (moved) changed.transformed.push(moved);
      }

      if (cmd.needsFullReload) {
        needsFullReload = true;
      }
    }
    return needsFullReload;
  }

  /** Changes the selected state of the given shared node to the given value. */
  setSelected(sharedNode, value) {
    const index = this.selection.indexOf(sharedNode);
    let command;

    if (index >= 0) {
      // Currently selected
      if (value) {
        // Do not select again
        return;
      }

      // Clear selection visual
      if (sharedNode.willBeInstanced) {
        this.setInstancedSelectionState(sharedNode, false);
        this.removeInstanceProxy(sharedNode);
      } else if (sharedNode instanceof GroupNode) {
        this.setColor(sharedNode.node, WHITE);
        this.forEachInstancedDescendant(sharedNode, (pn) => {
          this.scope.instanceManager.setInstanceSelectionState(pn.assetKey, pn.instanceID, false);
        });
      } else {
        this.setColor(sharedNode.node, WHITE);
      }
      this.selection.splice(index, 1);

      command = this.sceneGraph.removeSelected(sharedNode);
    } else {
      // Currently not selected
      if (!value) {
        // Cannot remove from selection
        return;
      }

      // Apply selection visual
      if (sharedNode.willBeInstanced) {
        this.setInstancedSelectionState(sharedNode, true);
        // Create a proxy in edit mode so TransformControls can attach to it
        if (this.isEditMode) {
          this.createInstanceProxy(sharedNode);
        }
      } else if (sharedNode instanceof GroupNode) {
        this.setColor(sharedNode.node, SELECTION_COLOR);
        this.forEachInstancedDescendant(sharedNode, (pn) => {
          this.scope.instanceManager.setInstanceSelectionState(pn.assetKey, pn.instanceID, true);
        });
      } else {
        this.setColor(sharedNode.node, SELECTION_COLOR);
      }
      this.selection.push(sharedNode);

      command = this.sceneGraph.addSelected(sharedNode);
    }

    this.updateObjectsTransparency();

    this.updateTransformControls();
    if (this.isEditMode) {
      this.updateConnectionPointsVisibility();
    }

    return command;
  }

  /** Set GPU selection state for an instanced PartNode */
  setInstancedSelectionState(partNode, selected) {
    this.scope.instanceManager.setInstanceSelectionState(
      partNode.assetKey, partNode.instanceID, selected,
    );
  }

  // applies selection colour to selected shared objects from the sceneGraph
  applySelection(selectedSharedNodes) {
    // remove selection from the previously selected objects
    for (const shared3JSNode of this.selection) {
      if (shared3JSNode.willBeInstanced) {
        this.setInstancedSelectionState(shared3JSNode, false);
        this.removeInstanceProxy(shared3JSNode);
      } else {
        this.setColor(shared3JSNode.node, WHITE);
      }
      // Clear instanced descendants of GroupNodes
      if (shared3JSNode instanceof GroupNode) {
        this.forEachInstancedDescendant(shared3JSNode, (pn) => {
          this.scope.instanceManager.setInstanceSelectionState(pn.assetKey, pn.instanceID, false);
        });
      }
    }
    this.selection = [];

    // apply selection to new objects that have to be selected
    for (const shared3JSNode of selectedSharedNodes) {
      if (shared3JSNode.willBeInstanced) {
        this.setInstancedSelectionState(shared3JSNode, true);
        if (this.isEditMode) {
          this.createInstanceProxy(shared3JSNode);
        }
      } else if (shared3JSNode.node) {
        this.setColor(shared3JSNode.node, SELECTION_COLOR);
      }
      // Highlight instanced descendants of GroupNodes
      if (shared3JSNode instanceof GroupNode) {
        this.forEachInstancedDescendant(shared3JSNode, (pn) => {
          this.scope.instanceManager.setInstanceSelectionState(pn.assetKey, pn.instanceID, true);
        });
      }
      this.selection.push(shared3JSNode);
    }

    this.updateObjectsTransparency();

  }

  // Apply colours to all objects that have colour and 3D node
  applyColors() {
    for (const [id, obj] of Object.entries(this.scope.objects)) {
      if ((obj instanceof PartNode || obj instanceof GroupNode) && obj.color && obj.color.trim() !== "") {
        if (obj.willBeInstanced && obj.assetKey != null) {
          this.scope.instanceManager.setInstanceColor(obj.assetKey, obj.instanceID, obj.color);
        } else if (obj.node) {
          applyColorToObject(obj.node, obj.color);
        }
        // Cascade to instanced descendants of GroupNodes
        if (obj instanceof GroupNode) {
          obj.setInstancedChildrenColor(this.scope, obj.color);
        }
      }
    }
  }

  /**
   * Sets the colour of the given 3D object and its descendants (e.g. the selection colour), or,
   * with WHITE, restores their own colours: the colour of the nearest coloured ancestor (as set
   * by the scene, userData.color) for meshes, otherwise the original material colour.
   */
  setColor(node, color) {
    if (!node) {
      return;
    }

    if (color !== WHITE) {
      node.traverse((object) => {
        if (isPointMarker(object)) {
          return;
        }
        for (const material of this.getMaterials(object)) {
          material?.color?.set(color);
        }
      });
      return;
    }

    // Colour inherited from the nearest coloured ancestor (or the node itself); the topmost
    // object (the scene) is not considered.
    let inherited = null;
    for (let ancestor = node; ancestor?.parent; ancestor = ancestor.parent) {
      if (typeof ancestor.userData?.color === "string") {
        inherited = ancestor.userData.color;
        break;
      }
    }

    // One pass over the subtree, passing the effective colour down.
    const restore = (object, inheritedColor) => {
      if (isPointMarker(object)) {
        return;
      }
      const own = object.userData?.color;
      const effective =
        object.parent && typeof own === "string" ? own : inheritedColor;
      if (effective) {
        const c = sceneColor(effective);
        if (object.isMesh && object.material && c) {
          for (const material of this.getMaterials(object)) {
            material.color.copy(c);
          }
        }
      } else {
        for (const material of materialsOf(object)) {
          if (material.userData?.originalColor) {
            material.color.copy(material.userData.originalColor);
          }
        }
      }
      for (const child of object.children) {
        restore(child, effective);
      }
    };
    restore(node, inherited);
  }

  /**
   * Gives the given 3D object (e.g. a model that has just replaced its placeholder) the colour
   * it must have: the selection colour, if it belongs to a selected node, otherwise its own or
   * inherited colour.
   */
  restoreColor(object) {
    const selectedNodes = this.selection
      .filter((shared) => !shared.willBeInstanced && shared.node)
      .map((shared) => shared.node);
    if (selectedNodes.includes(object) || isDescendantOfAny(object, selectedNodes)) {
      this.setColor(object, SELECTION_COLOR);
    } else {
      this.setColor(object, WHITE);
    }
  }

  /** Updates the selection from a click on the canvas. */
  updateSelection(intersects, toggleMode) {
    const changes = [];

    if (!toggleMode) {
      const clearCmd = this.clearSelection();
      if (clearCmd != null) {
        changes.push(clearCmd);
      }
    }

    // Process intersected objects
    for (let i = 0; i < intersects.length; i++) {
      const clicked = intersects[i].object;

      let candidate = clicked;
      while (candidate != null) {
        const data = candidate.userData;
        const sharedNode = data?.nodeRef;
        if (sharedNode instanceof SharedObject && sharedNode.selectable) {
          const doSelect = toggleMode
            ? !this.selection.includes(sharedNode)
            : true;
          const setCmd = this.setSelected(sharedNode, doSelect);
          if (setCmd != null) {
            changes.push(setCmd);
          }
          this.invalidate();

          this.sendSceneChanges(changes);
          return;
        }

        candidate = candidate.parent;
      }
    }

    if (changes.length > 0) {
      this.sendSceneChanges(changes);
    }
  }

  clearSelection() {
    for (const sharedNode of this.selection) {
      if (sharedNode.willBeInstanced) {
        this.setInstancedSelectionState(sharedNode, false);
        // The proxy of an instanced part exists only while it is selected (in edit mode);
        // disableEditing() below no longer sees the deselected nodes.
        this.removeInstanceProxy(sharedNode);
      } else {
        this.setColor(sharedNode.node, WHITE);
      }
      // Clear instanced descendants of GroupNodes
      if (sharedNode instanceof GroupNode) {
        this.forEachInstancedDescendant(sharedNode, (pn) => {
          this.scope.instanceManager.setInstanceSelectionState(pn.assetKey, pn.instanceID, false);
        });
      }
    }
    this.selection.length = 0;

    if (this.areObjectsTransparent) {
      this.clearObjectsTransparency();
    }

    if (this.isEditMode) {
      this.updateConnectionPointsVisibility();
    }

    this.disableEditing();
    return this.sceneGraph.clearSelection();
  }

  /**
   * The element of this control. It is looked up once: when the server renders the control
   * again, a new element with the same ID replaces it, which belongs to the new control.
   */
  get container() {
    if (this._container === undefined) {
      this._container = document.getElementById(this.controlId);
    }
    return this._container;
  }

  static control(container) {
    return container.tlControl;
  }

  attach() {
    this.container.tlControl = this;
  }

  /**
   * Releases all resources of this control (WebGL contexts of the viewer and the
   * navigation cube, observers, controls, animations).
   *
   * Called when a new control is initialized and the container of this control is
   * no longer part of the document (see disposeDetachedControls). Without this, every
   * rendering of the view leaves two WebGL contexts behind, until the browser starts
   * to drop contexts ("Too many active WebGL contexts").
   */
  dispose() {
    if (this.disposed) {
      return;
    }
    this.disposed = true;

    // Stop loading assets for a scene that is no longer displayed, release the decoder.
    this.scope?.dispose();

    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    this.canvasListeners?.abort();

    if (this.controls) {
      gsap.killTweensOf([this.controls.object.position, this.controls.target]);
      disposeOrbitControls(this.controls);
    }
    this.translateControls?.dispose();
    this.rotateControls?.dispose();

    this.navigationCube?.dispose();
    this.skyboxManager?.dispose();
    this.instancedSnappingPoints?.dispose();
    this.renderManager?.dispose();

    this.impostorManager?.dispose();
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
    }

    if (this.container && this.container.tlControl === this) {
      this.container.tlControl = null;
    }

    // Should anything still refer to this control, it holds an empty scene only.
    this.scene?.clear();
  }

  async loadScene() {
    // Always the current state (the URL is the same when the scene is loaded again).
    const dataResponse = await fetch(this.dataUrl, { cache: "no-store" });
    if (!dataResponse.ok) {
      throw new Error(
        `Scene data: HTTP ${dataResponse.status} ${dataResponse.statusText}`,
      );
    }
    // The data contains all changes up to its revision. Changes are buffered from the start of
    // the control, since they may arrive before or after the data, independent of when the
    // server made them; only the later ones are applied.
    const dataRevision = Number(dataResponse.headers.get("X-Scene-Revision"));
    const dataJson = await dataResponse.json();

    this.sceneGraph = this.scope.loadJson(dataJson);

    // Without an await in between, so that no further change can come in meanwhile. The 3D scene
    // is built afterwards, so the commands only need to change the data model.
    const pendingChanges = this.pendingChanges;
    this.pendingChanges = null;
    for (const { changes, revision } of pendingChanges) {
      // Without revisions (NaN), every change is applied.
      if (!(Number(revision) <= dataRevision)) {
        this.applySceneCommands(changes);
      }
    }

    // Analyse for instancing
    this.scope.analyzeForInstancing(this);

    this.sceneGraph.buildGraph(this);

    // Create placeholder instanced meshes
    this.scope.createInstancedMeshes(this);

    // Create floors
    this.skyboxManager.createFactoryFloors(null);

    await this.scope.loadAssets(this).then((loaded) => {
      // Aborted by a reload or by dispose(); the reload completes the scene setup.
      if (!loaded) return;

      // Update instanced meshes with real GLTF geometry
      this.scope.updateInstancedMeshesWithGLTF(this);

      this.applyColors();
      this.updateObjectsTransparency();

      // Build octree after all instances are loaded
      this.buildSceneOctree();

      // Re-apply selection now that instanced meshes are fully set up
      // (the initial applySelection in buildGraph runs before instancing annotations exist)
      this.applySelection(this.sceneGraph.selection);
    });

    this.camera.updateProjectionMatrix();
    this.updateTransformControls();

    this.invalidate();
  }

  /**
   * Updates the octree after the given scene nodes have moved: only their instances are moved
   * in the tree. Building it again costs time proportional to all instances of the scene.
   */
  updateSceneOctree(nodes) {
    if (!this.sceneOctree) {
      return;
    }
    const instanceManager = this.scope.instanceManager;
    this.zUpRoot.updateMatrixWorld(true);
    const zUpTransform = this.zUpRoot.matrixWorld;
    let complete = true;
    for (const node of nodes) {
      this.forEachInstancedDescendant(node, (partNode) => {
        if (!complete) return;
        const data = instanceManager.managedMeshes.get(partNode.assetKey);
        const instance = data?.instanceData[partNode.instanceID];
        if (!instance || !data.baseBoundingBox) {
          complete = false;
          return;
        }
        const box = data.baseBoundingBox
          .clone()
          .applyMatrix4(instance.matrix)
          .applyMatrix4(zUpTransform);
        complete = this.sceneOctree.updateInstance(
          partNode.assetKey,
          partNode.instanceID,
          box,
        );
      });
    }
    if (!complete) {
      // An instance left the tree (or is unknown to it): build it again.
      this.buildSceneOctree();
    }
  }

  /**
   * Decide whether octree culling is needed based on total instanced triangle
   * count, build it if so, and tell the RenderManager which path to take.
   */
  buildSceneOctree() {
    const totalTriangles =
      this.scope.instanceManager.getTotalInstancedTriangleCount();

    const needsOctree = totalTriangles >= INSTANCING_BVH_TRIANGLE_THRESHOLD;

    if (needsOctree) {
      // Get the zUpRoot transformation matrix
      this.zUpRoot.updateMatrixWorld(true);
      const zUpTransform = this.zUpRoot.matrixWorld.clone();

      // Pass null for sceneBoundingBox so the octree computes its own bounds
      // from actual instance positions. Using this.boundingBox (computed from
      // mesh geometry at load time) is too tight — it doesn't account for the
      // spread of instance positions and can exclude moved instances.
      this.sceneOctree = SceneOctree.fromInstanceManager(
        this.scope.instanceManager,
        this.scope.instanceGroups,
        null,
        zUpTransform, // Pass the zUpRoot transform
      );

      // Update render manager reference
      this.renderManager.setSceneOctree(this.sceneOctree);

      // Tell the render manager which rendering path to use.
      // This also resets any in-progress state.
      this.renderManager.setUseOctree(true);

      // Only the octree path draws impostors.
      this.scope.ensureImpostors(this);
    } else {
      // An octree of a former state of the scene must not be used for picking.
      this.resetSceneOctree();
    }
  }

  /**
   * Drops the octree, e.g. when the scene is rebuilt: its entries refer to the former instances
   * and part nodes. Rendering and picking use the instance data directly until
   * buildSceneOctree() builds a new one.
   */
  resetSceneOctree() {
    this.sceneOctree = null;
    this.renderManager.setSceneOctree(null);
    this.renderManager.setUseOctree(false);
  }

  /**
   * Toggle octree debug visualisation.
   * Intentionally available in production via window.services.threejs.toggleOctreeDebug
   * for browser-console diagnostics.
   * @param {boolean} visible - Show or hide visualisation
   * @param {Object} options - Visualisation options
   *   - showNodes: Show octree node boundaries (default: true)
   *   - showInstances: Show instance bounding boxes (default: false)
   *   - showOnlyVisible: Only show currently visible instances (default: false)
   */
  toggleOctreeDebug(visible, options = {}) {
    const {
      showNodes = true,
      showInstances = false,
      showOnlyVisible = false,
    } = options;

    // Remove existing helpers
    const helper = this.scene.getObjectByName("OctreeDebugHelper");
    if (helper) {
      this.scene.remove(helper);
    }

    if (visible && this.sceneOctree) {
      const debugGroup = new Group();
      debugGroup.name = "OctreeDebugHelper";

      // Show octree node boundaries
      if (showNodes) {
        this.sceneOctree.root.addDebugLines(debugGroup);
      }

      // Show instance bounding boxes
      if (showInstances) {
        const instanceColor = showOnlyVisible ? 0x00ff00 : 0xffff00;

        // Get currently visible instances if filtering
        let visibleSet = null;
        if (showOnlyVisible) {
          const frustum = new Frustum();
          const projScreenMatrix = new Matrix4();
          projScreenMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse,
          );
          frustum.setFromProjectionMatrix(projScreenMatrix);
          const visibleObjects = this.sceneOctree.queryFrustum(frustum);

          visibleSet = new Set();
          for (const obj of visibleObjects) {
            visibleSet.add(`${obj.assetKey}-${obj.instanceID}`);
          }
        }

        // Draw bounding boxes for instances
        for (const [assetKey, data] of this.scope.instanceManager
          .managedMeshes) {
          const group = this.scope.instanceGroups.get(assetKey);
          if (!group) continue;

          const baseBox = data.baseBoundingBox;
          if (!baseBox) continue;

          for (const instance of data.instanceData) {
            // Skip if filtering to visible only
            if (
              showOnlyVisible &&
              !visibleSet.has(`${assetKey}-${instance.id}`)
            ) {
              continue;
            }

            // Transform base bounding box
            const instanceBox = baseBox.clone();
            instanceBox.applyMatrix4(instance.matrix);

            // Create box helper
            const boxHelper = new Box3Helper(
              instanceBox,
              showOnlyVisible ? 0x00ff00 : 0xffff00,
            );
            boxHelper.userData.assetKey = assetKey;
            boxHelper.userData.instanceID = instance.id;
            debugGroup.add(boxHelper);
          }
        }
      }

      this.scene.add(debugGroup);

    }

    this.invalidate();
  }

  sendSceneChanges(commands) {
    const cmds = [];
    for (let i = 0; i < commands.length; i++) {
      cmds.push(commands[i].extract());
    }

    const message = {
      controlCommand: "sceneChanged",
      controlID: this.controlId,
      json: JSON.stringify(cmds),
    };

    services.ajax.execute("dispatchControlCommand", message);
  }

  getMaterials(object) {
    return Array.isArray(object.material) ? object.material : [object.material];
  }

  setObjectTransparency(material, opacity) {
    // Store original properties on first use
    if (!material.userData.originalProperties) {
      material.userData.originalProperties = {
        transparent: material.transparent,
        opacity: material.opacity,
        depthWrite: material.depthWrite,
      };
    }

    const wasTransparent = material.transparent;
    if (opacity === null) {
      // Restore original properties
      const orig = material.userData.originalProperties;
      material.transparent = orig.transparent;
      material.opacity = orig.opacity;
      material.depthWrite = orig.depthWrite;
    } else {
      // Apply transparency
      material.transparent = true;
      material.opacity = opacity;
      material.depthWrite = false;
    }
    // Only the transparent flag changes the shader program; opacity and depthWrite are
    // applied per draw call.
    if (material.transparent !== wasTransparent) {
      material.needsUpdate = true;
    }
  }

  clearObjectsTransparency() {
    this.scene.traverse((object) => {
      if (object.userData.isInstancedMesh || object.userData.isImpostorMesh) return;
      if (object.material) {
        this.getMaterials(object).forEach((material) => {
          if (material.transparent && material.opacity < 1.0) {
            this.setObjectTransparency(material, null);
          }
        });
      }
    });

    // Reset all instance opacities to 1.0 (skip impostors — they share the base asset's texture)
    if (this.scope.instanceManager.managedMeshes.size > 0) {
      for (const [assetKey] of this.scope.instanceManager.managedMeshes) {
        if (assetKey.endsWith("_impostor")) continue;
        this.scope.instanceManager.clearAllInstanceOpacity(assetKey);
      }
    }
  }

  setObjectsTransparency() {
    if (this.selection.length > 0) {
      // Collect Three.js object IDs for selected non-instanced objects
      const selectedIds = new Set();
      this.selection.forEach((sharedNode) => {
        if (sharedNode.node) {
          sharedNode.node.traverse((child) => {
            selectedIds.add(child.id);
          });
        }
      });

      // Make non-instanced objects transparent, the selected ones opaque
      this.scene.traverse((object) => {
        if (object.userData.isInstancedMesh || object.userData.isImpostorMesh) return;
        if (
          object.material &&
          object !== this.workplane &&
          !this.isWorkplaneChild(object)
        ) {
          const selected = selectedIds.has(object.id);
          this.getMaterials(object).forEach((material) => {
            if (selected) {
              // Restore only materials made transparent before.
              if (material.userData.originalProperties) {
                this.setObjectTransparency(material, null);
              }
            } else {
              this.setObjectTransparency(material, TRANSPARENCY_LEVEL);
            }
          });
        }
      });

      // Collect selected instanced PartNode keys for quick lookup
      const selectedInstanceKeys = new Set();
      for (const sharedNode of this.selection) {
        if (sharedNode.willBeInstanced && sharedNode.assetKey != null) {
          selectedInstanceKeys.add(sharedNode.assetKey + ":" + sharedNode.instanceID);
        }
        if (sharedNode instanceof GroupNode) {
          this.forEachInstancedDescendant(sharedNode, (pn) => {
            selectedInstanceKeys.add(pn.assetKey + ":" + pn.instanceID);
          });
        }
      }

      // Apply per-instance opacity via GPU texture (skip impostors — they share the base asset's texture)
      for (const [assetKey, meshData] of this.scope.instanceManager.managedMeshes) {
        if (assetKey.endsWith("_impostor")) continue;
        if (!meshData.instanceData) continue;
        for (const instance of meshData.instanceData) {
          const isSelected = selectedInstanceKeys.has(assetKey + ":" + instance.id);
          this.scope.instanceManager.setInstanceOpacity(
            assetKey, instance.id, isSelected ? 1.0 : TRANSPARENCY_LEVEL,
          );
        }
      }
    }
  }

  toggleObjectsTransparent(shouldBeTransparent) {
    if (this.areObjectsTransparent == shouldBeTransparent) {
      return;
    }

    this.areObjectsTransparent = shouldBeTransparent;
    this.scope.instanceManager.setTransparentMode(shouldBeTransparent);
    if (this.areObjectsTransparent) {
      this.setObjectsTransparency();
    } else {
      this.clearObjectsTransparency();
    }

    this.invalidate();
  }

  isWorkplaneChild(object) {
    if (!this.workplane) return false;

    let parent = object.parent;
    while (parent) {
      if (parent === this.workplane) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  updateObjectsTransparency() {
    if (!this.areObjectsTransparent) {
      return; // Don't do anything if transparency is disabled
    }

    // One pass that sets the final state of each material: clearing first and then setting
    // would switch the transparent flag twice and make three.js check the shader programs of
    // all materials.
    if (this.selection.length > 0) {
      this.setObjectsTransparency();
    } else {
      this.clearObjectsTransparency();
    }

    this.invalidate();
  }

  /**
   * Mark the scene as dirty and schedule a re-render.
   * This is the ONLY method that should be called to trigger rendering.
   */
  invalidate() {
    this.renderManager.invalidate();
  }
}

/**
 * Sideways and upwards offset of the camera after a flight (zoomOut, zoomToSelection), relative
 * to its distance to the content.
 */
const VIEW_OFFSET = 0.45;

/**
 * Largest distance of the near clipping plane (mm) while the camera is inside the content. The
 * far plane lies behind the content, so the depth resolution stays sufficient.
 */
const NEAR_PLANE_INSIDE_MAX = 100;

/** Marks inserted or removed elements in the changes collected by applySceneCommands(). */
const STRUCTURE_CHANGE = "#structure";

/**
 * All controls that have not been disposed yet. When the server renders the view again
 * (e.g. when switching back to its tab), it creates a new control with a new ID in a new
 * container; the containers of the previous controls are then no longer part of the
 * document. A control notices the removal of its container itself (see
 * createResizeObserver()); initializing a new control disposes the remaining ones.
 */
const activeControls = new Set();

/** Disposes all controls whose container has been removed from the document. */
function disposeDetachedControls() {
  for (const control of activeControls) {
    if (!control.container || !control.container.isConnected) {
      control.dispose();
      activeControls.delete(control);
    }
  }
}

// For server communication written in legacy JS.
window.services.threejs = {
  init: function (initialState) {
    disposeDetachedControls();

    const control = new ThreeJsControl(initialState);
    control.attach();
    activeControls.add(control);
  },

  sceneChanged: function (container, changes, revision) {
    const control = ThreeJsControl.control(container);
    if (control != null) {
      control.applySceneChanges(changes, revision);
    }
  },

  zoomToSelection: function (container) {
    const control = ThreeJsControl.control(container);
    if (control != null) {
      control.zoomToSelection();
    }
  },

  zoomOutFromSelection: function (container) {
    const control = ThreeJsControl.control(container);
    if (control != null) {
      control.zoomOut();
    }
  },

  toggleWorkplane: function (container, visible) {
    const control = ThreeJsControl.control(container);
    if (control != null) {
      control.toggleWorkplane(visible);
    }
  },

  toggleSkybox: function (container, visible) {
    const control = ThreeJsControl.control(container);
    if (control != null) {
      control.toggleSkybox(visible);
    }
  },

  toggleObjectsTransparent: function (container, transparent) {
    const control = ThreeJsControl.control(container);
    if (control != null) {
      control.toggleObjectsTransparent(transparent);
    }
  },

  toggleEditMode: function (container, value) {
    const control = ThreeJsControl.control(container);
    if (control != null) {
      control.toggleEditMode(value);
    }
  },

  toggleRotateMode: function (container, value) {
    const control = ThreeJsControl.control(container);
    if (control != null) {
      control.toggleRotateMode(value);
    }
  },

  toggleOctreeDebug: function (container, visible) {
    const control = ThreeJsControl.control(container);
    if (control != null) {
      control.toggleOctreeDebug(visible);
    }
  },
};
