import {
  Color,
  PerspectiveCamera,
  Matrix4,
  Group,
  Scene,
  DirectionalLight,
  AmbientLight,
  WebGLRenderer,
  AxesHelper,
  Raycaster,
  Box3,
  Vector3,
  Vector2,
  BoxHelper,
  Box3Helper,
  BoxGeometry,
  BoxBufferGeometry,
  Mesh,
  MeshBasicMaterial,
} from "three";

import { OrbitControls } from "OrbitControls";
import { GLTFLoader } from "GLTFLoader";
import { gsap } from "gsap";

const SOFT_WHITE_LIGHT = 0x404040;
const YELLOW = 0xffff00;
const NEAR = 10; // the near clipping plane
const FAR = 100000; // the far clipping plane

class ThreeJsControl {
  constructor(controlId, contextPath, dataUrl) {
    this.lastSelectedObject = null;
    this.controlId = controlId;
    this.contextPath = contextPath;
    this.dataUrl = dataUrl;
    this.scope = new Scope();

    this.initScene();
    this.initAxesCubeScene();
    this.initRenderer();
    this.initAxesCubeRenderer();
    this.initControls();
    this.initAxesCubeControls();
    this.render();
    this.loadScene().then(() => setTimeout(() => this.zoomOut(), 100));
    this.setupEventListeners();
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
  }

  initAxesCubeScene() {
    this.axesScene = new Scene();
    this.axesScene.background = null;

    const fov = 75; 
    const aspect = 1;

    this.axesCamera = new PerspectiveCamera(fov, aspect, NEAR, FAR);
    this.axesCamera.position.set(0, 0, 10000);
    this.axesCamera.lookAt(0, 0, 0);
    this.addAxesHelper(this.axesScene);

    const cubeSize = 15000;
    const cubeGeometry = new BoxGeometry(cubeSize, cubeSize, cubeSize);
    const cubeMaterial = new MeshBasicMaterial({ color: 0xff0000, wireframe: true });
    this.axesCube = new Mesh(cubeGeometry, cubeMaterial);
    this.axesCube.position.set(0, 0, 0);
    this.axesScene.add(this.axesCube);
    this.axesScene.rotation.x = -Math.PI / 2;
    this.render();
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
    LayoutFunctions.addCustomRenderingFunction(container.parentNode, () => {
      this.renderer.setSize(container.clientWidth, container.clientHeight);
      this.render();
    });
  }

  initAxesCubeRenderer() {
  const container = this.container;
  this.axesRenderer = new WebGLRenderer({ alpha: true });
  this.axesRenderer.setSize(100, 100);
  this.axesRenderer.setPixelRatio(window.devicePixelRatio);
  this.canvas2 = this.axesRenderer.domElement;
  this.canvas2.style.position = 'absolute';
  this.canvas2.style.top = '0';
  container.append(this.canvas2);
  }

  initControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.reset();
    this.controls.enableZoom = false;
    this.controls.screenSpacePanning = false;

    this.controls.addEventListener("change", () => {
      // if (this.zoomEnabled) {
        this.axesCamera.quaternion.copy(this.camera.quaternion);
        this.axesControls.object.position.copy(this.controls.object.position);
        this.render();
      // }
    });
  }

  initAxesCubeControls() {
    this.axesControls = new OrbitControls(this.axesCamera, this.canvas2);
    this.axesControls.enableZoom = false;
    this.axesControls.enablePan = false;
    this.zoomEnabled = false;
    this.axesControls.target.set(0, 0, 0);

    this.axesControls.addEventListener("change", () => {
        this.camera.quaternion.copy(this.axesCamera.quaternion);
        this.controls.object.position.copy(this.axesControls.object.position);
        this.render();
    });
  }

  createCamera() {
    const container = this.container;
    const fov = 35; // AKA Field of View
    const aspect = container.clientWidth / container.clientHeight;

    this.camera = new PerspectiveCamera(fov, aspect, NEAR, FAR);
    this.camera.position.set(5000, 6000, 10000);
    this.camera.lookAt(new Vector3());
  }

  addLights() {
    const light1 = new DirectionalLight("white", 8);
    light1.position.set(0, -300, 3000);
    this.scene.add(light1);

    const light2 = new AmbientLight( SOFT_WHITE_LIGHT );
    this.scene.add(light2);
  }

  addAxesHelper(scene) {
    const axesHelper = new AxesHelper(1000);
    scene.add(axesHelper);
  }

  addBoxHelpers() {
    // show bounding box around the selected object
    if (this.lastSelectedObject) {
      this.lastSelectedObject.remove(this.lastSelectedBoxHelper);
      this.lastSelectedBoxHelper = null;
    }
    if (this.value) {
      const boxHelper = new BoxHelper(this.candidate, YELLOW);
      this.scene.add(boxHelper);
      this.lastSelectedObject = this.candidate;
      this.lastSelectedBoxHelper = boxHelper;
    } else {
      this.lastSelectedObject = null;
    }

    // show bounding box around all objects
    this.boundingBoxHelper = new Box3Helper(this.boundingBox, YELLOW);
    this.scene.add(this.boundingBoxHelper);
    this.render();
  }

  setupEventListeners() {
    // update objects' size when the size of the canvas changes
    const resizeObserver = this.createResizeObserver(this.canvas);
    resizeObserver.observe(this.canvas);

    this.canvas.addEventListener("mousedown", () => this.onMouseDown());
    this.canvas.addEventListener("click", (event) => this.onClick(event));
    this.container.addEventListener("wheel", (event) => this.onMouseWheel(event), {
      passive: false,
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

    const raycaster = new Raycaster();
    const pointer = new Vector2();

    const clickPos = BAL.relativeMouseCoordinates(event, this.canvas);
    pointer.x = (clickPos.x / this.canvas.clientWidth) * 2 - 1;
    pointer.y = -(clickPos.y / this.canvas.clientHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, this.camera);
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

    // second canvas
    // const position2 = this.axesCamera.position;
    // const offset2 = new Vector3();
    // offset2.copy(position2);
    // const factor2 = event.deltaY < 0 ? 0.888888889 : 1.125;
    // offset2.multiplyScalar(factor2);
    // this.axesCamera.position.copy(offset2);

    this.render();
  }

  zoomToSelection() {
    const zoomDuration = 1.5;
    const selectedObject = this.getParentNode(this.selection[0]?.node);
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
    const targetPosition = center.clone().add(offset);

    const controlsObjectPositionMatches =
      this.controls.object.position.x === targetPosition.x &&
      this.controls.object.position.y === targetPosition.y &&
      this.controls.object.position.z === targetPositionZ;

    const controlsTargetMatches =
      this.controls.target.x === center.x &&
      this.controls.target.y === center.y &&
      this.controls.target.z === center.z;

    if (!controlsObjectPositionMatches && !controlsTargetMatches) {
      gsap.to(this.controls.target, {
        x: center.x,
        y: center.y,
        z: center.z,
        duration: zoomDuration,
        ease: "power3.inOut",
        onUpdate: () => {
          this.controls.update();
          this.render();
        },
      });

      gsap.to(this.controls.object.position, {
        x: center.x,
        y: center.y + 2000,
        z: targetPositionZ,
        duration: zoomDuration,
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
    }
    this.render();
  }

  zoomOut() {
    const zoomDuration = 1.5;
    this.boundingBox = new Box3();
    this.scene.traverse((object) => {
      if (object.type === "Mesh") {
        this.boundingBox.expandByObject(object);
      }
    });

    // this.addBoxHelpers();

    this.center = new Vector3();
    this.boundingBox.getCenter(this.center);
    const size = new Vector3();
    this.boundingBox.getSize(size);

    const maxSize = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    const distance = (maxSize / 2) / Math.tan(fov / 2);

    const targetPosition = new Vector3(
      this.center.x + 10000, // for looking a bit at the front side
      this.center.y + 15000, // for looking a bit from the top
      this.center.z + distance
    );

    gsap.to(this.controls.target, {
      x: 0,
      y: 0,
      z: 0,
      // x: this.center.x,
      // y: this.center.y,
      // z: this.center.z,
      duration: zoomDuration,
      ease: "power3.inOut",
      onUpdate: () => {
        this.controls.update();
        this.render();
      },
    });

    gsap.to(this.controls.object.position, {
      x: targetPosition.x,
      y: targetPosition.y,
      z: targetPosition.z,
      duration: zoomDuration,
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

  getParentNode(node) {
    while (node.parent && node.parent.type !== "Scene") {
      node = node.parent;
    }
    return node;
  }

  /** Applies the changes to the current selection as received from the server. */
  selectionChanged(changes) {
    const cmd = JSON.parse(changes);
    for (const change of cmd.changed) {
      const sharedNode = this.scope.getNode(change.key);
      if (sharedNode == null) {
        continue;
      }

      switch (change.value) {
        case "ADD":
          this.setSelected(sharedNode, true);
          break;
        case "REMOVE":
          this.setSelected(sharedNode, false);
          break;
      }
    }
    this.render();
  }

  /** Changes the selected state of the given shared node to the given value. */
  setSelected(sharedNode, value) {
    const index = this.selection.indexOf(sharedNode);
    if (index >= 0) {
      // Currently selected.
      if (value) {
        // Do not select again.
        return;
      }
      this.setColor(sharedNode.node, 0xffffff);
      this.selection.splice(index, 1);
    } else {
      // Currently not selected.
      if (!value) {
        // Cannot remove from selection.
        return;
      }
      this.setColor(sharedNode.node, 0xff0000);
      this.selection.push(sharedNode);
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
    const changes = {};

    if (!toggleMode) {
      for (const sharedNode of this.selection) {
        changes[sharedNode.id] = "REMOVE";
      }
      this.clearSelection();
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
          this.setSelected(sharedNode, this.value);

          changes[sharedNode.id] = this.value ? "ADD" : "REMOVE";

          // this.addBoxHelpers();

          this.render();

          this.sendCommand("updateSelection", { changes: changes });
          return;
        }

        this.candidate = this.candidate.parent;
      }
    }

    if (Object.keys(changes).length > 0) {
      this.sendCommand("updateSelection", { changes: changes });
    }
  }

  clearSelection() {
    for (const sharedNode of this.selection) {
      this.setColor(sharedNode.node, 0xffffff);
    }
    this.selection.length = 0;
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
    const gltfLoader = new GLTFLoader();
    const loadUrl = (url) =>
      new Promise((resolve, reject) => {
        try {
          gltfLoader.load(url, resolve, null, reject);
        } catch (err) {
          const msg = "Failed to load '" + url + "': " + err;
          console.log(msg);
          reject(msg);
        }
      });

    const dataResponse = await fetch(this.dataUrl);
    const dataJson = await dataResponse.json();

    this.sceneGraph = this.scope.loadJson(dataJson);

    const assets = this.scope.assets;
    const urls = assets.flatMap((asset) => this.contextPath + asset.url);

    const gltfs = await Promise.all(urls.flatMap(loadUrl));
    // .then((gltfs) => {
    let n = 0;
    for (const gltf of gltfs) {
      assets[n++].gltf = gltf;
    }
    this.scene.rotation.x = -Math.PI / 2;

    this.sceneGraph.build(this.scene);

    this.render();
  }

  sendCommand(command, args) {
    const message = {
      controlCommand: command,
      controlID: this.controlId,
    };

    for (const key in args) {
      message[key] = args[key];
    }

    services.ajax.execute("dispatchControlCommand", message);
  }

  render() {
    // requestAnimationFrame(() => this.renderer.render(this.scene, this.camera));
    requestAnimationFrame(() => {
      const { renderer, axesRenderer, scene, camera, axesScene, axesCamera } = this;
      renderer.render(scene, camera);
      axesRenderer.render(axesScene, axesCamera);
    });
  }
}

class SharedObject {
  constructor(id) {
    this.id = id;
  }
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

function transform(scene, tx) {
  if (tx != null && tx.length > 0) {
    const group = new Group();
    scene.add(group);

    if (tx.length == 3) {
      group.position.set(tx[0], tx[1], tx[2]);
    } else {
      group.applyMatrix4(toMatrix(tx));
    }
    return group;
  } else {
    return scene;
  }
}

class Scope {
  constructor() {
    this.objects = [];
  }

  get assets() {
    return this.objects.filter((obj) => obj instanceof GltfAsset);
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
}

class SceneGraph extends SharedObject {
  constructor(id) {
    super(id);
  }

  build(scene) {
    this.root.build(scene);
  }

  loadJson(scope, json) {
    this.root = scope.loadJson(json.root);
  }
}

class GroupNode extends SharedObject {
  constructor(id) {
    super(id);
  }

  build(scene) {
    var group = transform(scene, this.transform);
    this.contents.forEach((c) => c.build(group));
  }

  loadJson(scope, json) {
    this.transform = json.transform;
    this.contents = scope.loadAll(json.contents);
  }
}

class PartNode extends SharedObject {
  constructor(id) {
    super(id);
  }

  build(scene) {
    const node = this.asset.build(scene);
    var group = transform(scene, this.transform);
    group.add(node);

    // Link to scene node.
    node.userData = this;
    this.node = node;
  }

  loadJson(scope, json) {
    this.transform = json.transform;
    this.asset = scope.loadJson(json.asset);
  }
}

class GltfAsset extends SharedObject {
  constructor(id) {
    super(id);
  }

  build(scene) {
    return this.gltf.scene.clone();
  }

  loadJson(scope, json) {
    this.url = json.url;
  }
}

// For sever communication written in legacy JS.
window.services.threejs = {
  init: async function (controlId, contextPath, dataUrl) {
    const control = new ThreeJsControl(controlId, contextPath, dataUrl);
    control.attach();
  },

  selectionChanged: function (container, changes) {
    const control = ThreeJsControl.control(container);
    if (control != null) {
      control.selectionChanged(changes);
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
};
