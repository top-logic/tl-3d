/**
 * Main class for managing 3D scenes using Three.js library.
 * Provides methods for initializing and controlling a 3D scene with various functionalities+
 */

import {
  AxesHelper,
  Box3,
  Box3Helper,
  BoxBufferGeometry,
  BoxGeometry,
  BoxHelper,
  CanvasTexture,
  Color,
  CubeTexture,
  DoubleSide,
  EdgesGeometry,
  FrontSide,
  Group,
  ImageLoader,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RGBAFormat,
  Scene,
  SphereBufferGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

import { OrbitControls } from "OrbitControls";
import { TransformControls } from "TransformControls";
import { gsap } from "gsap";
import { Scope, SharedObject} from "./DataModels.js";
import { InsertElement, RemoveElement, SetProperty } from "./Commands.js";
import { CameraUtils, SceneUtils, applyColorToObject, getLocalMatrix, getMatrixDiff, toMatrix, getRaycaster, isDescendantOfAny, throttle  } from "./ThreeJsUtils.js";

import { 
  CAMERA_MOVE_DURATION,
  C_P_RADIUS,
  DARK_GREY,
  FLOOR_PADDING,
  GREEN,
  GRID_SMALL_CELL,
  HEIGHT_SEGMENTS,
  INTERACTIVE_PIXEL_RATIO,
  LIGHT_GREY,
  OPTIMIZED_PIXEL_RATIO,
  SELECTION_COLOR,
  SNAP_THRESHOLD,
  TRANSPARENCY_LEVEL,
  WHITE,
  WIDTH_SEGMENTS,
  YELLOW,
  _90_DEGREE
} from './Constants.js';

/**
 * Initial state configuration for ThreeJsControl.
 * @typedef {Object} ThreeJsControlState
 * @property {string} controlId - The ID of the control element.
 * @property {string} contextPath - The context path for loading resources.
 * @property {string} dataUrl - The URL to fetch the scene data.
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
    this.scope = new Scope();
    
    this.lastLODLevel = -1;
    this.useLOD = true;
    this.zUpRoot = new Group();
    this.zUpEnvironment = new Group();
    this.multiTransformGroup = new Group();
    this.areObjectsTransparent = initialState.areObjectsTransparent;
    this.useScreenSpaceSnapping = true;
    
    this.skyboxEnabled = initialState.skyboxEnabled !== false;
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

      this.initSkybox().then(() => this.toggleSkybox(initialState.isSkyboxVisible));

      // Recreate floors after scene is loaded - moved to loadScene()
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
    this.scene.add(this.zUpEnvironment);
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

    // Limit camera movement to prevent going below floor level
    // this.controls.maxPolarAngle = Math.PI * 0.5; // Limit polar angle to 90 degrees

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

  toggleSkybox(visible) {
    if (!this.environmentBackground) return;

    // Show/Hide skybox and floors
    [this.environmentBackground, ...(this.factoryFloors || [])].forEach(obj => {
      obj.parent?.remove(obj);
      if (visible) this.zUpEnvironment.add(obj);
    });

    this.isSkyboxVisible = visible;
    this.render();
  }

  async initSkybox() {
    if (!this.skyboxEnabled) return;
    // Load cube texture and create skybox environment
    await this.loadCubeTexture();
    this.render();
  }

  createTiledTexture(image) {
    // Create a 4x4 tiled texture to make textures appear smaller and more realistic (poor performance)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const [tileW, tileH] = [image.width, image.height];
    const koeff = 4;
    
    [canvas.width, canvas.height] = [tileW * koeff, tileH * koeff];
    
    // Draw 4x4 grid of rotated tiles
    for (let x = 0; x < koeff; x++) {
      for (let y = 0; y < koeff; y++) {
        ctx.save();
        ctx.translate((x + 0.5) * tileW, (y + 0.5) * tileH);
        ctx.drawImage(image, -image.width/2, -image.height/2);
        ctx.restore();
      }
    }
    return canvas;
  }

  async loadCubeTexture() {
    const texture = new CubeTexture();
    const loader = new ImageLoader();
    
    // Define texture URLs for different surfaces
    const lrWallUrl = 'https://as2.ftcdn.net/v2/jpg/03/24/83/79/1000_F_324837965_WzkElQWESPpFBltfwddlJaQIYH8X9D5V.jpg'; // Left/Right walls
    const fbWallUrl = 'https://as2.ftcdn.net/v2/jpg/01/98/99/89/1000_F_198998931_VZjbdpDglkKPjbqaXa3bnH8fB6axUTcp.jpg'; // Front/Back walls
    const floorUrl = 'https://as1.ftcdn.net/v2/jpg/01/79/71/02/1000_F_179710260_hVhHw5vQNsXyb9qvIkRbIHBzWUuVcmF7.jpg'; // Floor/Ceiling
    
    const urls = [lrWallUrl, fbWallUrl, floorUrl];

    const [ lrWallImg, fbWallImg, floorImg ] = await Promise.all(
      urls.map(url => new Promise(
        (resolve) => loader.load(url, resolve, undefined, () => resolve(undefined))
      ))
    );

    const tiledFrontBackWall = this.createTiledTexture(fbWallImg);
    // Create textures
    texture.images = [lrWallImg, lrWallImg, floorImg,  floorImg, tiledFrontBackWall, tiledFrontBackWall];
    texture.needsUpdate = true;
    this.createEnvironmentCube(texture);
  }

  createEnvironmentCube(cubeTexture = null) {
    this.environmentBackground?.parent?.remove(this.environmentBackground);
    
    const center = new Vector3();
    this.boundingBox.getCenter(center);
    
    const boxSize = this.boundingBox.getSize(new Vector3());
    const [x, y, z] = boxSize.toArray();

    const floorSizes = { 
      x: x + FLOOR_PADDING,
      z: z + FLOOR_PADDING,
    };

    this.floorSizes = floorSizes;

    if (cubeTexture) {
      // Create textured skybox cube
      const geometry = new BoxGeometry(floorSizes.x, y * 2, floorSizes.z).scale(-1, 1, 1);
      this.environmentBackground = new Mesh(geometry, cubeTexture.images.map(img => 
        new MeshBasicMaterial({ map: img ? new CanvasTexture(img) : null, side: FrontSide })
      ));
    }

    // Adjusting the cube's Y position to match the bottom of the bounding box height
    const cubeYposition = center.y + y / 2 - 100;
    this.environmentBackground.position.set(center.x, cubeYposition, center.z);
    
    this.createFactoryFloors(cubeTexture);
    
    // Update camera max distance based on skybox size
    // if (this.controls) this.controls.maxDistance = cubeSize * 0.5;
  }
  
  createFactoryFloors(cubeTexture) {
    if (this.factoryFloors) {
      this.factoryFloors.forEach(floor => {
        if (floor.parent) {
          floor.parent.remove(floor);
        }
      });
    }
    this.factoryFloors = [];
    
    // Get floor levels from scene graph
    const floorLevels = this.getFloorLevels();

    let floorsToCreate = [];

    if (floorLevels.length > 0) {
      floorsToCreate = floorLevels;
    } else {
      // Use numberOfFloors from scene graph or default to 1
      const numberOfFloors = this.sceneGraph?.numberOfFloors || 1;

      floorsToCreate = Array.from({ length: numberOfFloors }, (_, i) => i);
    }
    
    // Calculate scene size for floor dimensions
    const sceneBox = new Box3();
    sceneBox.setFromObject(this.zUpRoot);
    const floorSizes = this.floorSizes;
    
    if (!floorSizes) {
      return;
    }

    let floorTexture;
    if (cubeTexture && cubeTexture.images && cubeTexture.images[3]) {
      floorTexture = new CanvasTexture(cubeTexture.images[3]);
    } else if (this.environmentBackground && this.environmentBackground.material && this.environmentBackground.material[3]) {
      floorTexture = this.environmentBackground.material[3].map;
    } 
    
    // Get bounding box center for floor positioning
    const center = new Vector3();
    if (this.boundingBox) {
      this.boundingBox.getCenter(center);
    } else {
      center.set(0, 0, 0); // fallback to world center
    }
    
    for (const level of floorsToCreate) {
      // Create material with conditional map property
      const materialOptions = {
        side: DoubleSide,
        color: WHITE
      };
      
      if (floorTexture) {
        materialOptions.map = floorTexture;
      }
      
      const floor = new Mesh(
        new BoxGeometry(floorSizes.x, 100, floorSizes.z), 
        new MeshBasicMaterial(materialOptions)
      );
      
      const floorY = level * 15000 - 100;
      floor.position.set(center.x, floorY, center.z);

      this.factoryFloors.push(floor);
    }
  }
  
  getFloorLevels() {
    // Extract floor levels from scene graph
    const floorLevels = [];
    if (this.sceneGraph && this.sceneGraph.root) {
      const findFloors = (node) => {
        if (node.name && node.name.startsWith('Floor ')) {
          // Extract floor number from name (e.g., "Floor 0", "Floor 1")
          const floorNumber = parseInt(node.name.split(' ')[1]);
          if (!isNaN(floorNumber)) {
            floorLevels.push(floorNumber);
          }
        }
        // Recursively search in contents/children
        if (node.contents) node.contents.forEach(findFloors);
      };
      findFloors(this.sceneGraph.root);
    }
    // Sort floor levels
    const sortedLevels = floorLevels.sort((a, b) => a - b);
    
    return sortedLevels;
  }
  
  updateFactoryFloors() {
    // Update floors when scene changes
    if (this.skyboxEnabled && this.environmentBackground) {
      this.createFactoryFloors(null);
      this.render();
    }
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
              // Store starting position and rotation for incremental snapping
              node.userData.dragStartPosition = node.position.clone();
              node.userData.dragStartRotation = node.rotation.clone();
            }

            return;
          }

          // Apply step snapping to each object in multi-select
          outer.multiTransformGroup.children.forEach(node => {
            outer.snapToStepSize(node);
          });
          
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
            // Store starting position and rotation for incremental snapping
            object.userData.dragStartPosition = object.position.clone();
            object.userData.dragStartRotation = object.rotation.clone();
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
        // Apply step snapping to single objects
        if (selectedObject !== this.multiTransformGroup) {
          this.snapToStepSize(selectedObject);
        }
                        
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
    this.rotateControls.addEventListener("objectChange", (event) => {
      if (event.target.dragging) {
        const selectedObject = event.target.object;
        // Apply step snapping to single objects
        if (selectedObject !== this.multiTransformGroup) {
          this.snapToStepSize(selectedObject);
        }

        if (selectedObject === this.multiTransformGroup) {
          this.render();
          return;
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
      const otherObjectAsset = otherObject?.userData?.asset || otherObject?.userData?.nodeRef?.asset;
      
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

  snapToStepSize(obj) {
    const translateStepSize = this.sceneGraph.translateStepSize;
    const rotateStepSize = this.sceneGraph.rotateStepSize;
    const startPos = obj.userData.dragStartPosition;
    const startRot = obj.userData.dragStartRotation;
    
    if (startPos && translateStepSize > 0) {
      const stepsX = Math.round((obj.position.x - startPos.x) / translateStepSize);
      const stepsY = Math.round((obj.position.y - startPos.y) / translateStepSize);
      const stepsZ = Math.round((obj.position.z - startPos.z) / translateStepSize);
      
      obj.position.set(
        startPos.x + (stepsX * translateStepSize),
        startPos.y + (stepsY * translateStepSize),
        startPos.z + (stepsZ * translateStepSize)
      );
    }
    
    if (startRot && rotateStepSize > 0) {
      const stepRad = rotateStepSize * Math.PI / 180;
      const stepsX = Math.round((obj.rotation.x - startRot.x) / stepRad);
      const stepsY = Math.round((obj.rotation.y - startRot.y) / stepRad);
      const stepsZ = Math.round((obj.rotation.z - startRot.z) / stepRad);
      
      obj.rotation.set(
        startRot.x + (stepsX * stepRad),
        startRot.y + (stepsY * stepRad),
        startRot.z + (stepsZ * stepRad)
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
      if (node.userData?.isSphere || 
          node.userData?.isGrid || 
          node.userData?.isHelper ||
          (!node.userData?.asset && !node.userData?.nodeRef?.asset)) {
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
    this.zUpRoot.traverse((object) => {
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
    if (this.clickButton != 0) {
      return; // Not click with middle mouse button.
    }
    if (Date.now() - this.clickStart > 500) {
      return; // Not a click.
    }
    const raycaster = getRaycaster(event, this.camera, this.canvas);
    const visibleObjects = this.scene.children.filter(obj => obj.visible);
    const intersects = raycaster.intersectObjects(visibleObjects, true);

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
      center.y + 12000, // for looking a bit from the top
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
      let needsFullReload = false;
      
      for (const change of changes) {
        var command = change[0];
        var cmdProps = command[1];

        var cmd;
        switch (command[0]) {
          case 'R': cmd = new RemoveElement(cmdProps["id"]); break;
          case 'I': cmd = new InsertElement(cmdProps["id"]); break;
          case 'S': cmd = new SetProperty(cmdProps["id"]); break;
        }

        // Be conservative - only allow known safe incremental properties
        const safeIncrementalProperties = ['selection', 'parent', 'transform', 'hidden', 'color', 'selectable', 'contents'];
        
        if (!safeIncrementalProperties.includes(cmdProps["p"])) {
          needsFullReload = true;
        }
        change.shift();
        cmd.loadJson(cmdProps, change);
        cmd.apply(this.scope);
      }

      if (needsFullReload) {
        this.sceneGraph.reload(this.scope);
      } else {
        this.applySelection(this.sceneGraph.selection);
        this.updateTransformControls();
        this.applyColors();
        this.render();
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
      this.setColor(sharedNode.node, WHITE);
      this.selection.splice(index, 1);
      
      command = this.sceneGraph.removeSelected(sharedNode);
    } else {
      // Currently not selected
      if (!value) {
        // Cannot remove from selection
        return;
      }
      this.setColor(sharedNode.node, SELECTION_COLOR);
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

  // applies red color to selected shared objects from the graphScene
  applySelection(selectedSharedNodes) {
    // remove selection from the previously selected objects
    for (const shared3JSNode of this.selection) {
      this.setColor(shared3JSNode.node, WHITE);
    }
    this.selection = [];

    // apply selection to new objects that have to be selected
    for (const shared3JSNode of selectedSharedNodes) {
      this.setColor(shared3JSNode.node, SELECTION_COLOR);
      this.selection.push(shared3JSNode);
    }

    this.updateObjectsTransparency();
  }

  // Apply colors to all objects that have color and 3D node
  applyColors() {
    for (const [id, obj] of Object.entries(this.scope.objects)) {
      if (obj.color && obj.node && obj.color.trim() !== '') {
        applyColorToObject(obj.node, obj.color);
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
          if (typeof c === 'string') {
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

          this.render();

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
      this.setColor(sharedNode.node, WHITE);
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
    this.sceneGraph.buildGraph(this);
    
    // Create floors after sceneGraph is loaded with numberOfFloors
    if (this.skyboxEnabled) {
      this.createFactoryFloors(null);
    }
    
    this.scope.loadAssets(this).then(() => {
      this.updateObjectsTransparency();
    });

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
  
  setObjectsTransparency() {
    if (this.selection.length > 0) {
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
            this.setObjectTransparency(material, TRANSPARENCY_LEVEL); 
          });
        }
      });
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

    this.render();
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
  }
};