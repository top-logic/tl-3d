import {
  Color,
  PerspectiveCamera,
  Matrix4,
  Group,
  Scene,
  DirectionalLight,
  AmbientLight,
  WebGLRenderer,
  Raycaster,
  Box3,
  Quaternion,
  Vector3,
  Vector2,
  AxesHelper,
  BoxHelper,
  Box3Helper,
  BoxGeometry,
  BufferGeometry,
  Line,
  Mesh,
  MeshStandardMaterial,
  MeshBasicMaterial,
  SphereGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  CanvasTexture,
  FrontSide
} from "three";

import { OrbitControls } from "OrbitControls";
import { TransformControls } from "TransformControls";
import { GLTFLoader } from "GLTFLoader";
import { gsap } from "gsap";

const WHITE_LIGHT = "#ffffff";
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
const HEIGHT_SEGMENTS = 8

class ThreeJsControl {
  constructor(controlId, contextPath, dataUrl, isWorkplaneVisible, isInEditMode, isRotateMode) {
    this.lastSelectedObject = null;
    this.controlId = controlId;
    this.contextPath = contextPath;
    this.dataUrl = dataUrl;
    this.scope = new Scope();
 
    this.zUpRoot = new Group();
    this.multiTransformGroup = new Group();
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
      this.toggleWorkplane(isWorkplaneVisible);
      this.toggleEditMode(isInEditMode);
      this.toggleRotateMode(isRotateMode);
      this.zoomOut();
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

    this.zUpRoot.rotation.x = -Math.PI / 2;
    this.scene.add(this.zUpRoot);
    this.multiTransformGroup.rotation.x = -Math.PI / 2;
    this.scene.add(this.multiTransformGroup);
  }

  initRenderer() {
    const container = this.container;
    this.renderer = new WebGLRenderer();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.canvas = this.renderer.domElement;
    this.canvas.style.maxWidth = "100%";
    this.canvas.style.maxHeight = "100%";
    container.append(this.canvas);
    // update objects' size when the size of the canvas changes
    const resizeObserver = this.createResizeObserver(this.canvas);
    resizeObserver.observe(this.canvas);
    this.canvas.addEventListener("mousedown", () => this.onMouseDown());
    this.canvas.addEventListener("click", (event) => this.onClick(event));
    this.container.addEventListener("wheel", (event) => this.onMouseWheel(event), {
      passive: false,
    });
    LayoutFunctions.addCustomRenderingFunction(container.parentNode, () => {
      this.renderer.setSize(container.clientWidth, container.clientHeight);
      this.render();
    });
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
          calculateCubeCameraPosition(this.camera.position, this.controls.target)
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

    const fov = 75;
    const aspect = 1;
    const near = 1;
    const far = 20;

    this.cubeCamera = new PerspectiveCamera(fov, aspect, near, far);
    this.cubeCamera.position.set(0, 0, CUBE_CAMERA_FAR);
    this.cubeTarget = new Vector3(0, 0, 0);
    this.cubeCamera.lookAt(this.cubeTarget);
    this.cubeScene.rotation.x = -Math.PI / 2;

    this.cubeScene.add(new AmbientLight(WHITE_LIGHT, 0.7));
    const light = new DirectionalLight(WHITE_LIGHT, 0.5);
    light.position.set(3, 5, 8);
    light.castShadow = true;
    this.cubeScene.add(light);
    const light2 = new DirectionalLight(WHITE_LIGHT, 0.5);
    light2.position.set(-3, -5, 0);
    light2.castShadow = true;
    this.cubeScene.add(light2);

    this.axesCube = this.createAxesCube();
    this.cubeScene.add(this.axesCube);

    this.render();
  }

  createAxesCube() {
    const cubeSize = 6;
    const cubeGeometry = new BoxGeometry(cubeSize, cubeSize, cubeSize);
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
      case "Right": context.rotate(-Math.PI / 2);
        break;
      case "Left": context.rotate(Math.PI / 2);
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
    this.cubeCanvas.addEventListener("mousedown", () => this.onMouseDown());
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
          calculateMainCameraPosition(this.cubeCamera.position, this.camera.position, this.controls.target)
        );
        this.controls.update();
        this.cubeControlsIsUpdating = false;

        this.render();
      }
    });
  }

  createCamera() {
    const container = this.container;
    const fov = 35; // AKA Field of View
    const aspect = container.clientWidth / container.clientHeight;
    const near = 10; // the near clipping plane
    const far = 100000; // the far clipping plane

    this.camera = new PerspectiveCamera(fov, aspect, near, far);
    this.camera.position.set(5000, 6000, 10000);
    this.camera.lookAt(new Vector3());
  }

  addLights() {
    const light1 = new DirectionalLight(WHITE_LIGHT, 8);
    light1.position.set(0, 5000, 1000);
    this.scene.add(light1);

    const light2 = new DirectionalLight(WHITE_LIGHT, 3);
    light2.position.set(200, -3000, -3000);
    this.scene.add(light2);
  }

  toggleWorkplane(visible) {
    if (!this.boundingBox) {
      return;
    }

    if (!this.workplane) {
      const boxSize = new Vector3();
      this.boundingBox.getSize(boxSize);
      const gridSize = Math.max(boxSize.x, boxSize.y, boxSize.z) * 1.5;

      this.workplane = createDetailedGrid(gridSize);
      this.workplane.rotation.x = Math.PI / 2;
    }

    if (visible) {
      this.scene.add(this.workplane);
    } else {
      this.scene.remove(this.workplane);
    }

    this.isWorkplaneVisible = visible;
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
    this.translateControls.addEventListener("objectChange", () => this.render());
    this.rotateControls = new TransformControls(this.camera, this.renderer.domElement);
    this.rotateControls.setMode("rotate");
    this.rotateControls.setSpace("local");
    this.scene.add(this.rotateControls);
    this.rotateControls.addEventListener("dragging-changed", updateRenderTransform);
    this.rotateControls.addEventListener("objectChange", () => this.render());

    this.translateControls.enabled = false;
    this.rotateControls.enabled = false;
  }

  /**
   * Syncs the content of multiTransformGroup and selected shared objects
   */
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
   let tmpPosition = new Vector3();
   let tmpQuaternion = new Quaternion();
   let tmpScale = new Vector3();
  
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

    // create a Set to check ancestry
    const selectedSet = new Set(selectedNodes);

    // filter out nodes that are descendants of others to avoid duplicates in the transform group
    const topLevelNodes = selectedNodes.filter(node =>
      !isDescendantOfAny(node, selectedSet)
    );

    // find top-level node in selection.
    let leadingSelection = null;
    let tmp = selectedNodes[0];
    while (true) {
        if (topLevelNodes.indexOf(tmp) >= 0) {
            leadingSelection = tmp;
            break;
    	}
    	tmp = tmp.parent;
    }

    let gizmoMatrix = leadingSelection.matrixWorld.clone();
    gizmoMatrix.decompose(tmpPosition, tmpQuaternion, tmpScale);
    
    this.multiTransformGroup.position.copy(tmpPosition);
    this.multiTransformGroup.quaternion.copy(tmpQuaternion);
    this.multiTransformGroup.scale.copy(tmpScale);
    this.multiTransformGroup.updateMatrixWorld(true);
    
    this.transformControls.position.set(0,0,0); // set transformControls.position manually
  
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
      // expand the bounding box for the group
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

    this.render(); 
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

  // "M(0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0) T(1826.0, 0.0, 2300.0)"
  snapObject(selectedObj) {
    if (
      !selectedObj ||
      !selectedObj.userData ||
      !selectedObj.userData.snappingPoints ||
      selectedObj.userData.snappingPoints.length === 0
    ) {
      return;
    }
  
    // find all other objects in the scene that have snapping points
    const snappableObjects = [];
    this.zUpRoot.traverse((node) => {
      if (
        node !== selectedObj &&
        node.userData &&
        node.userData.snappingPoints &&
        node.userData.snappingPoints.length > 0
      ) {
        snappableObjects.push(node);
      }
    });
  
    if (snappableObjects.length === 0) return;
  
    selectedObj.updateMatrixWorld(true);
  
    // find the closest pair of snapping points
    let closestDistance = 1000;
    let closestSnappingPoint = null;
    let closestSnappingPointObject = null;

    const selectedWorldPosition = new Vector3();
    selectedObj.getWorldPosition(selectedWorldPosition);
  
    for (const otherObject of snappableObjects) {
      otherObject.updateMatrixWorld(true);
  
      for (const otherPoint of otherObject.userData.snappingPoints) {
        const position = new Vector3();
        otherPoint.node.getWorldPosition(position);
        
        const distance = selectedWorldPosition.distanceTo(position);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestSnappingPoint = otherPoint;
          closestSnappingPointObject = otherObject;
        }
      }
    }
  
    if (closestSnappingPoint) {
      closestSnappingPointObject.updateMatrixWorld(true);
      closestSnappingPoint.node.updateMatrixWorld(true);
      selectedObj.updateMatrixWorld(true);
      
      const snappingPointWorldMatrix = closestSnappingPoint.node.matrixWorld.clone();
      
      // convert the world matrix to a local matrix
      if (selectedObj.parent) {
        selectedObj.parent.updateMatrixWorld(true);
        
        // get the inverse of the parent's world matrix
        const parentWorldInverse = new Matrix4().copy(selectedObj.parent.matrixWorld).invert();
        
        // apply the parent's inverse world matrix to get the local matrix
        // convert the snapping point's world matrix to be relative to the selected object's parent
        const localMatrix = new Matrix4().copy(snappingPointWorldMatrix).premultiply(parentWorldInverse);
        
        // apply the local matrix directly to the object's matrix
        selectedObj.matrix.copy(localMatrix);
        
        // IMPORTANT! Disable automatic matrix updates so manual matrix assignment (via .matrix.copy) is saved
        selectedObj.matrixAutoUpdate = false;
      } else {
        // if there's no parent, apply the world matrix directly
        selectedObj.matrix.copy(snappingPointWorldMatrix);
        selectedObj.matrixAutoUpdate = false;
      }
      
      selectedObj.updateMatrixWorld(true);
    }
  
    this.render();
  }

  addAxesHelper(scene) {
    const axesHelper = new AxesHelper(1000);
    scene.add(axesHelper);
    axesHelper.rotation.x = -Math.PI / 2;
  }

  addBoxHelpers() {

    // show bounding box around all objects
    // this.boundingBoxHelper = new Box3Helper(this.boundingBox, YELLOW);
    // this.scene.add(this.boundingBoxHelper);
    // this.render();
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

  createResizeObserver(canvas) {
    return new ResizeObserver(() => {
      this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
      this.camera.updateProjectionMatrix();
      this.render();
    });
  }

  onMouseDown() {
    this.clickStart = Date.now();
  }

  onClick(event) {
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

    const target = this.controls.target;
    const position = this.camera.position;

    const offset = new Vector3();
    offset.copy(position);
    offset.sub(target);

    const factor = event.deltaY < 0 ? 0.888888889 : 1.125;
    offset.multiplyScalar(factor);
    offset.add(target);

    this.camera.position.copy(offset);

    this.render();
  }

  onCubeHover(event) {
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
      x: 0, y: 0, z: 0,
      // x: center.x,
      // y: center.y,
      // z: center.z,
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
    var command;
    if (index >= 0) {
      // Currently selected.
      if (value) {
        // Do not select again.
        return;
      }
      this.setColor(sharedNode.node, 0xffffff);
      this.selection.splice(index, 1);
      
      command = this.sceneGraph.removeSelected(sharedNode); 
    } else {
      // Currently not selected.
      if (!value) {
        // Cannot remove from selection.
        return;
      }
      this.setColor(sharedNode.node, RED);
      this.selection.push(sharedNode);
      
      command = this.sceneGraph.addSelected(sharedNode); 
    }
    this.updateTransformControls();

    return command;
  }

  // applies red color to selected shared objects from the graphScene
  applySelection(selectedSharedNodes) {
    // remove selection from the previously selected objects
    for (const shared3JSNode of this.selection) {
      this.setColor(shared3JSNode.node, 0xffffff);
    }
    this.selection = [];

    // apply selection to new objects that have to be selected
    for (const shared3JSNode of selectedSharedNodes) {
      this.setColor(shared3JSNode.node, RED);
      this.selection.push(shared3JSNode);
    }
  }

  setColor(node, color) {
    if (node.material) {
      node.material.color.set(color);
    } else {
      for (const child of node.children) {
        this.setColor(child, color);
      }
    }
  }

  /** Updates the selection from a click on the canvas. */
  updateSelection(intersects, toggleMode) {
    const changes = [];

    if (!toggleMode) {
      var clearCmd = this.clearSelection();
      if (clearCmd != null) {
        changes.push(clearCmd);
      }
    }

    for (let i = 0; i < intersects.length; i++) {
      const clicked = intersects[i].object;

      this.candidate = clicked;
      while (this.candidate != null) {
        const sharedNode = this.candidate.userData;
        if (sharedNode instanceof SharedObject) {
          this.value = toggleMode
            ? !this.selection.includes(sharedNode)
            : true;
          var setCmd = this.setSelected(sharedNode, this.value);
	      if (setCmd != null) {
	        changes.push(setCmd);
	      }

          this.addBoxHelpers();

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
      this.setColor(sharedNode.node, 0xffffff);
    }
    this.selection.length = 0;

    this.disableEditing();
    return this.sceneGraph.clearSelection();
  }

  get container() {
    return document.getElementById(this.controlId);
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
    await this.scope.loadAssets(this.contextPath);
    this.sceneGraph.buildGraph(this);

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

  render() {
    requestAnimationFrame(() => {
      const { renderer, cubeRenderer, scene, camera, cubeScene, cubeCamera } = this;
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
    const currentTransformation = toMatrix(this.layoutPoint.transform);
    const newTransformation = currentTransformation.multiply(diffMatrix);
    this.layoutPoint.transform = toTX(newTransformation);
    return SetProperty.prototype.create(this.layoutPoint.id, 'transform', this.layoutPoint.transform);
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

  async loadAssets(contextPath) {
    const gltfLoader = new GLTFLoader();

    const loadUrl = (url) =>
      new Promise((resolve, reject) => {
        try {
          // if gltf for the given url exists in the cache let's return it
          if (this.gltfs[url]) {
            resolve(this.gltfs[url]);

            return;
          }

          gltfLoader.load(url, (gltf) => {
            // store gltf in the cache
            this.gltfs[url] = gltf;
            resolve(gltf);
          }, null, reject);
        } catch (err) {
          const msg = "Failed to load '" + url + "': " + err;
          console.log(msg);
          reject(msg);
        }
      });

    const assets = this.assets;
    const urls = assets.flatMap((asset) => contextPath + asset.url);
    const gltfs = await Promise.all(urls.flatMap(loadUrl));
    let n = 0;
    for (const gltf of gltfs) {
      assets[n++].gltf = gltf;
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
  	}
  }
  
  insertElementAt(scope, property, idx, value) {
  	switch (property) {
  		case 'selection': 
        const sharedObject = scope.loadJson(value);
  			this.selection.splice(idx, 0, sharedObject); 
  			break; 
  	}
  }
  
  removeElementAt(scope, property, idx) {
  	switch (property) {
  		case 'selection': 
  			this.selection.splice(idx, 1);
  			break; 
  	}
  }

  reload(scope) {
    scope.loadAssets(this.ctrl.contextPath).then(() => {
      this.ctrl.zUpRoot.clear();
      this.ctrl.multiTransformGroup.clear();
      this.build(this.ctrl.zUpRoot);
      this.ctrl.applySelection(this.selection);
      this.ctrl.updateTransformControls();
      this.ctrl.render();
    });
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
  
  build(parentGroup) {
    const group = new Group();
    parentGroup.add(group);

    transform(group, this.transform);

    const snappingSphere = new Mesh(
      new SphereGeometry(C_P_RADIUS, WIDTH_SEGMENTS, HEIGHT_SEGMENTS), 
      new MeshBasicMaterial({ color: GREEN })
    );
    group.add(snappingSphere);

    this.node = group;
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

  build(parentGroup) {
    const group = new Group();
    parentGroup.add(group);

    if (this.layoutPoint) {
      const layoutSphere = new Mesh(
        new SphereGeometry(C_P_RADIUS, WIDTH_SEGMENTS, HEIGHT_SEGMENTS),
        new MeshBasicMaterial({ color: YELLOW })
      );
      group.add(layoutSphere);

      transform(group, this.layoutPoint.transform);
    }

    // transform(group, this.layoutPoint.transform);
    this.contents.forEach((c) => c.build(group));
    this.snappingPoints?.forEach((point) => point.build(group));

    // Link to scene node.
    group.userData = this;
    this.node = group;
  }

  loadJson(scope, json) {
    this.setProperty(scope, 'layoutPoint', json.layoutPoint);
    this.setProperty(scope, 'contents', json.contents);
    this.setProperty(scope, 'snappingPoints', json.snappingPoints);
  }

  setProperty(scope, property, value) {
    switch (property) {
  		case 'layoutPoint': this.layoutPoint = scope.loadJson(value); break;
  		case 'contents': {
  			if (this.contents) {
				this.contents.forEach((c) => c.parent = null);
  			}
  			this.contents = scope.loadAll(value);
			this.contents.forEach((c) => c.parent = this);
  			break;
  		} 
  		case 'snappingPoints': this.snappingPoints = scope.loadAll(value); break; 
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
  		case 'snappingPoints': this.snappingPoints.splice(idx, 0, scope.loadJson(value)); break; 
    }
  }

  removeElementAt(scope, property, idx) {
    switch (property) {
  		case 'contents': {
  			this.contents[idx].parent = null;
  			this.contents.splice(idx, 1);
  			break;
  		} 
  		case 'snappingPoints': this.snappingPoints.splice(idx, 1); break; 
    }
  }
}

class PartNode extends SharedObject {
  constructor(id) {
    super(id);
  }

  build(parentGroup) {
    const group = new Group();
    parentGroup.add(group);

    if (this.layoutPoint && this.layoutPoint.transform) {
      const layoutSphere = new Mesh(
        new SphereGeometry(C_P_RADIUS, WIDTH_SEGMENTS, HEIGHT_SEGMENTS),
        new MeshBasicMaterial({ color: YELLOW })
      );
      group.add(layoutSphere);

      transform(group, this.layoutPoint.transform);
    }

    // this.layoutPoint.build(group);
    this.snappingPoints?.forEach((point) => point.build(group));

    const node = this.asset.build();
    group.add(node);

    // Link to scene node.
    group.userData = this;
    this.node = group;
  }

  loadJson(scope, json) {
    this.setProperty(scope, 'layoutPoint', json.layoutPoint);
    this.setProperty(scope, 'asset', json.asset);
    this.setProperty(scope, 'snappingPoints', json.snappingPoints);
  }

  setProperty(scope, property, value) {
    switch (property) {
  		case 'layoutPoint': this.layoutPoint = scope.loadJson(value); break; 
  		case 'asset': this.asset = scope.loadJson(value); break; 
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

class GltfAsset extends SharedObject {
  constructor(id) {
    super(id);
  }

  build() {
    const model = this.gltf.scene.clone();
    model.traverse((obj) => {
      if (obj.isMesh && obj.material) {
        obj.userData.originalMaterial = obj.material;
        obj.material = obj.material.clone();
        obj.material.userData.originalColor = obj.material.color.clone();
      }
    });
    return model;
  }

  loadJson(scope, json) {
    this.setProperty(scope, 'url', json.url);
  }

  setProperty(scope, property, value) {
    switch (property) {
  		case 'url': this.url = value; break;
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

function calculateCubeCameraPosition(cameraPosition, controlsTarget) {
  const subAxesOffset = new Vector3().subVectors(cameraPosition, controlsTarget);
  return subAxesOffset.normalize().multiplyScalar(CUBE_CAMERA_FAR);
}

function calculateMainCameraPosition(cubeCameraPosition, cameraPosition, controlsTarget) {
  let subMainOffset = new Vector3(...cubeCameraPosition.toArray());
  const cameraOffset = new Vector3().subVectors(cameraPosition, controlsTarget);

  subMainOffset.normalize().multiplyScalar(cameraOffset.length());
  subMainOffset = new Vector3().addVectors(subMainOffset, controlsTarget);
  return subMainOffset;
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

function isDescendantOfAny(node, selectedSet) {
  let parent = node.parent;
  while (parent) {
    if (selectedSet.has(parent)) return true;
    parent = parent.parent;
  }
  return false;
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

function createDetailedGrid(size) {
  const z = 0;
  const edge = size / 2;
  const gridGroup = new Group();

  const smallCell = 200;
  const bigCell = smallCell * 10;

  function createLine(start, end, color, linewidth) {
      const geometry = new BufferGeometry().setFromPoints([start, end]);
      const material = new LineBasicMaterial({ color, linewidth });
      return new Line(geometry, material);
  }

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
}

// For sever communication written in legacy JS.
window.services.threejs = {
  init: async function (
    controlId, contextPath, dataUrl, isWorkplaneVisible, 
    isInEditMode, isRotateMode
  ) {
    const control = new ThreeJsControl(
      controlId, contextPath, dataUrl, isWorkplaneVisible, 
      isInEditMode, isRotateMode
    );
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