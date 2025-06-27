import {
  AmbientLight,
  AxesHelper,
  Box3,
  Box3Helper,
  BoxBufferGeometry,
  BoxGeometry,
  BoxHelper,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  EdgesGeometry,
  FrontSide,
  Group,
  Line,
  LinearFilter,
  LineBasicMaterial,
  LineSegments,
  LOD,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  RGBAFormat,
  Scene,
  SphereBufferGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";

import { OrbitControls } from "OrbitControls";
import { TransformControls } from "TransformControls";
import { GLTFLoader } from "GLTFLoader";
import { gsap } from "gsap";

const WHITE = 0xffffff;
const LIGHT_GREY = "#cccccc";
const DARK_GREY = "#333333";
const RED = 0xff0000;
const YELLOW = 0xffff00;
const GREEN = 0x00ff00;
const LIGHT_BLUE = 0x77aacc;
const MIDDLE_BLUE = 0x447799;
const DARK_BLUE = 0x001122;
const CUBE_CAMERA_FAR = 10;
const CAMERA_MOVE_DURATION = 1.5;
const C_P_RADIUS = 100;
const WIDTH_SEGMENTS = 8;
const HEIGHT_SEGMENTS = 8;
const _90_DEGREE = Math.PI / 2;
const LOD_MEDIUM_DISTANCE = 500;
const LOD_LOW_DISTANCE = 2000;
const LOD_HIGH = 'high';
const LOD_MEDIUM = 'medium';
const LOD_LOW = 'low';
const OPTIMIZED_PIXEL_RATIO = Math.min(window.devicePixelRatio, 1.7);
const INTERACTIVE_PIXEL_RATIO = Math.min(window.devicePixelRatio, 1.0);
const GRID_SMALL_CELL = 500;
const SNAP_THRESHOLD = 50;
const GRID_SNAP_THRESHOLD = 200;

/**
 * Initial state configuration for ThreeJsControl.
 * @typedef {Object} ThreeJsControlState
 * @property {string} controlId - The ID of the control element.
 * @property {string} contextPath - The context path for loading resources.
 * @property {string} dataUrl - The URL to fetch the scene data.
 * @property {boolean} isWorkplaneVisible - Visibility state of the workplane.
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
    this.scope = new Scope();
    
    this.lastLODLevel = -1;
    this.useLOD = true;
    this.zUpRoot = new Group();
    this.multiTransformGroup = new Group();
    this.areObjectsTransparent = initialState.areObjectsTransparent;
    this.useScreenSpaceSnapping = true;
    
    this.initScene();
    this.initAxesCubeScene();
    this.initRenderer();
    this.initAxesCubeRenderer();
    this.initControls();
    this.initAxesCubeControls();
    this.initTransformControls();
    this.render();
    this.isEditMode = false;
    this.loadScene().then(() => setTimeout(() => {
      this.createBoundingBox();
      this.toggleWorkplane(initialState.isWorkplaneVisible);
      this.updateWorkplanePosition();
      this.toggleEditMode(initialState.isInEditMode);
      this.toggleRotateMode(initialState.isRotateMode);
      this.zoomOut();
      this.updateLODObjects();
    }, 100));
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
    this.multiTransformGroup.rotation.x = -_90_DEGREE;
    this.scene.add(this.multiTransformGroup);
  }

  initRenderer() {
    const container = this.container;
    this.renderer = new WebGLRenderer({
      powerPreference: "high-performance"
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
    this.canvas.addEventListener("mousedown", (event) => this.onMouseDown(event));
    this.canvas.addEventListener("mouseup", (event) => this.onMouseUp(event));
    this.container.addEventListener("wheel", (event) => this.onMouseWheel(event), {
      passive: false,
    });
    
    // Create a MutationObserver to detect DOM changes that might affect layout
    const mutationObserver = new MutationObserver(() => {
        this.updateRendererSize();
    });
    
    // Observe the container and its parent for attribute changes
      mutationObserver.observe(container, { attributes: true, attributeFilter: ['style', 'class'] });
      if (container.parentNode) {
        mutationObserver.observe(container.parentNode, { attributes: true, attributeFilter: ['style', 'class'] });
    }
  }

  initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.reset();
    this.controls.enableZoom = true;
    this.controls.screenSpacePanning = true;

    this.controlsIsUpdating = false;

    this.controls.addEventListener("change", () => {
      if (!this.cubeControlsIsUpdating) {
        this.controlsIsUpdating = true;
        this.cubeCamera.quaternion.copy(this.camera.quaternion);
        this.cubeCamera.position.copy(
          CameraUtils.calculateCubeCameraPosition(this.camera.position, this.controls.target)
        );
        this.cubeControls.update();
        this.controlsIsUpdating = false;
        this.render();
      }
    });
  }

  initAxesCubeScene() {
    this.cubeScene = new Scene();
    this.cubeScene.background = null;

    this.cubeCamera = CameraUtils.createCubeCamera();
    this.cubeTarget = new Vector3(0, 0, 0);
    this.cubeScene.rotation.x = -_90_DEGREE;

    SceneUtils.addCubeSceneLights(this.cubeScene);

    this.axesCube = this.createAxesCube();
    this.cubeScene.add(this.axesCube);

    this.render();
  }

  createAxesCube() {
    const cubeSize = 6;
    const cubeGeometry = new BoxBufferGeometry(cubeSize, cubeSize, cubeSize);
    const cubeMaterials = [
      new MeshStandardMaterial({ map: this.createTextTexture("Right"), side: FrontSide }),
      new MeshStandardMaterial({ map: this.createTextTexture("Left"), side: FrontSide }),    
      new MeshStandardMaterial({ map: this.createTextTexture("Back"), side: FrontSide }),
      new MeshStandardMaterial({ map: this.createTextTexture("Front"), side: FrontSide }),
      new MeshStandardMaterial({ map: this.createTextTexture("Top"), side: FrontSide }), 
      new MeshStandardMaterial({ map: this.createTextTexture("Bottom"), side: FrontSide }),    
    ];

    const cube = new Mesh(cubeGeometry, cubeMaterials);
    cube.position.set(0, 0, 0);

    const edgeGeometry = new EdgesGeometry(cubeGeometry);
    const edgeMaterial = new LineBasicMaterial({ color: DARK_GREY });
    const cubeEdges = new LineSegments(edgeGeometry, edgeMaterial);

    const group = new Group();
    group.add(cube);
    group.add(cubeEdges);

    this.originalMaterials = cubeMaterials.map((material) => material.clone());

    return group;
  }

  createTextTexture(text) {
    const size = 256;
    const textCanvas = document.createElement("canvas");
    textCanvas.width = size;
    textCanvas.height = size;
    const context = textCanvas.getContext("2d");

    context.fillStyle = LIGHT_GREY;
    context.fillRect(0, 0, size, size);

    context.fillStyle = DARK_GREY;
    context.font = "bold 70px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";

    context.translate(size / 2, size / 2);

    switch (text) {
      case "Right": context.rotate(-_90_DEGREE);
        break;
      case "Left": context.rotate(_90_DEGREE);
        break;
      case "Back": context.rotate(Math.PI);
        break;
      case "Bottom": context.rotate(Math.PI);
        break;
    }
    context.fillText(text, 0, 0);

    return new CanvasTexture(textCanvas);
  }

  initAxesCubeRenderer() {
    const container = this.container;
    this.cubeRenderer = new WebGLRenderer({ alpha: true });
    this.cubeRenderer.shadowMap.enabled = true;
    this.cubeRenderer.setSize(100, 100);
    this.cubeRenderer.setPixelRatio(window.devicePixelRatio);
    this.cubeCanvas = this.cubeRenderer.domElement;
    this.cubeCanvas.style.position = "absolute";
    this.cubeCanvas.style.top = "0";
    container.append(this.cubeCanvas);
    this.cubeCanvas.addEventListener("mousemove", (event) => this.onCubeHover(event), false);
    this.cubeCanvas.addEventListener("mousedown", (event) => this.onMouseDown(event));
    this.cubeCanvas.addEventListener("click", (event) => this.onCubeClick(event), false);
  }

  initAxesCubeControls() {
    this.cubeControls = new OrbitControls(this.cubeCamera, this.cubeCanvas);
    this.cubeControls.enableZoom = false;
    this.cubeControls.enablePan = false;
    this.cubeControls.target.set(0, 0, 0);

    this.cubeControlsIsUpdating = false;

    this.cubeControls.addEventListener("change", () => {
      if (!this.controlsIsUpdating) {
        this.cubeControlsIsUpdating = true;
        this.camera.quaternion.copy(this.cubeCamera.quaternion);
        this.camera.position.copy(
          CameraUtils.calculateMainCameraPosition(this.cubeCamera.position, this.camera.position, this.controls.target)
        );
        this.controls.update();
        this.cubeControlsIsUpdating = false;

        this.render();
      }
    });
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
    this.render();
  }

  updateWorkplanePosition() {
      if (!this.workplane || !this.isWorkplaneVisible) {
        return;
      }
      if (this.sceneGraph && this.sceneGraph.coordinateSystem) {
        const matrixValues = toMatrix(this.sceneGraph.coordinateSystem);
        this.workplane.applyMatrix4(matrixValues.multiply(this.workplane.matrix.clone().invert()));
      }
      this.workplane.updateMatrixWorld(true);
      this.render();
  }

  initTransformControls() {
    const outer = this;
    this.translateControls = new TransformControls(this.camera, this.renderer.domElement);
    this.translateControls.setMode("translate");
    this.translateControls.setSpace("local");
    this.scene.add(this.translateControls);

    const updateRenderTransform = (function () {
      let lastMatrix = new Matrix4();
      let lastWorldMatrixes = {};
      let lastObject = null;

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

            for (const node of outer.multiTransformGroup.children) {
              lastWorldMatrixes[node.id] = node.matrixWorld.clone();
            }

            return;
          }

          // Apply grid snapping to each object in multi-select if both workplane and edit mode are enabled
          if (outer.isWorkplaneVisible && outer.isEditMode && outer.snapToWorkplaneEnabled) {
            outer.multiTransformGroup.children.forEach(node => {
              outer.snapObjectToWorkplane(node);
            });
          }

          // re-map multiTransformGroup children to array of commands
        const commands = outer.multiTransformGroup.children.map(node => {
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
        }).filter(Boolean);        

          outer.sendSceneChanges(commands);
        } else {
          // SINGLE OBJECT MODE
          object.updateMatrixWorld(true);
          const currentMatrix = object.matrix.clone();

          if (event.value) {
            lastMatrix.copy(currentMatrix);
            lastObject = object;
            return;
          }

          outer.snapObject(object);

          const updatedMatrix = object.matrix.clone();
          const diffMatrix = new Matrix4();
          diffMatrix.copy(lastMatrix.clone().invert()).multiply(updatedMatrix);

          const sharedObject = outer.selection[0];
          if (sharedObject) {
            const commands = [sharedObject.notifyTransform(diffMatrix)];
            outer.sendSceneChanges(commands);
          }
        }

        outer.render();
      };
    })();

    this.translateControls.addEventListener("dragging-changed", updateRenderTransform);
    
    this.translateControls.addEventListener("objectChange", (event) => {
      if (event.target.dragging) {
        const selectedObject = event.target.object;
        const isGroup = selectedObject.children.length > 0;
                        
        this.snapObjectToWorkplane(selectedObject);
                        
        if (selectedObject === this.multiTransformGroup) {
          this.render();
          return;
        }
        
        const { closestSnappingPoint } = this.throttledFindClosestSnappingPoint(selectedObject);
        
        if (this.prevClosestSnappingPoint !== closestSnappingPoint) {
          if (this.prevClosestSnappingPoint) {
            this.restoreSnappingPointColor(this.prevClosestSnappingPoint);
          }
          if (closestSnappingPoint) {
            closestSnappingPoint.pointMaterial.color.set(YELLOW);
            let mesh = closestSnappingPoint.node.children[0];
            if (mesh && mesh.isMesh) {
              const highResGeometry = new SphereBufferGeometry(C_P_RADIUS*1.5, WIDTH_SEGMENTS, HEIGHT_SEGMENTS);
              if (!mesh.userData.originalGeometry) {
                mesh.userData.originalGeometry = mesh.geometry;
              }
              mesh.geometry = highResGeometry;
            }
            this.render(); 
          }
          this.prevClosestSnappingPoint = closestSnappingPoint;
        }
      } 
      
      // throttle render calls during dragging
      if (event.target.dragging) {
        if (!this._throttledRender) {
          this._throttledRender = throttle(() => {
            this.render();
          }, 50); 
        }
        this._throttledRender();
      } else {
        this.render();
      }
   });
    this.rotateControls = new TransformControls(this.camera, this.renderer.domElement);
    this.rotateControls.setMode("rotate");
    this.rotateControls.setSpace("local");
    this.scene.add(this.rotateControls);
    this.rotateControls.addEventListener("dragging-changed", updateRenderTransform);
    this.rotateControls.addEventListener("objectChange", () => this.render());

    this.translateControls.enabled = false;
    this.rotateControls.enabled = false;
  }

  updateTransformControls() {
    // hides transform controls
    this.deactivateControl();
    // restores original object positions in the scheneGraph (zUpRoot group)
    this.restoreMultiGroup();


    if (this.isEditMode && this.selection.length) {
    // ONE OBJECT SELECTED
      if (this.selection.length === 1) { 
        const object = this.selection[0].node;
        if (object) {
          this.transformControls.position.set(0, 0, 0);
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
  
    // get actual Three.js nodes from selection
    const selectedNodes = this.selection.map(s => s.node);

    // filter out nodes that are descendants of others to avoid duplicates in the transform group
    const topLevelNodes = selectedNodes.filter(node =>
      !isDescendantOfAny(node, selectedNodes)
    );

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
      const inverseGroupMatrix = new Matrix4().copy(this.multiTransformGroup.matrixWorld).invert();
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
  
        const parentInverse = new Matrix4().copy(node.parent.matrixWorld).invert();
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
      this.render();
    }
  }

  deactivateControl() {
    this.transformControls.enabled = false;
    this.transformControls.detach();
    this.render();
  }

  toggleEditMode(editing) {
    this.isEditMode = editing;
    if (editing) {
        this.enableEditing(); 
    } else {
      this.disableEditing(); 
    }
    
    this.updateConnectionPointsVisibility();

    this.render(); 
  }
  
  updateConnectionPointsVisibility() {
        // Get the currently selected objects
        const selectedNodes = this.selection.map(s => s.node);
        
        const updateVisibility = (object) => {
          if (object.userData.isConnectionPoint) {
            object.visible = this.isEditMode;
          }
          if (object.userData.isLayoutPoint) {
            // object.visible = false; // always hide layout points
            // only show layout points for selected objects
            const parentObject = findParentObject(object);
            object.visible = this.isEditMode && selectedNodes.includes(parentObject);
          }
        };
        
        function findParentObject(layoutPoint) {
          let current = layoutPoint;
          while (current && current.parent) {
            // Check for asset either directly or through nodeRef
            const parentAsset = current.parent?.userData?.asset || current.parent?.userData?.nodeRef?.asset;
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
    this.render(); 
  }

getScreenSpaceDistance(pos1, pos2) {
  const screen1 = pos1.clone().project(this.camera);
  const screen2 = pos2.clone().project(this.camera);
  const canvas = this.renderer.domElement;
  
  const x1 = (screen1.x + 1) * canvas.width / 2;
  const y1 = (-screen1.y + 1) * canvas.height / 2;
  const x2 = (screen2.x + 1) * canvas.width / 2;
  const y2 = (-screen2.y + 1) * canvas.height / 2;
  
  return Math.hypot(x2 - x1, y2 - y1);
}

  findClosestSnappingPoint(selectedObj) {
    // Check if selectedObj has snapping points either directly or through nodeRef
    const selectedObjAsset = selectedObj?.userData?.asset || selectedObj?.userData?.nodeRef?.asset;
    
    if (
      !selectedObj 
    ) {
      return { closestSnappingPoint: null, closestSnappingPointObject: null };
    }
  
    // find all other objects in the scene that have snapping points
    const snappableObjects = [];
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
      const otherObjectAsset = otherObject?.userData?.asset || otherObject?.userData?.nodeRef?.asset;
      
      for (const otherPoint of otherObjectAsset.snappingPoints) {
        const position = new Vector3();
        otherPoint.node.getWorldPosition(position);
        
        const distance = this.useScreenSpaceSnapping 
          ? this.getScreenSpaceDistance(selectedWorldPosition, position)
          : selectedWorldPosition.distanceTo(position);
        
        if (distance < closestDistance) {
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
        snappingPoint.pointMaterial.color.copy(snappingPoint.pointMaterial.userData.originalColor);
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
        const snappedPosition = this.calculateGridSnappedPosition(worldPosition);
        
        // Create translation to snap to grid and workplane
        snapMatrix.makeTranslation(
          snappedPosition.x - worldPosition.x,
          snappedPosition.y - worldPosition.y,
          snappedPosition.z - worldPosition.z
        );
      } else {
        //  Object is not on workplane yet, just snap to workplane at current X,Z
        snapMatrix.makeTranslation(0, -worldPosition.y, 0);
      }
      
      // Apply the translation in world space
      if (object.parent) {
        object.parent.updateMatrixWorld(true);
        
        // Convert world space translation to object's local space
        const parentWorldInverse = new Matrix4().copy(object.parent.matrixWorld).invert();
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
    const nearestGridX = Math.round(worldPosition.x / GRID_SMALL_CELL) * GRID_SMALL_CELL;
    const nearestGridZ = Math.round(worldPosition.z / GRID_SMALL_CELL) * GRID_SMALL_CELL;
    
    // Check if position is close enough to grid lines to snap
    const distanceToGridX = Math.abs(worldPosition.x - nearestGridX);
    const distanceToGridZ = Math.abs(worldPosition.z - nearestGridZ);
    
    // Only snap if within threshold distance
    const snappedX = distanceToGridX <= GRID_SNAP_THRESHOLD ? nearestGridX : worldPosition.x;
    const snappedZ = distanceToGridZ <= GRID_SNAP_THRESHOLD ? nearestGridZ : worldPosition.z;
    
    return {
      x: snappedX,
      y: 0, // Always snap to workplane
      z: snappedZ
    };
  }

  snapObject(selectedObj) {
    const { closestSnappingPoint, closestSnappingPointObject } = this.throttledFindClosestSnappingPoint(selectedObj);
  
    if (closestSnappingPoint && closestSnappingPointObject) {
      closestSnappingPointObject.updateMatrixWorld(true);
      closestSnappingPoint.node.updateMatrixWorld(true);
      selectedObj.updateMatrixWorld(true);
      
      const snappingPointWorldMatrix = closestSnappingPoint.node.matrixWorld.clone();
      
      // convert the world matrix to a local matrix
      if (selectedObj.parent) {
        selectedObj.parent.updateMatrixWorld(true);
        
        // get the inverse of the parent's world matrix
        const parentWorldInverse = new Matrix4().copy(selectedObj.parent.matrixWorld).invert();
        snappingPointWorldMatrix.premultiply(parentWorldInverse);
      } 
      selectedObj.applyMatrix4(snappingPointWorldMatrix.multiply(selectedObj.matrix.clone().invert()));
      selectedObj.updateMatrixWorld(true);
    }
    else if (this.snapToWorkplaneEnabled) {
      this.snapObjectToWorkplane(selectedObj);
    }
  
    this.render();
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
    this.render();
    this.removeBoxHelpers();

    if (this.selection.length === 0) {
      return;
    }
    
    this.boxHelpers = [];
    
    if (this.selection.length > 1 && this.multiTransformGroup.children.length > 0) {
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
    this.render();
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
    this.scene.traverse((object) => {
      if (object.type === "Mesh") {
        this.boundingBox.expandByObject(object);
      }
    });
  }

  createResizeObserver() {
    return new ResizeObserver(throttle(() => {
        this.updateRendererSize();
    }, 100));
  }

  updateRendererSize() {
    if (!this.container) return;
    
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.render();
  }

  onMouseDown(event) {
    this.clickStart = Date.now();
    this.clickButton = event.button; 
  }

  onMouseUp(event) {
    if (this.clickButton != 1) {
      return; // Not click with middle mouse button.
    }
    if (Date.now() - this.clickStart > 500) {
      return; // Not a click.
    }
    const raycaster = getRaycaster(event, this.camera, this.canvas);
    const intersects = raycaster.intersectObjects(this.scene.children, true);

    this.updateSelection(intersects, event.ctrlKey);
    this.render();
  }

  onMouseWheel(event) {
    event.preventDefault();
  
    if (!this._throttledMouseWheel) {
      this._throttledMouseWheel = throttle((event) => {
        const target = this.controls.target;
        this.renderer.setPixelRatio(INTERACTIVE_PIXEL_RATIO);
        const position = this.camera.position;
  
        const offset = new Vector3();
        offset.copy(position);
        offset.sub(target);
  
        const factor = event.deltaY < 0 ? 0.888888889 : 1.125;
        offset.multiplyScalar(factor);
        offset.add(target);
  
        this.camera.position.copy(offset);
  
        this.render();
        this.renderer.setPixelRatio(OPTIMIZED_PIXEL_RATIO);
      }, 50); 
    }
    this._throttledMouseWheel(event);
  }

  onCubeHover(event) {
    if (!this._throttledCubeHover) {
      this._throttledCubeHover = throttle((event) => {
        const raycaster = getRaycaster(event, this.cubeCamera, this.cubeCanvas);
        const intersects = raycaster.intersectObject(this.axesCube.children[0], true);

        const materials = this.axesCube.children[0].material;
        materials.forEach((material, index) => {
          material.color.copy(this.originalMaterials[index].color);
          material.map = this.originalMaterials[index].map;
        });

        if (intersects.length > 0) {
          const intersectedFace = intersects[0].face;
          materials[intersectedFace.materialIndex].color.set("#66bbff");
        }

        this.render();
      }, 100); 
    }
    this._throttledCubeHover(event);
  }

  onCubeClick(event) {
    if (Date.now() - this.clickStart > 500) {
      return; // Not a click
    }
    const raycaster = getRaycaster(event, this.cubeCamera, this.cubeCanvas);
    const intersects = raycaster.intersectObjects(
      this.cubeScene.children,
      true
    );
    const intersectedFace = intersects.find((i) => !!i.face)?.face;

    if (!intersectedFace) return;

    const faceIndex = intersectedFace.materialIndex;

    const facePositions = {
      0: { x: 10, y: 0, z: 0 }, // Right
      1: { x: -10, y: 0, z: 0 }, // Left
      2: { x: 0, y: 0, z: -10 }, // Back
      3: { x: 0, y: 0, z: 10 }, // Front
      4: { x: 0, y: 10, z: 1 }, // Top
      5: { x: 0, y: -10, z: 1 }, // Bottom
    };

    const newPos = facePositions[faceIndex];

    gsap.to(this.cubeControls.object.position, {
      x: newPos.x,
      y: newPos.y,
      z: newPos.z,
      duration: CAMERA_MOVE_DURATION,
      ease: "power2.out",
      onUpdate: () => {
        this.cubeControls.update();
        this.render();
      },
      onComplete: () => {
        this.render();
      },
    });
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
    let targetDistance = (maxSize / 2) / Math.tan(fov / 2);

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
          this.render();
        },
        onComplete: () => {
          this.lastSelectedObject = selectedObject;
          this.controls.enableDamping = true;
          this.controls.update();
          this.render();
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
          this.render();
        },
      });
    }
    this.render();
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
    const distance = (maxSize / 2) / Math.tan(fov / 2);

    const targetZoomOutPosition = new Vector3(
      center.x + 12000, // for looking a bit at the right side
      center.y + 15000, // for looking a bit from the top
      center.z + distance
    );

    gsap.to(this.controls.object.position, {
      x: targetZoomOutPosition.x,
      y: targetZoomOutPosition.y,
      z: targetZoomOutPosition.z,
      duration: CAMERA_MOVE_DURATION,
      ease: "power3.inOut",
      onUpdate: () => {
        this.controls.update();
        this.render();
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
        this.render();
      },
      onComplete: () => {
        this.lastSelectedObject = null;
        this.controls.update();
        this.render();
      },
    });
  }

  /** Applies the changes in the scene as received from the server. */
  applySceneChanges(changesString) {
    try {
      const changes = JSON.parse(changesString);
      for (const change of changes) {
        var command = change[0];
        var cmdProps = command[1];

        var cmd;
        switch (command[0]) {
          case 'R': cmd = new RemoveElement(cmdProps["id"]); break;
          case 'I': cmd = new InsertElement(cmdProps["id"]); break;
          case 'S': cmd = new SetProperty(cmdProps["id"]); break;
        }
        change.shift();
        cmd.loadJson(cmdProps, change);
        cmd.apply(this.scope);
      }

      this.sceneGraph.reload(this.scope);
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
      this.setColor(sharedNode.node, WHITE);
      this.selection.splice(index, 1);
      
      command = this.sceneGraph.removeSelected(sharedNode); 
    } else {
      // Currently not selected
      if (!value) {
        // Cannot remove from selection
        return;
      }
      this.setColor(sharedNode.node, RED);
      this.selection.push(sharedNode);
      
      command = this.sceneGraph.addSelected(sharedNode); 
    }
    
    this.updateObjectsTransparency();
    this.updateTransformControls();
    this.updateConnectionPointsVisibility();
    
    return command;
  }

  // applies red color to selected shared objects from the graphScene
  applySelection(selectedSharedNodes) {
    // remove selection from the previously selected objects
    for (const shared3JSNode of this.selection) {
      this.setColor(shared3JSNode.node, WHITE);
    }
    this.selection = [];

    // apply selection to new objects that have to be selected
    for (const shared3JSNode of selectedSharedNodes) {
      this.setColor(shared3JSNode.node, RED);
      this.selection.push(shared3JSNode);
    }

    this.updateObjectsTransparency();
  }

  setColor(node, color) {
    if (!node) {
      return;
    }

    if (color === WHITE) {
        let rootNode = node;
        while (rootNode?.parent) {
          const c = rootNode.userData?.color;
          if (typeof c === 'string') {
            // console.log('Applying color from userData:', c);
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

      this.candidate = clicked;
      while (this.candidate != null) {
        const data = this.candidate.userData;
        const sharedNode = data?.nodeRef;
        if (sharedNode instanceof SharedObject) {
          this.value = toggleMode
            ? !this.selection.includes(sharedNode)
            : true;
          const setCmd = this.setSelected(sharedNode, this.value);
	      if (setCmd != null) {
            changes.push(setCmd);
          }

          // this.addBoxHelpers();

          this.render();

          this.sendSceneChanges(changes);
          return;
        }

        this.candidate = this.candidate.parent;
      }
    }

    if (changes.length > 0) {
      this.sendSceneChanges(changes);
    }
  }

  clearSelection() {
    for (const sharedNode of this.selection) {
      this.setColor(sharedNode.node, WHITE);
    }
    this.selection.length = 0;
    this.clearObjectsTransparency();

    this.updateConnectionPointsVisibility();

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
    this.sceneGraph.buildGraph(this);
    this.scope.loadAssets(this).then(() => this.updateObjectsTransparency());

    this.camera.position.applyMatrix4(this.scene.matrix);
    this.camera.updateProjectionMatrix();
    this.updateTransformControls();

    this.render();
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

  updateLODObjects() {
    if (!this._throttledUpdateLOD) {
      this._throttledUpdateLOD = throttle(() => {
        if (!this.camera || !this.zUpRoot) return;
        this.zUpRoot.traverse(node => {
          if (node.isLOD) {
            // LOD objects automatically update based on camera distance
            node.update(this.camera);
          }
        });
      }, 100); 
    }
    this._throttledUpdateLOD();
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
        format: material.format
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
      if (object.material) {
        this.getMaterials(object).forEach((material) => {
          if (material.transparent && material.opacity < 1.0) {
            this.setObjectTransparency(material, null);
          }
        });
      }
    });
  }

  toggleObjectsTransparent(shouldBeTransparent) {    
    this.areObjectsTransparent = shouldBeTransparent;
    this.updateObjectsTransparency();
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
     // Always clear transparency first
    this.clearObjectsTransparency();

    if (this.areObjectsTransparent && this.selection.length > 0) {
      const selectedIds = new Set()
      this.selection.forEach(sharedNode => {
        if (sharedNode.node) {
          sharedNode.node.traverse(child => {
            selectedIds.add(child.id);
          });
        }
      });

      this.scene.traverse((object) => {
        if (object.material && !selectedIds.has(object.id) && object !== this.workplane && !this.isWorkplaneChild(object)) {
          this.getMaterials(object).forEach((material) => {
            // Make non-selected objects 30% transparent
            this.setObjectTransparency(material, 0.3); 
          });
        }
      });
    }

    this.render();
  }

  render() {
    requestAnimationFrame(() => {
      const { renderer, cubeRenderer, scene, camera, cubeScene, cubeCamera } = this;

      // update LOD objects if enabled
      if (this.useLOD) {
        this.updateLODObjects();
      }

      renderer.render(scene, camera);
        cubeRenderer.render(cubeScene, cubeCamera);
    });
  }
}

class SharedObject {
  constructor(id) {
    this.id = id;
  }
  
  notifyTransform(diffMatrix) {
    const currentTransformation = toMatrix(this.transform);
    const newTransformation = currentTransformation.multiply(diffMatrix);
    this.transform = toTX(newTransformation);
    return SetProperty.prototype.create(this.id, 'transform', this.transform);
  }
}

class Scope {
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
    const contextPath = ctrl.contextPath;
    const gltfLoader = new GLTFLoader();
    
    // track loading progress
    let totalAssets = 0;
    let loadedAssets = 0;

    const loadUrl = (localURL) =>
      new Promise((resolve, reject) => {
        if (localURL == null) {
            resolve(null);
            return;
        }
        const url = contextPath + localURL;
        try {
          totalAssets++;
          
          // if gltf for the given url exists in the cache let's return it
          if (this.gltfs[url]) {
            loadedAssets++;
            // console.log(`Loading from cache: ${url} (${loadedAssets}/${totalAssets})`);
            resolve(this.gltfs[url]);
            return;
          }

          // console.log(`Loading model: ${url} (${loadedAssets}/${totalAssets})`);
          
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
    const loadURLs = async (localURLs, assetsByURL) => {
      // console.log(`Loading URLS: ${localURLs}`);
      await Promise.all(localURLs.map(loadUrl));
      for (const url of localURLs) {
        const gltf = this.gltfs[contextPath + url];
        if (gltf != null) {
          for (const asset of assetsByURL.get(url)) {
            asset.setGLTF(gltf, ctrl);
          }
        }
      }
      ctrl.render();
    };

    // load assets in batches to prevent overwhelming the browser
    const assetsByURL = Map.groupBy(this.assets, asset => asset.url);
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

class SceneGraph extends SharedObject {
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
			// console.log(`Changing coordinate system: ${value}`)
  			this.coordinateSystem = value;
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

class ConnectionPoint extends SharedObject {
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

class GroupNode extends SharedObject {
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

    // Link to scene node
    group.userData = {
      ...group.userData,
      nodeRef: this,
      color: this.color || null
    };
    this.node = group;
  }

  loadJson(scope, json) {
    this.setProperty(scope, 'contents', json.contents);
    this.setProperty(scope, 'transform', json.transform);
    this.setProperty(scope, 'hidden', json.hidden);
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
   		case 'color': this.color = value; break;
   		case 'hidden': this.hidden = value; break;
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

class PartNode extends SharedObject {
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
    this.node = group;
  }

  loadJson(scope, json) {
    this.setProperty(scope, 'asset', json.asset);
    this.setProperty(scope, 'transform', json.transform);
    this.setProperty(scope, 'hidden', json.hidden);
    this.setProperty(scope, 'color', json.color);
  }

  setProperty(scope, property, value) {
    switch (property) {
  		case 'asset': this.asset = scope.loadJson(value); break; 
   		case 'transform': this.transform = value; break;
   		case 'color': this.color = value; break;
   		case 'hidden': {
        if (value) {
          console.log(`Hiding part '${this.id}'`);
        }
        this.hidden = value; break;
      } 
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

class GltfAsset extends SharedObject {
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

    // const model = this.gltf.scene.clone();
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
      // console.log('[GltfAsset] Using standard rendering');
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
    // console.log(`[LOD] Creating ${detailLevel} detail level`);
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
    this.setProperty(scope, 'layoutPoint', json.layoutPoint);
    this.setProperty(scope, 'snappingPoints', json.snappingPoints);
  }

  setProperty(scope, property, value) {
    switch (property) {
  		case 'url': this.url = value; break;
  		case 'layoutPoint': this.layoutPoint = scope.loadJson(value); break; 
  		case 'snappingPoints': this.snappingPoints = scope.loadAll(value); break; 
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

class Command {
  constructor(id) {
    this.id = id;
  }
  
  resolveTarget(scope) {
  	return scope.getNode(this.id);
  }
}

class SetProperty extends Command {
  constructor(id) {
    super(id);
  }
  
  loadJson(props, additional) {
    this.property = props["p"];
    this.value = additional[0];
  }
  
  create(id, property, value) {
  	const cmd = new SetProperty(id);
  	cmd.property = property;
  	cmd.value = value;
  	return cmd;
  }
  
  apply(scope) {
  	var target = this.resolveTarget(scope);
  	if (target == null) {
  		return;
  	}
  	target.setProperty(scope, this.property, this.value);
  }
  
  
  extract() {
  	return [["S", {id: this.id, p: this.property}], this.value]; 
  }
}

class ListUpdate extends Command {
  constructor(id) {
    super(id);
  }
}

class InsertElement extends ListUpdate {
  constructor(id) {
    super(id);
  }

  loadJson(props, additional) {
    this.idx = props["i"];
    this.property = props["p"];
    this.element = additional[0];
  }

  create(id, property, idx, element) {
  	const cmd = new InsertElement(id);
  	cmd.property = property;
  	cmd.idx = idx;
  	cmd.element = element;
  	return cmd;
  }
  
 apply(scope) {
  	var target = this.resolveTarget(scope);
  	if (target == null) {
  		return;
  	}
  	target.insertElementAt(scope, this.property, this.idx, this.element);
  }

  extract() {
  	return [["I", {id: this.id, p: this.property, i: this.idx}], this.element]; 
  }
}

class RemoveElement extends ListUpdate {
  constructor(id) {
    super(id);
  }
  
  loadJson(props, additional) {
    this.idx = props["i"];
    this.property = props["p"];
  }

  create(id, property, idx, element) {
  	const cmd = new RemoveElement(id);
  	cmd.property = property;
  	cmd.idx = idx;
  	return cmd;
  }

  apply(scope) {
  	var target = this.resolveTarget(scope);
  	if (target == null) {
  		return;
  	}
  	target.removeElementAt(scope, this.property, this.idx);
  }

  extract() {
  	return [["R", {id: this.id, p: this.property, i: this.idx}]]; 
  }
}

function applyColorToObject(object, colorString) {
  const color = new Color(colorString);
  
  object.traverse((child) => {
    if (child.isMesh && child.material) {
      // Handle array of materials
      if (Array.isArray(child.material)) {
        child.material.forEach(material => {
          material.color.copy(color);
        });
      } else {
        // Apply new color by copying values (not replacing the object)
        child.material.color.copy(color);
      }
    }
  });
}

// throttle function to limit how often a function can be called
const throttle = (func, limit) => {
  let inThrottle = false;
  let lastResult = null;
  
  return function(...args) {
    if (!inThrottle) {
      inThrottle = true;
      lastResult = func.apply(this, args);
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
    
    return lastResult;
  };
};

function getRaycaster(event, camera, canvas) {
  const raycaster = new Raycaster();
  const mouse = new Vector2();

  const rect = canvas.getBoundingClientRect();
  const mousePos = {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
  mouse.x = (mousePos.x / canvas.clientWidth) * 2 - 1;
  mouse.y = -(mousePos.y / canvas.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  return raycaster;
}

function getLocalMatrix(objectMatrixWorld, parentMatrixWorld) {
  const worldMatrix = objectMatrixWorld.clone();
  const parentInverse = new Matrix4().copy(parentMatrixWorld).invert();
  const localMatrix = new Matrix4().multiplyMatrices(parentInverse, worldMatrix);

  return localMatrix;
}

function getMatrixDiff(m1, m2) {
  const diffMatrix = new Matrix4();
  diffMatrix.copy(m1.clone().invert()).multiply(m2);

  return diffMatrix;
}

function matrix(
	a, b, c, d,
	e, f, g, h,
	i, j, k, l,
	m, n, o, p
) {
  const result = new Matrix4();
	result.set(
		a, b, c, d,
		e, f, g, h,
		i, j, k, l,
		m, n, o, p
	);
  return result;
}

function toMatrix(tx) {
  switch (tx.length) {
    case 3:
		return matrix(
			1, 0, 0, tx[0],
			0, 1, 0, tx[1],
			0, 0, 1, tx[2],
			0, 0, 0, 1);
    case 9:
      return matrix(
			tx[0], tx[1], tx[2], 0,
			tx[3], tx[4], tx[5], 0,
			tx[6], tx[7], tx[8], 0,
			0,     0,     0,     1);
    case 12:
      return matrix(
			tx[0], tx[1], tx[2], tx[9],
			tx[3], tx[4], tx[5], tx[10],
			tx[6], tx[7], tx[8], tx[11],
			0,     0,     0,     1);
    case 16:
      return matrix(
			tx[0],  tx[1],  tx[2],  tx[3],
			tx[4],  tx[5],  tx[6],  tx[7],
			tx[8],  tx[9],  tx[10], tx[11],
			tx[12], tx[13], tx[14], tx[15]);
    default:
      throw new Error("Invalid transform array: " + tx);
  }
}

function toTX(matrix4) {
  const el = matrix4.elements;
  return [ el[0], el[4], el[8], el[1], el[5], el[9], el[2],  el[6],  el[10],  el[12],  el[13],  el[14] ];
}

function transform(group, tx) {
  if (tx != null && tx.length > 0) {
    if (tx.length == 3) {
      group.position.set(tx[0], tx[1], tx[2]);
    } else {
      group.applyMatrix4(toMatrix(tx));
    }
  }
}

function isDescendantOfAny (node, selectedNodes) {
  let parent = node.parent;
  while (parent) {
    if (selectedNodes.includes(parent)) return true;
    parent = parent.parent;
  }
  return false;
}

function createLine(start, end, color, linewidth) {
  const geometry = new BufferGeometry().setFromPoints([start, end]);
  const material = new LineBasicMaterial({ color, linewidth });
  return new Line(geometry, material);
}

const CameraUtils = {
  calculateCubeCameraPosition: function(cameraPosition, controlsTarget) {
    const subAxesOffset = new Vector3().subVectors(cameraPosition, controlsTarget);
    return subAxesOffset.normalize().multiplyScalar(CUBE_CAMERA_FAR);
  },

  calculateMainCameraPosition: function(cubeCameraPosition, cameraPosition, controlsTarget) {
    let subMainOffset = new Vector3(...cubeCameraPosition.toArray());
    const cameraOffset = new Vector3().subVectors(cameraPosition, controlsTarget);

    subMainOffset.normalize().multiplyScalar(cameraOffset.length());
    subMainOffset = new Vector3().addVectors(subMainOffset, controlsTarget);
    return subMainOffset;
  },
  
  createMainCamera: function(container, position = new Vector3(5000, 6000, 10000)) {
    const fov = 35; // AKA Field of View
    const aspect = container.clientWidth / container.clientHeight;
    const near = 10; // the near clipping plane
    const far = 600000; // the far clipping plane

    const camera = new PerspectiveCamera(fov, aspect, near, far);
    camera.position.copy(position);
    camera.lookAt(new Vector3());
    
    return camera;
  },
  
  createCubeCamera: function() {
    const fov = 75;
    const aspect = 1;
    const near = 1;
    const far = 20;

    const camera = new PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(0, 0, CUBE_CAMERA_FAR);
    camera.lookAt(new Vector3(0, 0, 0));
    
    return camera;
  }
};

const SceneUtils = {
  createLine: function(start, end, color, linewidth) {
    const geometry = new BufferGeometry().setFromPoints([start, end]);
    const material = new LineBasicMaterial({ color, linewidth });
    return new Line(geometry, material);
  },

  createDetailedGrid: function(size) {
    const z = 0;
    const edge = size / 2;
    const gridGroup = new Group();

    const smallCell = GRID_SMALL_CELL;
    const bigCell = smallCell * 10;

    const gridSmall = new Group();
    // vertical lines
    for (let i = 0; i <= edge; i += smallCell) {
      gridSmall.add(createLine(new Vector3(-i, -edge, z), new Vector3(-i, edge, z), LIGHT_BLUE, 1));
      gridSmall.add(createLine(new Vector3(i, -edge, z), new Vector3(i, edge, z), LIGHT_BLUE, 1));
    }
    // horizontal lines
    for (let i = z; i <= edge; i += smallCell) {
      gridSmall.add(createLine(new Vector3(-edge, -i, z), new Vector3(edge, -i, z), LIGHT_BLUE, 1));
      gridSmall.add(createLine(new Vector3(-edge, i, z), new Vector3(edge, i, z), LIGHT_BLUE, 1));
    }

    const gridBig = new Group();
    for (let i = bigCell; i <= edge; i += bigCell) {
      // vertical lines
      gridBig.add(createLine(new Vector3(-i, -edge, z), new Vector3(-i, edge, z), MIDDLE_BLUE, 2));
      gridBig.add(createLine(new Vector3(i, -edge, z), new Vector3(i, edge, z), MIDDLE_BLUE, 2));
      // horizontal lines
      gridBig.add(createLine(new Vector3(-edge, -i, z), new Vector3(edge, -i, z), MIDDLE_BLUE, 2));
      gridBig.add(createLine(new Vector3(-edge, i, z), new Vector3(edge, i, z), MIDDLE_BLUE, 2));
    }

    const gridEdgeCenter = new Group();
    const thickestLines = [
      // vertical outer lines
      [new Vector3(-edge, -edge, z), new Vector3(-edge, edge, z)],
      [new Vector3(edge, -edge, z), new Vector3(edge, edge, z)],
      // horizontal outer lines
      [new Vector3(-edge, -edge, z), new Vector3(edge, -edge, z)],
      [new Vector3(-edge, edge, z), new Vector3(edge, edge, z)],
      // central lines
      [new Vector3(0, -edge, z), new Vector3(0, edge, z)],
      [new Vector3(-edge, 0, z), new Vector3(edge, 0, z)]
    ];
    thickestLines.forEach(([start, end]) => {
      gridEdgeCenter.add(createLine(start, end, DARK_BLUE, 3));
    });

    gridGroup.add(gridSmall);
    gridGroup.add(gridBig);
    gridGroup.add(gridEdgeCenter);

    return gridGroup;
  },
  
  addStandardLights: function(scene) {
    const light1 = new DirectionalLight(WHITE, 8);
    light1.position.set(0, 5000, 1000);
    scene.add(light1);

    const light2 = new DirectionalLight(WHITE, 3);
    light2.position.set(200, -3000, -3000);
    scene.add(light2);
    
    return { mainLight: light1, secondaryLight: light2 };
  },
  
  addCubeSceneLights: function(scene) {
    scene.add(new AmbientLight(WHITE, 0.7));
    
    const light = new DirectionalLight(WHITE, 0.5);
    light.position.set(3, 5, 8);
    light.castShadow = true;
    scene.add(light);
    
    const light2 = new DirectionalLight(WHITE, 0.5);
    light2.position.set(-3, -5, 0);
    light2.castShadow = true;
    scene.add(light2);
    
    return { ambientLight: scene.children[0], mainLight: light, secondaryLight: light2 };
  },
  
  getRaycaster: function(event, camera, canvas) {
    const raycaster = new Raycaster();
    const mouse = new Vector2();

    const rect = canvas.getBoundingClientRect();
    const mousePos = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    mouse.x = (mousePos.x / canvas.clientWidth) * 2 - 1;
    mouse.y = -(mousePos.y / canvas.clientHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    return raycaster;
  }
};

// For sever communication written in legacy JS.
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
  }
};