import {
  BoxBufferGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Matrix4,
  Group,
  Scene,
  DirectionalLight,
  AmbientLight,
  WebGLRenderer,
  AxesHelper,
  Raycaster,
  Vector3,
  Vector2
} from 'three';

import { OrbitControls } from 'OrbitControls';
import { GLTFLoader } from 'GLTFLoader';

class ThreeJsControl {

	constructor(controlId, contextPath, dataUrl) {
		this.controlId = controlId;
		this.contextPath = contextPath;
		this.dataUrl = dataUrl;

		this.scope = new Scope();
		
		// Filled in loadScene().
		this.sceneGraph = null;
		this.selection = [];
		
		const container = this.container;

		this.scene = new Scene();
		this.scene.background = new Color('skyblue');
		
		const fov = 35; // AKA Field of View
		const aspect = container.clientWidth / container.clientHeight;
		const near = 10; // the near clipping plane
		const far = 100000; // the far clipping plane
		
		this.camera = new PerspectiveCamera(fov, aspect, near, far);
		this.camera.position.set(0, 10000, 5000);
		
		const light1 = new DirectionalLight('white', 8);
		light1.position.set(0, 5500, 5500);
		this.scene.add(light1);
		
		// soft white light
		const light2 = new AmbientLight( 0x404040 );
		this.scene.add( light2 );		
		
		const axesHelper = new AxesHelper(500);
		this.scene.add(axesHelper);		
		
		this.renderer = new WebGLRenderer();
		this.renderer.setSize(container.clientWidth, container.clientHeight);
		this.renderer.setPixelRatio(window.devicePixelRatio);
		
		LayoutFunctions.addCustomRenderingFunction(container.parentNode, () => {
			this.renderer.setSize(container.clientWidth, container.clientHeight);
			this.render();
		});
		
		const canvas = this.renderer.domElement;
		container.append(canvas);
		
		this.controls = new OrbitControls(this.camera, canvas);
		this.controls.enableZoom = false;
		this.controls.screenSpacePanning = false;
		this.controls.addEventListener("change", () => this.render());
		
		canvas.addEventListener('wheel', (event) => this.onMouseWheel(event), { passive: false });
		
		var clickStart = null;

		canvas.addEventListener('click', (event) => {
			if (Date.now() - clickStart > 500) {
				// Not a click.
				return;
			}

			const raycaster = new Raycaster();
			const pointer = new Vector2();

			const clickPos = BAL.relativeMouseCoordinates(event, canvas);
			
			// Calculate pointer position in normalized device coordinates (-1 to +1) for both directions.
			pointer.x = ( clickPos.x / canvas.clientWidth ) * 2 - 1;
			pointer.y = - ( clickPos.y / canvas.clientHeight ) * 2 + 1;
			
			raycaster.setFromCamera(pointer, this.camera);
			const intersects = raycaster.intersectObjects(this.scene.children, true);
			
			this.updateSelection(intersects, event.ctrlKey);
			this.render();
		});

		canvas.addEventListener('mousedown', (event) => {
			clickStart = Date.now();
		});
		
		this.loadScene();		
		this.render();
	}
	
	get container() {
		return document.getElementById(this.controlId);
	}
	
	attach() {
		this.container.tlControl = this;
	}
	
	async loadScene() {
		const gltfLoader = new GLTFLoader();
		const loadUrl = (url) => new Promise((resolve, reject) => {
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
		
		Promise.all(urls.flatMap(loadUrl)).then(
			(gltfs) => {
				var n = 0;
				for (const gltf of gltfs) {
					assets[n++].gltf = gltf;
				}

				this.sceneGraph.build(this.scene);
				this.render();
			}
		);
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

	updateSelection(intersects, toggleMode) {
		if (!toggleMode) {
			this.clearSelection();
		}

		for ( let i = 0; i < intersects.length; i ++ ) {
			const clicked = intersects[i].object;
			
			var candidate = clicked;
			while (candidate != null) {
				if (candidate.userData instanceof SharedObject) {
					if (toggleMode) {
						const index = this.selection.indexOf(clicked);
						if (index >= 0) {
							clicked.material.color.set(0xffffff);
							this.selection.splice(index, 1);
						} else {
							clicked.material.color.set(0xff0000);
							this.selection.push(clicked);
						}
					} else {
						clicked.material.color.set(0xff0000);
						this.selection.push(clicked);
					}
					return;
				}
				
				candidate = candidate.parent;
			}
		}
	}

	clearSelection() {
		for (const selected of this.selection) {
			selected.material.color.set(0xffffff);
		}
		
		this.selection.length = 0;
	}
	
	
	render() {
		requestAnimationFrame(() => this.renderer.render(this.scene, this.camera));
	}
	
}

// For sever communication written in legacy JS.
window.services.threejs = {
	init: async function(controlId, contextPath, dataUrl) {
		const control = new ThreeJsControl(controlId, contextPath, dataUrl);
		control.attach();
	}
}

class Scope {
	constructor() {
		this.objects = [];
	}
	
	get assets() {
		return this.objects.filter((obj) => obj instanceof GltfAsset);
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

class SharedObject {
	constructor(id) {
		this.id = id;
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

