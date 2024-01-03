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
  WebGLRenderer
} from 'three';

import {
	OrbitControls
} from 'OrbitControls';

import {
	GLTFLoader
} from 'GLTFLoader';

window.services.threejs = {
	init: async function(controlId, contextPath, dataUrl) {
		const container = document.getElementById(controlId);
		
		const scene = new Scene();
		scene.background = new Color('skyblue');
		
		const fov = 35; // AKA Field of View
		const aspect = container.clientWidth / container.clientHeight;
		const near = 10; // the near clipping plane
		const far = 50000; // the far clipping plane
		
		const camera = new PerspectiveCamera(fov, aspect, near, far);
		camera.position.set(0, 0, 5000);
		
		const light = new DirectionalLight('white', 8);
		light.position.set(0, 0, 5500);
		scene.add(light);
		
		const renderer = new WebGLRenderer();
		renderer.setSize(container.clientWidth, container.clientHeight);
		renderer.setPixelRatio(window.devicePixelRatio);
		
		LayoutFunctions.addCustomRenderingFunction(container.parentNode, function() {
			renderer.setSize(container.clientWidth, container.clientHeight);
			requestAnimationFrame(function() {
				renderer.render(scene, camera);
			});
		});
		
		const canvas = renderer.domElement;
		container.append(canvas);
		const controls = new OrbitControls(camera, canvas);
		
		controls.addEventListener("change", function() {
			requestAnimationFrame(function() {
				renderer.render(scene, camera);
			});
		});
		
		// const geometry = new BoxBufferGeometry(2, 2, 2);
		// const material = new MeshBasicMaterial();
		// const cube = new Mesh(geometry, material);
		// scene.add(cube);
		// controls.target.copy(cube.position);
		// controls.update();
		
		const gltfLoader = new GLTFLoader();
		const load = (url) => new Promise((resolve, reject) => gltfLoader.load(url, resolve, null, reject));
		
		const dataResponse = await fetch(dataUrl);
		const dataJson = await dataResponse.json();
		
		const scope = new Scope();
		const sceneGraph = scope.load(dataJson);
		
		const assets = scope.assets;
		const urls = assets.flatMap((asset) => contextPath + asset.url);
		
		Promise.all(urls.flatMap(load)).then(
			(gltfs) => {
				var n = 0;
				for (const gltf of gltfs) {
					assets[n++].gltf = gltf;
				}

				sceneGraph.build(scene);
				
				requestAnimationFrame(function() {
					renderer.render(scene, camera);
				});
			}
		);
		
		renderer.render(scene, camera);
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
		return json.flatMap((value) => this.load(value));
	}
	
	load(json) {
		if (json == null) {
			return null;
		}
		if (json instanceof Array) {
			const id = json[1];
			var obj;
			switch (json[0]) {
				case 'SceneGraph': obj = new SceneGraph(); break;
				case 'GroupNode': obj = new GroupNode(); break;
				case 'PartNode': obj = new PartNode(); break;
				case 'GltfAsset': obj = new GltfAsset(); break;
			}
			this.objects[id] = obj;
			obj.load(this, json[2]);
			return obj;
		} else if (typeof json === "number") {
			// Is a reference.
			return this.objects[json];
		} else {
			throw new Error("Invalid graph specifier: " + json);
		}
	}
}

class SceneGraph {
	build(scene) {
		this.root.build(scene);
	}

	load(scope, json) {
		this.root = scope.load(json.root);
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

class GroupNode {
	build(scene) {
		var group = transform(scene, this.transform);
		this.contents.forEach((c) => c.build(group));
	}
	
	load(scope, json) {
		this.transform = json.transform;
		this.contents = scope.loadAll(json.contents);
	}
}

class PartNode {
	build(scene) {
		const node = this.asset.build(scene);
		var group = transform(scene, this.transform);
		group.add(node);
	}
	
	load(scope, json) {
		this.transform = json.transform;
		this.asset = scope.load(json.asset);
	}
}

class GltfAsset {
	build(scene) {
		return this.gltf.scene.clone();
	}
	
	load(scope, json) {
		this.url = json.url;
	}
}


