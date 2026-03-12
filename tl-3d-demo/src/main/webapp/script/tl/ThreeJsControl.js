/**
 * Main class for managing 3D scenes using Three.js library.
 * Provides methods for initialising and controlling a 3D scene with various functionalities.
 */

import {
  AxesHelper,
  Box3,
  Box3Helper,
  BoxHelper,
  Color,
  Frustum,
  Group,
  Matrix4,
  RGBAFormat,
  Scene,
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
import {
  CameraUtils,
  SceneUtils,
  applyColorToObject,
  getLocalMatrix,
  getMatrixDiff,
  getRaycaster,
  isDescendantOfAny,
  throttle,
  toMatrix,
} from "./ThreeJsUtils.js";

import {
  CAMERA_MOVE_DURATION,
  C_P_RADIUS,
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
  _90_DEGREE,
} from "./Constants.js";

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
    this.lastSelectedObject = null;
    this.prevClosestSnappingPoint = null;
    this.controlId = initialState.controlId;
    this.contextPath = initialState.contextPath;
    this.dataUrl = initialState.dataUrl;
    this.imageUrl = initialState.imageUrl;
    this.scope = new Scope();

    this.zUpRoot = new Group();
    this.zUpEnvironment = new Group();
    this.multiTransformGroup = new Group();
    this.areObjectsTransparent = initialState.areObjectsTransparent;
    this.useScreenSpaceSnapping = true;

    this.skyboxManager = new SkyboxManager(this);
    this.skyboxManager.setEnabled(initialState.skyboxEnabled !== false);
    this.initScene();
    this.initRenderer();
    this.initControls();

    this.renderManager = new RenderManager(
      this.renderer,
      this.scene,
      this.camera,
    );

    this.impostorManager = null;

    this.sceneOctree = null;

    this.initTransformControls();
    this.initNavigationCube();

    this.renderManager.setSceneOctree(this.sceneOctree);
    this.renderManager.setInstanceManager(this.scope.instanceManager);

    // Initial render
    this.renderManager.forceRender();

    this.isEditMode = false;

    this.loadScene().then(() =>
      setTimeout(() => {
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
    );
  }

  initScene() {
    // Filled in loadScene().
    this.sceneGraph = null;
    this.selection = [];

    this.scene = new Scene();
    this.scene.background = new Color("skyblue");

    this.createCamera();
    this.addLights();
    this.addAxesHelper(this.scene);

    this.zUpRoot.rotation.x = -_90_DEGREE;
    this.scene.add(this.zUpRoot);
    this.scene.add(this.zUpEnvironment);
    this.multiTransformGroup.rotation.x = -_90_DEGREE;
    this.scene.add(this.multiTransformGroup);
  }

  initRenderer() {
    const container = this.container;
    this.renderer = new WebGLRenderer({
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
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
    const resizeObserver = this.createResizeObserver(this.canvas);
    resizeObserver.observe(this.canvas);
    this.canvas.addEventListener("mousedown", (event) =>
      this.onMouseDown(event),
    );
    this.canvas.addEventListener("mouseup", (event) => this.onMouseUp(event));
    this.container.addEventListener(
      "wheel",
      (event) => this.onMouseWheel(event),
      {
        passive: false,
      },
    );

    // Create a MutationObserver to detect DOM changes that might affect layout
    const mutationObserver = new MutationObserver(() => {
      this.updateRendererSize();
    });

    // Observe the container and its parent for attribute changes
    mutationObserver.observe(container, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    if (container.parentNode) {
      mutationObserver.observe(container.parentNode, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    }
  }

  initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.reset();
    this.controls.enableZoom = true;
    this.controls.screenSpacePanning = true;

    this.controlsIsUpdating = false;

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
      const boxSize = new Vector3();
      this.boundingBox.getSize(boxSize);
      const gridSize = Math.max(boxSize.x, boxSize.y, boxSize.z) * 1.2;

      this.workplane = SceneUtils.createDetailedGrid(gridSize);
      this.snapToWorkplaneEnabled = true;
    }

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

    this.isWorkplaneVisible = visible;
    this.invalidate();
  }

  updateWorkplanePosition() {
    if (!this.workplane || !this.isWorkplaneVisible) {
      return;
    }
    if (this.sceneGraph && this.sceneGraph.coordinateSystem) {
      const matrixValues = toMatrix(this.sceneGraph.coordinateSystem);
      this.workplane.applyMatrix4(
        matrixValues.multiply(this.workplane.matrix.clone().invert()),
      );
    }
    this.workplane.updateMatrixWorld(true);
    this.invalidate();
  }

  toggleSkybox(visible) {
    this.skyboxManager.toggleSkybox(visible);
  }

  updateFactoryFloors() {
    // Update floors when scene changes
    if (
      this.skyboxManager.isEnabled() &&
      this.skyboxManager.getEnvironmentBackground()
    ) {
      this.skyboxManager.createFactoryFloors(null);
      this.invalidate();
    }
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

            for (const node of outer.multiTransformGroup.children) {
              lastWorldMatrixes[node.id] = node.matrixWorld.clone();
              // Store starting position and rotation for incremental snapping
              node.userData.dragStartPosition = node.position.clone();
              node.userData.dragStartRotation = node.rotation.clone();

              // Snapshot instanced descendant matrices for GroupNodes
              const sharedNode = outer.selection.find((s) => s.node === node);
              if (sharedNode instanceof GroupNode && outer.hasInstancedDescendants(sharedNode)) {
                node.userData.dragStartMatrix = node.matrixWorld.clone();
                outer._instanceSnapshots[node.id] = outer.snapshotInstancedDescendantMatrices(sharedNode);
              }
            }

            return;
          }

          // Apply step snapping to each object in multi-select
          outer.multiTransformGroup.children.forEach((node) => {
            outer.snapToStepSize(node);
          });

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
              outer.recomputeInstanceMatrices(sharedNode);
            }
          }

          outer.sendSceneChanges(commands);

          // Rebuild octree if any instanced matrices changed
          if (Object.keys(outer._instanceSnapshots).length > 0) {
            outer.buildSceneOctree();
          }
          outer._instanceSnapshots = {};
        } else {
          // SINGLE OBJECT MODE
          object.updateMatrixWorld(true);
          const currentMatrix = object.matrix.clone();

          if (event.value) {
            lastMatrix.copy(currentMatrix);
            // Store starting position and rotation for incremental snapping
            object.userData.dragStartPosition = object.position.clone();
            object.userData.dragStartRotation = object.rotation.clone();

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

            // Rebuild the octree since instance positions have changed
            outer.buildSceneOctree();
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
                outer.recomputeInstanceMatrices(sharedObject);
                outer.buildSceneOctree();
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

    this.translateControls.addEventListener("objectChange", (event) => {
      if (event.target.dragging) {
        const selectedObject = event.target.object;
        // Apply step snapping to single objects
        if (selectedObject !== this.multiTransformGroup) {
          this.snapToStepSize(selectedObject);
        }

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

        const { closestSnappingPoint } =
          this.throttledFindClosestSnappingPoint(selectedObject);

        if (this.prevClosestSnappingPoint !== closestSnappingPoint) {
          if (this.prevClosestSnappingPoint) {
            this.restoreSnappingPointColor(this.prevClosestSnappingPoint);
          }
          if (closestSnappingPoint) {
            closestSnappingPoint.pointMaterial.color.set(YELLOW);
            let mesh = closestSnappingPoint.node.children[0];
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
            this.invalidate();
          }
          this.prevClosestSnappingPoint = closestSnappingPoint;
        }
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
    this.rotateControls.addEventListener("objectChange", (event) => {
      if (event.target.dragging) {
        const selectedObject = event.target.object;
        // Apply step snapping to single objects
        if (selectedObject !== this.multiTransformGroup) {
          this.snapToStepSize(selectedObject);
        }

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
    const box = new Box3();

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
      box.expandByObject(node);
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
        // object.visible = false; // always hide layout points
        // only show layout points for selected objects
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

    this.isRotateMode = enable;
    this.updateTransformControls();
    this.invalidate();
  }

  getScreenSpaceDistance(pos1, pos2) {
    const screen1 = pos1.clone().project(this.camera);
    const screen2 = pos2.clone().project(this.camera);
    const canvas = this.renderer.domElement;

    const x1 = ((screen1.x + 1) * canvas.width) / 2;
    const y1 = ((-screen1.y + 1) * canvas.height) / 2;
    const x2 = ((screen2.x + 1) * canvas.width) / 2;
    const y2 = ((-screen2.y + 1) * canvas.height) / 2;

    return Math.hypot(x2 - x1, y2 - y1);
  }

  findClosestSnappingPoint(selectedObj) {
    // Check if selectedObj has snapping points either directly or through nodeRef
    const selectedObjAsset =
      selectedObj?.userData?.asset || selectedObj?.userData?.nodeRef?.asset;

    if (!selectedObj) {
      return { closestSnappingPoint: null, closestSnappingPointObject: null };
    }

    // find all other objects in the scene that have snapping points
    const snappableObjects = [];
    // const snappableObjectsPoints = [];

    this.zUpRoot.traverse((node) => {
      // Check for snapping points either directly or through nodeRef
      const nodeAsset = node?.userData?.asset || node?.userData?.nodeRef?.asset;

      if (
        node !== selectedObj &&
        nodeAsset &&
        nodeAsset.snappingPoints &&
        nodeAsset.snappingPoints.length > 0
      ) {
        snappableObjects.push(node);
        // snappableObjectsPoints.push(node.matrixWorld.clone());
      }
    });

    if (snappableObjects.length === 0) {
      return { closestSnappingPoint: null, closestSnappingPointObject: null };
    }

    selectedObj.updateMatrixWorld(true);

    // find the closest pair of snapping points
    let closestDistance = SNAP_THRESHOLD;
    let closestSnappingPoint = null;
    let closestSnappingPointObject = null;

    const selectedWorldPosition = new Vector3();
    selectedObj.getWorldPosition(selectedWorldPosition);

    for (const otherObject of snappableObjects) {
      otherObject.updateMatrixWorld(true);

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
          if (this.isConnectionPointOccupied(otherPoint, selectedObj)) {
            continue;
          }

          closestDistance = distance;
          closestSnappingPoint = otherPoint;
          closestSnappingPointObject = otherObject;
        }
      }
    }

    const threshold = SNAP_THRESHOLD;
    return closestDistance < threshold
      ? { closestSnappingPoint, closestSnappingPointObject }
      : { closestSnappingPoint: null, closestSnappingPointObject: null };
  }

  // throttled version of findClosestSnappingPoint
  throttledFindClosestSnappingPoint = throttle((selectedObject) => {
    return this.findClosestSnappingPoint(selectedObject);
  }, 100);

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
    const rotateStepSize = this.sceneGraph.rotateStepSize;
    const startPos = obj.userData.dragStartPosition;
    const startRot = obj.userData.dragStartRotation;

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

    if (startRot && rotateStepSize > 0) {
      const stepRad = (rotateStepSize * Math.PI) / 180;
      const stepsX = Math.round((obj.rotation.x - startRot.x) / stepRad);
      const stepsY = Math.round((obj.rotation.y - startRot.y) / stepRad);
      const stepsZ = Math.round((obj.rotation.z - startRot.z) / stepRad);

      obj.rotation.set(
        startRot.x + stepsX * stepRad,
        startRot.y + stepsY * stepRad,
        startRot.z + stepsZ * stepRad,
      );
    }
  }

  snapObjectToWorkplane(object) {
    if (!this.snapToWorkplaneEnabled) {
      return false;
    }

    object.updateMatrixWorld(true);

    const worldPosition = new Vector3();
    object.getWorldPosition(worldPosition);

    const distanceToWorkplane = Math.abs(worldPosition.y);
    const MAX_SNAP_DISTANCE = 200;

    if (distanceToWorkplane <= MAX_SNAP_DISTANCE) {
      let snapMatrix = new Matrix4();
      const isOnWorkplane = Math.abs(worldPosition.y);

      if (this.isWorkplaneVisible && this.isEditMode && isOnWorkplane) {
        // Object is already on workplane, apply grid snapping
        const snappedPosition =
          this.calculateGridSnappedPosition(worldPosition);

        // Create translation to snap to grid and workplane
        snapMatrix.makeTranslation(
          snappedPosition.x - worldPosition.x,
          snappedPosition.y - worldPosition.y,
          snappedPosition.z - worldPosition.z,
        );
      } else {
        //  Object is not on workplane yet, just snap to workplane at current X,Z
        snapMatrix.makeTranslation(0, -worldPosition.y, 0);
      }

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

  calculateGridSnappedPosition(worldPosition) {
    // Calculate nearest grid positions
    const nearestGridX =
      Math.round(worldPosition.x / GRID_SMALL_CELL) * GRID_SMALL_CELL;
    const nearestGridZ =
      Math.round(worldPosition.z / GRID_SMALL_CELL) * GRID_SMALL_CELL;

    // Check if position is close enough to grid lines to snap
    const distanceToGridX = Math.abs(worldPosition.x - nearestGridX);
    const distanceToGridZ = Math.abs(worldPosition.z - nearestGridZ);

    // Only snap if within threshold distance
    const snappedX =
      distanceToGridX <= GRID_SNAP_THRESHOLD ? nearestGridX : worldPosition.x;
    const snappedZ =
      distanceToGridZ <= GRID_SNAP_THRESHOLD ? nearestGridZ : worldPosition.z;

    return {
      x: snappedX,
      y: 0, // Always snap to workplane
      z: snappedZ,
    };
  }

  isConnectionPointOccupied(connectionPoint, excludeObject = null) {
    // Get world position of connection point
    const position = new Vector3();
    connectionPoint.node.getWorldPosition(position);
    const checkRadius = 50;

    // Find all objects near this connection point
    const nearbyObjects = [];
    let totalObjectsChecked = 0;
    let objectsWithAssets = 0;

    this.zUpRoot.traverse((node) => {
      totalObjectsChecked++;

      // Skip the object being moved
      if (node === excludeObject) {
        return;
      }

      // Check if has asset
      if (node.userData?.asset) {
        objectsWithAssets++;
      } else if (node.userData?.nodeRef?.asset) {
        objectsWithAssets++;
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
    const { closestSnappingPoint, closestSnappingPointObject } =
      this.throttledFindClosestSnappingPoint(selectedObj);

    if (closestSnappingPoint && closestSnappingPointObject) {
      closestSnappingPointObject.updateMatrixWorld(true);
      closestSnappingPoint.node.updateMatrixWorld(true);
      selectedObj.updateMatrixWorld(true);

      const snappingPointWorldMatrix =
        closestSnappingPoint.node.matrixWorld.clone();

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

  addBoxHelpers() {
    // show bounding box around all objects
    this.boundingBoxHelper = new Box3Helper(this.boundingBox, YELLOW);
    this.scene.add(this.boundingBoxHelper);
    this.invalidate();
    this.removeBoxHelpers();

    if (this.selection.length === 0) {
      return;
    }

    this.boxHelpers = [];

    if (
      this.selection.length > 1 &&
      this.multiTransformGroup.children.length > 0
    ) {
      // create a box helper for the entire multigroup
      const multiGroupHelper = new BoxHelper(this.multiTransformGroup, YELLOW);
      this.scene.add(multiGroupHelper);
      this.boxHelpers.push(multiGroupHelper);
    } else {
      // create individual box helpers for each selected object
      for (const sharedNode of this.selection) {
        if (sharedNode && sharedNode.node) {
          const boxHelper = new BoxHelper(sharedNode.node, YELLOW);
          this.scene.add(boxHelper);
          this.boxHelpers.push(boxHelper);
        }
      }
    }
    this.invalidate();
  }

  removeBoxHelpers() {
    if (this.boxHelpers && this.boxHelpers.length > 0) {
      for (const helper of this.boxHelpers) {
        this.scene.remove(helper);
      }
      this.boxHelpers = [];
    }

    if (this.lastSelectedBoxHelper) {
      this.scene.remove(this.lastSelectedBoxHelper);
      this.lastSelectedBoxHelper = null;
      this.lastSelectedObject = null;
    }
  }

  createBoundingBox() {
    this.boundingBox = new Box3();
    this.zUpRoot.traverse((object) => {
      if (object.type === "Mesh") {
        this.boundingBox.expandByObject(object);
      }
    });
  }

  createResizeObserver() {
    return new ResizeObserver(
      throttle(() => {
        this.updateRendererSize();
      }, 100),
    );
  }

  updateRendererSize() {
    if (!this.container) return;

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
  }

  onMouseUp(event) {
    if (this.clickButton != 0) {
      return; // Not click with middle mouse button.
    }
    if (Date.now() - this.clickStart > 500) {
      return; // Not a click.
    }
    const raycaster = getRaycaster(event, this.camera, this.canvas);
    const visibleObjects = this.scene.children.filter((obj) => obj.visible);
    const intersects = raycaster.intersectObjects(visibleObjects, true);

    // Check if any regular selectable hit was found
    const hasSelectableHit = intersects.some((hit) => {
      let candidate = hit.object;
      while (candidate != null) {
        const sharedNode = candidate.userData?.nodeRef;
        if (sharedNode instanceof SharedObject && sharedNode.selectable) {
          return true;
        }
        candidate = candidate.parent;
      }
      return false;
    });

    const toggleMode = event.ctrlKey || event.metaKey;
    if (hasSelectableHit) {
      this.updateSelection(intersects, toggleMode);
    } else {
      // Fall back to instanced mesh raycasting
      const instancedHit = this.raycastInstancedMeshes(raycaster);
      if (instancedHit) {
        this.updateSelectionInstanced(instancedHit.partNode, toggleMode);
      } else {
        // Clicked empty space — clear selection
        this.updateSelection([], toggleMode);
      }
    }
    this.invalidate();
  }

  /**
   * Raycast against instanced meshes using octree (if available) or linear scan.
   * Returns {partNode, assetKey, instanceID} for closest hit, or null.
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
      for (const [assetKey, data] of instanceManager.managedMeshes) {
        if (assetKey.endsWith("_impostor")) continue;
        const baseBox = data.baseBoundingBox;
        if (!baseBox) continue;

        this.zUpRoot.updateMatrixWorld(true);
        const zUpTransform = this.zUpRoot.matrixWorld;

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

    // Find closest hit by distance to bounding box center
    let closest = null;
    let closestDist = Infinity;
    const origin = raycaster.ray.origin;

    for (const candidate of candidates) {
      const center = new Vector3();
      candidate.boundingBox.getCenter(center);
      const dist = center.distanceTo(origin);
      if (dist < closestDist) {
        closestDist = dist;
        closest = candidate;
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
   * Compute a node's world transform from the data model by walking up the parent chain.
   * This includes the node's own transform.
   */
  computeDataModelWorldTransform(node) {
    const transforms = [];
    let current = node;
    while (current) {
      if (current.transform) {
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

  /**
   * Recompute GPU instance matrices for all instanced PartNode descendants of a GroupNode.
   * Walks the data model tree, accumulating transforms, and updates each instance's
   * GPU matrix. Used after a GroupNode's transform has been updated (drag-end, server update).
   */
  recomputeInstanceMatrices(groupNode) {
    const worldTransform = this.computeDataModelWorldTransform(groupNode);
    this._recomputeDescendantMatrices(groupNode, worldTransform);
  }

  _recomputeDescendantMatrices(node, parentWorldTransform) {
    if (!node.contents) return;
    for (const child of node.contents) {
      let childWorld = parentWorldTransform.clone();
      if (child.transform) {
        childWorld.multiply(toMatrix(child.transform));
      }

      if (child instanceof PartNode && child.willBeInstanced && child.assetKey != null) {
        this.scope.instanceManager.updateInstanceMatrix(child.assetKey, child.instanceID, childWorld);
      }

      if (child instanceof GroupNode && child.contents) {
        this._recomputeDescendantMatrices(child, childWorld);
      }
    }
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

  onMouseWheel(event) {
    event.preventDefault();

    const target = this.controls.target;
    const position = this.camera.position;

    const offset = new Vector3();
    offset.copy(position);
    offset.sub(target);

    const factor = event.deltaY < 0 ? 0.888888889 : 1.125;
    offset.multiplyScalar(factor);
    offset.add(target);

    this.camera.position.copy(offset);

    this.renderManager.onCameraMove();
  }

  zoomToSelection() {
    const selectedObject = this.selection[0]?.node;
    if (!selectedObject) return;

    const boundingBox = new Box3().setFromObject(selectedObject);
    const center = new Vector3();
    boundingBox.getCenter(center);

    const size = new Vector3();
    boundingBox.getSize(size);

    const objectPosition = selectedObject.getWorldPosition(new Vector3());

    const maxSize = Math.max(size.x, size.y);
    const fov = this.camera.fov * (Math.PI / 180);
    let targetDistance = maxSize / 2 / Math.tan(fov / 2);

    const targetPositionZ = targetDistance + objectPosition.z;
    const offset = new Vector3(0, 0, 0);
    const targetZoomInPosition = center.clone().add(offset);

    const controlsObjectPositionMatches =
      this.controls.object.position.x === targetZoomInPosition.x &&
      this.controls.object.position.y === targetZoomInPosition.y &&
      this.controls.object.position.z === targetPositionZ;

    const controlsTargetMatches =
      this.controls.target.x === center.x &&
      this.controls.target.y === center.y &&
      this.controls.target.z === center.z;

    if (!controlsObjectPositionMatches && !controlsTargetMatches) {
      gsap.to(this.controls.object.position, {
        x: center.x,
        y: center.y + 2000,
        z: targetPositionZ,
        duration: CAMERA_MOVE_DURATION,
        ease: "power3.inOut",
        onUpdate: () => {
          this.controls.update();
          this.invalidate();
        },
        onComplete: () => {
          this.lastSelectedObject = selectedObject;
          this.controls.enableDamping = true;
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
    }
    this.invalidate();
  }

  zoomOut() {
    if (!this.boundingBox) {
      return;
    }

    // this.addBoxHelpers();
    const center = new Vector3();
    this.boundingBox.getCenter(center);

    const size = new Vector3();
    this.boundingBox.getSize(size);

    const maxSize = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    const distance = maxSize / 2 / Math.tan(fov / 2);

    const targetZoomOutPosition = new Vector3(
      center.x + 12000, // for looking a bit at the right side
      center.y + 12000, // for looking a bit from the top
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
      // x: 0, y: 0, z: 0,
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
        this.lastSelectedObject = null;
        this.controls.update();
        this.invalidate();
      },
    });
  }

  /** Applies the changes in the scene as received from the server. */
  applySceneChanges(changesString) {
    try {
      const changes = JSON.parse(changesString);
      let needsFullReload = false;

      for (const change of changes) {
        var command = change[0];
        var cmdProps = command[1];

        var cmd;
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
          ];

          if (!safeIncrementalProperties.includes(cmdProps["p"])) {
            needsFullReload = true;
          }
        }
        change.shift();
        cmd.loadJson(cmdProps, change);
        cmd.apply(this.scope);

        if (cmd.needsFullReload) {
          needsFullReload = true;
        }
      }

      if (needsFullReload) {
        this.sceneGraph.reload(this.scope);
      } else {
        this.applyColors();
        this.applySelection(this.sceneGraph.selection);
        this.updateTransformControls();
        if (this.sceneOctree) {
          this.buildSceneOctree();
        }
        this.invalidate();
      }
    } catch (ex) {
      console.error(ex);
      throw ex;
    }
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
      if (obj.color && obj.color.trim() !== "") {
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

  setColor(node, color) {
    if (!node) {
      return;
    }

    if (color === WHITE) {
      let rootNode = node;
      while (rootNode?.parent) {
        const c = rootNode.userData?.color;
        if (typeof c === "string") {
          applyColorToObject(node, c);
          break;
        }
        rootNode = rootNode.parent;
      }

      if (!rootNode?.userData?.color) {
        if (node.material?.userData?.originalColor) {
          node.material.color.copy(node.material.userData.originalColor);
        }
      }
    } else {
      if (node.material) {
        node.material.color.set(color);
      }
    }

    for (const child of node.children) {
      this.setColor(child, color);
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
          // this.addBoxHelpers();

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

  get container() {
    const container = document.getElementById(this.controlId);
    if (!container) {
      return null;
    }
    return container;
  }

  static control(container) {
    return container.tlControl;
  }

  attach() {
    this.container.tlControl = this;
  }

  async loadScene() {
    const dataResponse = await fetch(this.dataUrl);
    const dataJson = await dataResponse.json();

    this.sceneGraph = this.scope.loadJson(dataJson);

    // Analyse for instancing
    this.scope.analyzeForInstancing();

    this.sceneGraph.buildGraph(this);

    // Create placeholder instanced meshes
    this.scope.createInstancedMeshes(this);

    // Create floors
    if (this.skyboxManager.isEnabled()) {
      this.skyboxManager.createFactoryFloors(null);
    }

    await this.scope.loadAssets(this).then(() => {
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

    this.camera.position.applyMatrix4(this.scene.matrix);
    this.camera.updateProjectionMatrix();
    this.updateTransformControls();

    this.invalidate();
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
    }

    // Tell the render manager which rendering path to use.
    // This also resets any in-progress state.
    this.renderManager.setUseOctree(needsOctree);
  }

  /**
   * Toggle octree debug visualisation
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

      // Log statistics
      const stats = this.sceneOctree.getStats();
      console.log("Octree Statistics:", stats);
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
        format: material.format,
      };
    }

    if (opacity === null) {
      // Restore original properties
      const orig = material.userData.originalProperties;
      material.transparent = orig.transparent;
      material.opacity = orig.opacity;
      material.depthWrite = orig.depthWrite;
      material.format = orig.format;
    } else {
      // Apply transparency
      material.transparent = true;
      material.opacity = opacity;
      material.depthWrite = false;
      material.format = RGBAFormat;
    }
    material.needsUpdate = true;
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

      // Make non-instanced objects transparent
      this.scene.traverse((object) => {
        if (object.userData.isInstancedMesh || object.userData.isImpostorMesh) return;
        if (
          object.material &&
          !selectedIds.has(object.id) &&
          object !== this.workplane &&
          !this.isWorkplaneChild(object)
        ) {
          this.getMaterials(object).forEach((material) => {
            this.setObjectTransparency(material, TRANSPARENCY_LEVEL);
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

    // Clear transparency first
    this.clearObjectsTransparency();

    // Make objects transparent
    this.setObjectsTransparency();

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

// For server communication written in legacy JS.
window.services.threejs = {
  init: function (initialState) {
    const control = new ThreeJsControl(initialState);
    control.attach();
  },

  sceneChanged: function (container, changes) {
    const control = ThreeJsControl.control(container);
    if (control != null) {
      control.applySceneChanges(changes);
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

  translate: function (container, axis, direction, stepSize) {
    ThreeJsControl.control(container)?.translate(axis, direction, stepSize);
  },

  rotate: function (container, axis, direction, stepSize) {
    ThreeJsControl.control(container)?.rotate(axis, direction, stepSize);
  },

  toggleOctreeDebug: function (container, visible) {
    const control = ThreeJsControl.control(container);
    if (control != null) {
      control.toggleOctreeDebug(visible);
    }
  },
};
