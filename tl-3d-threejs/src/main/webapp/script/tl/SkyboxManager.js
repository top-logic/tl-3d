/**
 * Manager for skybox and factory floors functionality.
 * Handles creation, texturing and management of environment background and floors.
 */

import {
  BoxGeometry,
  CanvasTexture,
  DoubleSide,
  FrontSide,
  ImageLoader,
  Mesh,
  MeshBasicMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  Vector3,
} from "three";

import { gsap } from "gsap";

import { CAMERA_MOVE_DURATION, FLOOR_PADDING, WHITE } from "./Constants.js";
import { disposeMaterialWithTextures } from "./ThreeJsUtils.js";

/** A repeating texture of a wall image, or null without image. */
function wallTexture(image, repeat) {
  if (!image) {
    return null;
  }
  const texture = srgbTexture(new Texture(image));
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.needsUpdate = true;
  return texture;
}

/** Marks a texture of a photo or drawing as sRGB, so that its colours are displayed correctly. */
function srgbTexture(texture) {
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export class SkyboxManager {
  constructor(threeJsControl) {
    this.control = threeJsControl;
    this.environmentBackground = null;
    this.factoryFloors = [];
    this.floorSizes = null;
    this.isSkyboxVisible = false;
  }

  async initSkybox() {
    // Load cube texture and create skybox environment
    try {
      await this.loadCubeTexture();
    } catch (error) {
      console.warn("Skybox could not be created.", error);
    }
    this.control.invalidate();
  }

  toggleSkybox(visible) {
    if (!this.environmentBackground) return;

    // Show/Hide skybox and floors
    [this.environmentBackground, ...(this.factoryFloors || [])].forEach(
      (obj) => {
        obj.parent?.remove(obj);
        if (visible) this.control.zUpEnvironment.add(obj);
      },
    );

    // Update camera max distance based on skybox visibility
    if (this.control.controls) {
      if (visible && this.floorSizes) {
        // Calculate cube size and set max distance when skybox is visible
        const cubeSize = Math.max(this.floorSizes.x, this.floorSizes.z);
        // this.control.controls.maxDistance = cubeSize * 0.5;
        // Animate camera to optimal skybox viewing distance
        this.zoomToSkyboxDistance();
      } else {
        // Remove distance limitation when skybox is hidden
        this.control.controls.maxDistance = Infinity;
      }
    }

    this.isSkyboxVisible = visible;
    this.control.invalidate();
  }

  createFloorTextTexture(text, backgroundImage = null) {
    // Create canvas for text
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // Set canvas size
    canvas.width = 1024;
    canvas.height = 1024;

    if (backgroundImage && backgroundImage.width && backgroundImage.height) {
      // Draw background image first if it's valid
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    } else {
      // Fill background with semi-transparent gray if no background image
      ctx.fillStyle = "rgba(200, 200, 200, 0.8)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Set text style
    ctx.fillStyle = "black";
    ctx.font = "bold 24px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";

    // Draw text in bottom left corner (with some padding)
    ctx.fillText(text, 50, canvas.height - 50);

    // Create texture from canvas
    return srgbTexture(new CanvasTexture(canvas));
  }

  async loadCubeTexture() {
    const loader = new ImageLoader();

    // The textures are delivered with the application (see artifacts/skybox/LICENSE.txt), so
    // that no external server is contacted and the skybox also works offline.
    const base = `${this.control.contextPath}/artifacts/skybox/`;
    const urls = [
      base + "side-wall.jpg", // Left/Right walls
      base + "end-wall.jpg", // Front/Back walls
      base + "floor.jpg", // Floor/Ceiling
    ];

    // A texture that cannot be loaded leaves its faces plain.
    const [lrWallImg, fbWallImg, floorImg] = await Promise.all(
      urls.map(
        (url) =>
          new Promise((resolve) =>
            loader.load(url, resolve, undefined, () => {
              console.warn(`Skybox texture could not be loaded: ${url}`);
              resolve(undefined);
            }),
          ),
      ),
    );

    // One texture per image, shared by the two faces that show it. The front and back walls
    // repeat their image 4 x 4 times, so that it appears smaller.
    const sideWall = wallTexture(lrWallImg, 1);
    const endWall = wallTexture(fbWallImg, 4);
    const floor = wallTexture(floorImg, 1);
    this.createEnvironmentCube({
      // Order of the faces of a BoxGeometry: +x, -x, +y, -y, +z, -z.
      faces: [sideWall, sideWall, floor, floor, endWall, endWall],
      floorImage: floorImg,
    });
  }

  /** Removes a 3D object of the environment and releases its geometry, materials and maps. */
  disposeObject(object) {
    if (!object) return;
    object.parent?.remove(object);
    object.geometry?.dispose();
    disposeMaterialWithTextures(object.material);
  }

  /** Releases the skybox and the floors. */
  dispose() {
    this.disposeObject(this.environmentBackground);
    this.environmentBackground = null;
    this.factoryFloors?.forEach((floor) => this.disposeObject(floor));
    this.factoryFloors = [];
  }

  /**
   * @param skybox The textures of the faces and the image of the floors, or null for the floors
   *        only.
   */
  createEnvironmentCube(skybox = null) {
    this.disposeObject(this.environmentBackground);
    this.environmentBackground = null;

    const center = new Vector3();
    this.control.boundingBox.getCenter(center);

    const boxSize = this.control.boundingBox.getSize(new Vector3());
    const [x, y, z] = boxSize.toArray();

    const floorSizes = {
      x: x + FLOOR_PADDING,
      z: z + FLOOR_PADDING,
    };

    this.floorSizes = floorSizes;

    if (skybox) {
      // Create textured skybox cube
      const geometry = new BoxGeometry(floorSizes.x, y * 2, floorSizes.z).scale(
        -1,
        1,
        1,
      );
      this.environmentBackground = new Mesh(
        geometry,
        skybox.faces.map(
          (texture) => new MeshBasicMaterial({ map: texture, side: FrontSide }),
        ),
      );
    }

    // Adjusting the cube's Y position to match the bottom of the bounding box height
    const cubeYposition = center.y + y / 2 - 100;
    this.environmentBackground.position.set(center.x, cubeYposition, center.z);

    this.createFactoryFloors(skybox);
  }

  createFactoryFloors(skybox) {
    this.factoryFloors?.forEach((floor) => this.disposeObject(floor));
    this.factoryFloors = [];

    // Get floor levels from scene graph
    const floorLevels = this.getFloorLevels();

    let floorsToCreate = [];

    if (floorLevels.length > 0) {
      floorsToCreate = floorLevels;
    } else {
      // Use numberOfFloors from scene graph or default to 1
      const numberOfFloors = this.control.sceneGraph?.numberOfFloors || 1;

      floorsToCreate = Array.from({ length: numberOfFloors }, (_, i) => i);
    }

    const floorSizes = this.floorSizes;

    if (!floorSizes) {
      return;
    }

    // The floors draw their label onto the floor image.
    const floorImage = skybox?.floorImage;

    // Get bounding box center for floor positioning
    const center = new Vector3();
    if (this.control.boundingBox) {
      this.control.boundingBox.getCenter(center);
    } else {
      center.set(0, 0, 0); // fallback to world center
    }

    for (const level of floorsToCreate) {
      // Create texture with text on top of floor texture
      const textTexture = this.createFloorTextTexture(
        `FLOOR ${level}`,
        floorImage,
      );

      // Create material
      const materialOptions = {
        side: DoubleSide,
        color: WHITE,
        map: textTexture,
      };

      const floor = new Mesh(
        new BoxGeometry(floorSizes.x, 100, floorSizes.z),
        new MeshBasicMaterial(materialOptions),
      );

      const floorY = level * 15000 - 100;
      floor.position.set(center.x, floorY, center.z);

      this.factoryFloors.push(floor);
    }
  }

  getFloorLevels() {
    // Extract floor levels from scene graph
    const floorLevels = [];
    if (this.control.sceneGraph && this.control.sceneGraph.root) {
      const findFloors = (node) => {
        if (node.name && node.name.startsWith("Floor ")) {
          // Extract floor number from name (e.g., "Floor 0", "Floor 1")
          const floorNumber = parseInt(node.name.split(" ")[1]);
          if (!isNaN(floorNumber)) {
            floorLevels.push(floorNumber);
          }
        }
        // Recursively search in contents/children
        if (node.contents) node.contents.forEach(findFloors);
        if (node.children) node.children.forEach(findFloors);
      };
      findFloors(this.control.sceneGraph.root);
    }

    // Remove duplicates and sort
    return [...new Set(floorLevels)].sort((a, b) => a - b);
  }

  // Getter methods for accessing from ThreeJsControl
  getEnvironmentBackground() {
    return this.environmentBackground;
  }

  zoomToSkyboxDistance() {
    if (!this.control.boundingBox) return;

    const center = new Vector3();
    this.control.boundingBox.getCenter(center);

    const size = new Vector3();
    this.control.boundingBox.getSize(size);
    const maxSize = Math.max(size.x, size.y, size.z);

    // Calculate optimal distance and position
    const fov = this.control.camera.fov * (Math.PI / 180);
    const targetDistance = (maxSize * 0.8) / Math.tan(fov / 2);

    const targetPosition = {
      x: center.x,
      y: center.y + maxSize * 0.3,
      z: center.z + targetDistance,
    };

    // The flight replaces running ones (e.g. zoomOut when the view is opened).
    this.control.stopCameraAnimation();

    // Animate camera position and target simultaneously
    const updateCallback = () => {
      this.control.controls.update();
      this.control.invalidate();
    };

    gsap.to(this.control.controls.object.position, {
      ...targetPosition,
      duration: CAMERA_MOVE_DURATION,
      ease: "power3.inOut",
      onUpdate: updateCallback,
    });
    gsap.to(this.control.controls.target, {
      x: center.x,
      y: center.y,
      z: center.z,
      duration: CAMERA_MOVE_DURATION,
      ease: "power3.inOut",
      onUpdate: updateCallback,
    });
  }
}
