/**
 * Utilities for ThreeJS Control
 * Contains utility functions and constants
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  Line,
  LineBasicMaterial,
  BufferGeometry,
  Vector3,
  PerspectiveCamera,
  Raycaster,
  Vector2,
  Matrix4
} from "three";

import {
  WHITE,
  LIGHT_BLUE,
  MIDDLE_BLUE,
  DARK_BLUE,
  CUBE_CAMERA_FAR,
  GRID_SMALL_CELL
} from './Constants.js';

export function applyColorToObject(object, colorString) {
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
export const throttle = (func, limit) => {
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

export function getRaycaster(event, camera, canvas) {
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

export function getLocalMatrix(objectMatrixWorld, parentMatrixWorld) {
  const worldMatrix = objectMatrixWorld.clone();
  const parentInverse = new Matrix4().copy(parentMatrixWorld).invert();
  const localMatrix = new Matrix4().multiplyMatrices(parentInverse, worldMatrix);

  return localMatrix;
}

export function getMatrixDiff(m1, m2) {
  const diffMatrix = new Matrix4();
  diffMatrix.copy(m1.clone().invert()).multiply(m2);

  return diffMatrix;
}

export function matrix(
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

export function toMatrix(tx) {
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

export function toTX(matrix4) {
  const el = matrix4.elements;
  return [ el[0], el[4], el[8], el[1], el[5], el[9], el[2],  el[6],  el[10],  el[12],  el[13],  el[14] ];
}

export function transform(group, tx) {
  if (tx != null && tx.length > 0) {
    if (tx.length == 3) {
      group.position.set(tx[0], tx[1], tx[2]);
    } else {
      group.applyMatrix4(toMatrix(tx));
    }
  }
}

export function isDescendantOfAny (node, selectedNodes) {
  let parent = node.parent;
  while (parent) {
    if (selectedNodes.includes(parent)) return true;
    parent = parent.parent;
  }
  return false;
}

export function createLine(start, end, color, linewidth) {
  const geometry = new BufferGeometry().setFromPoints([start, end]);
  const material = new LineBasicMaterial({ color, linewidth });
  return new Line(geometry, material);
}

export const CameraUtils = {
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
    const far = 1000000; // the far clipping plane

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

export const SceneUtils = {
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
  }
};
