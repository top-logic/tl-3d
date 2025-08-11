/**
 * Navigation cube for 3D scene orientation and view control.
 * Provides a visual representation of current camera orientation and allows quick navigation to predefined views.
 */

import {
  BoxBufferGeometry,
  CanvasTexture,
  EdgesGeometry,
  FrontSide,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  Scene,
  WebGLRenderer,
} from "three";

import { OrbitControls } from "OrbitControls";
import { gsap } from "gsap";
import { CameraUtils, SceneUtils, getRaycaster, throttle } from "./ThreeJsUtils.js";
import { CAMERA_MOVE_DURATION, DARK_GREY, LIGHT_GREY, _90_DEGREE } from './Constants.js';

/**
 * NavigationCube class handles the 3D navigation cube functionality.
 * Provides visual orientation feedback and quick camera position controls.
 */
export class NavigationCube {
  /**
   * Creates a new NavigationCube instance.
   * @param {HTMLElement} container - The container element to attach the cube canvas to
   * @param {Function} onRender - Callback function to trigger main scene re-render
   * @param {Object} mainCamera - Reference to the main camera for synchronization
   * @param {Object} mainControls - Reference to the main camera controls for synchronization
   * @param {Object} options - Optional configuration object
   * @param {string} options.position - Position of the cube: 'top-left', 'top-right', 'bottom-left', 'bottom-right' (default: 'top-left')
   * @param {number} options.size - Size of the cube canvas (default: 100)
   * @param {number} options.padding - Padding from container edge (default: 10)
   */
  constructor(container, onRender, mainCamera, mainControls, options = {}) {
    this.container = container;
    this.onRender = onRender;
    this.mainCamera = mainCamera;
    this.mainControls = mainControls;
    
    // Configuration options
    this.options = {
      position: options.position || 'top-left',
      size: options.size || 100,
      padding: options.padding || 10
    };
    
    // Internal state
    this.controlsIsUpdating = false;
    this.cubeControlsIsUpdating = false;
    this.originalMaterials = [];
    this._throttledCubeHover = null;
    this.clickStart = 0;
    
    this.init();
  }

  init() {
    this.initScene();
    this.initRenderer();
    this.initControls();
    this.render();
  }

  initScene() {
    this.cubeScene = new Scene();
    this.cubeScene.background = null;

    this.cubeCamera = CameraUtils.createCubeCamera();
    this.cubeScene.rotation.x = -_90_DEGREE;

    SceneUtils.addCubeSceneLights(this.cubeScene);

    this.axesCube = this.createAxesCube();
    this.cubeScene.add(this.axesCube);
  }

  /**
   * Creates the axes cube with labeled faces.
   * @returns {Group} The complete axes cube group with cube and edges
   */
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

  /**
   * Creates a texture with text label for cube faces.
   * @param {string} text - The text to render on the texture
   * @returns {CanvasTexture} The generated texture
   */
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

  initRenderer() {
    this.cubeRenderer = new WebGLRenderer({ alpha: true });
    this.cubeRenderer.shadowMap.enabled = true;
    this.cubeRenderer.setSize(this.options.size, this.options.size);
    this.cubeRenderer.setPixelRatio(window.devicePixelRatio);
    
    this.cubeCanvas = this.cubeRenderer.domElement;
    this.cubeCanvas.style.position = "absolute";
    this.cubeCanvas.style.zIndex = "1000"; // Ensure cube is always on top
    
    this.updateCubePosition();
    this.container.append(this.cubeCanvas);
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.cubeCanvas.addEventListener("mousemove", (event) => this.onCubeHover(event), false);
    this.cubeCanvas.addEventListener("mousedown", (event) => this.onCubeMouseDown(event), false);
    this.cubeCanvas.addEventListener("click", (event) => this.onCubeClick(event), false);
  }

  initControls() {
    this.cubeControls = new OrbitControls(this.cubeCamera, this.cubeCanvas);
    this.cubeControls.enableZoom = false;
    this.cubeControls.enablePan = false;
    this.cubeControls.target.set(0, 0, 0);

    this.cubeControls.addEventListener("change", () => {
      if (!this.controlsIsUpdating) {
        this.cubeControlsIsUpdating = true;
        this.mainCamera.quaternion.copy(this.cubeCamera.quaternion);
        this.mainCamera.position.copy(
          CameraUtils.calculateMainCameraPosition(this.cubeCamera.position, this.mainCamera.position, this.mainControls.target)
        );
        this.mainControls.update();
        this.cubeControlsIsUpdating = false;
        this.onRender();
      }
    });
  }

  updateFromMainCamera() {
    if (!this.cubeControlsIsUpdating) {
      this.controlsIsUpdating = true;        
      this.cubeCamera.quaternion.copy(this.mainCamera.quaternion);
      this.cubeCamera.position.copy(
        CameraUtils.calculateCubeCameraPosition(this.mainCamera.position, this.mainControls.target)
      );
      this.cubeControls.update();
      this.controlsIsUpdating = false;
    }
  }

  updateCubePosition() {
    if (!this.cubeCanvas) return;

    const { position, padding } = this.options;

    switch (position) {
      case 'top-right':
        this.cubeCanvas.style.right = `${padding}px`;
        this.cubeCanvas.style.top = `${padding}px`;
        this.cubeCanvas.style.left = 'auto';
        this.cubeCanvas.style.bottom = 'auto';
        break;
      case 'bottom-left':
        this.cubeCanvas.style.left = `${padding}px`;
        this.cubeCanvas.style.bottom = `${padding}px`;
        this.cubeCanvas.style.right = 'auto';
        this.cubeCanvas.style.top = 'auto';
        break;
      case 'bottom-right':
        this.cubeCanvas.style.right = `${padding}px`;
        this.cubeCanvas.style.bottom = `${padding}px`;
        this.cubeCanvas.style.left = 'auto';
        this.cubeCanvas.style.top = 'auto';
        break;
      case 'top-left':
      default:
        this.cubeCanvas.style.left = `${padding}px`;
        this.cubeCanvas.style.top = `${padding}px`;
        this.cubeCanvas.style.right = 'auto';
        this.cubeCanvas.style.bottom = 'auto';
        break;
    }
  }

  updateSize() {
    if (!this.cubeRenderer || !this.cubeCanvas) return;

    // Update cube position in case container moved
    this.updateCubePosition();
    
    // Update pixel ratio if device pixel ratio changed
    const newPixelRatio = window.devicePixelRatio;
    if (this.cubeRenderer.getPixelRatio() !== newPixelRatio) {
      this.cubeRenderer.setPixelRatio(newPixelRatio);
    }
  }

  /**
   * Handles mouse down events on the cube for click detection.
   * @param {MouseEvent} event - The mouse event
   */
  onCubeMouseDown(event) {
    this.clickStart = Date.now();
  }

  /**
   * Handles mouse hover events on the cube for face highlighting.
   * @param {MouseEvent} event - The mouse event
   */
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

        this.onRender();
      }, 100); 
    }
    this._throttledCubeHover(event);
  }

  /**
   * Handles click events on the cube for camera positioning.
   * @param {MouseEvent} event - The mouse event
   */
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
        this.onRender();
      },
      onComplete: () => {
        this.onRender();
      },
    });
  }

  /**
   * Changes the position of the navigation cube.
   * @param {string} position - New position: 'top-left', 'top-right', 'bottom-left', 'bottom-right'
   */
  setPosition(position) {
    this.options.position = position;
    this.updateCubePosition();
  }

  /**
   * Changes the size of the navigation cube.
   * @param {number} size - New size in pixels
   */
  setSize(size) {
    this.options.size = size;
    if (this.cubeRenderer) {
      this.cubeRenderer.setSize(size, size);
    }
  }

  render() {
    this.cubeRenderer.render(this.cubeScene, this.cubeCamera);
  }
}