import {
  BoxBufferGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  WebGLRenderer
} from 'three';

import {
	OrbitControls
} from 'OrbitControls';

window.services.threejs = {
	init: function(controlId) {
		const container = document.getElementById(controlId);
		
		const scene = new Scene();
		scene.background = new Color('skyblue');
		
		const fov = 35; // AKA Field of View
		const aspect = container.clientWidth / container.clientHeight;
		const near = 0.1; // the near clipping plane
		const far = 100; // the far clipping plane
		
		const camera = new PerspectiveCamera(fov, aspect, near, far);
		
		camera.position.set(0, 0, 10);
		
		const geometry = new BoxBufferGeometry(2, 2, 2);
		
		const material = new MeshBasicMaterial();
		
		const cube = new Mesh(geometry, material);
		
		scene.add(cube);
		
		const renderer = new WebGLRenderer();
		
		renderer.setSize(container.clientWidth, container.clientHeight);
		
		renderer.setPixelRatio(window.devicePixelRatio);
		
		const canvas = renderer.domElement;
		container.append(canvas);
		const controls = new OrbitControls(camera, canvas);
		controls.target.copy(cube.position);
		controls.update();
		
		controls.addEventListener("change", function() {
			requestAnimationFrame(function() {
				renderer.render(scene, camera);
			});
		});
		
		renderer.render(scene, camera);
	}
}
