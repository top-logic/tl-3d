/**
 * Manager for skybox and factory floors functionality.
 * Handles creation, texturing and management of environment background and floors.
 */

import {
  Box3,
  BoxGeometry,
  CanvasTexture,
  CubeTexture,
  DoubleSide,
  FrontSide,
  ImageLoader,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from "three";

import { gsap } from "gsap";

import {
  CAMERA_MOVE_DURATION,
  FLOOR_PADDING,
  WHITE,
} from './Constants.js';

export class SkyboxManager {
  constructor(threeJsControl) {
    this.control = threeJsControl;
    this.environmentBackground = null;
    this.factoryFloors = [];
    this.floorSizes = null;
    this.skyboxEnabled = true;
    this.isSkyboxVisible = false;
  }

  async initSkybox() {
    if (!this.skyboxEnabled) return;
    // Load cube texture and create skybox environment
    await this.loadCubeTexture();
    this.control.render();
  }

  toggleSkybox(visible) {
    if (!this.environmentBackground) return;

    // Show/Hide skybox and floors
    [this.environmentBackground, ...(this.factoryFloors || [])].forEach(obj => {
      obj.parent?.remove(obj);
      if (visible) this.control.zUpEnvironment.add(obj);
    });

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
    this.control.render();
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

  createFloorTextTexture(text, backgroundImage = null) {
    // Create canvas for text
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = 1024;
    canvas.height = 1024;
    
    if (backgroundImage && backgroundImage.width && backgroundImage.height) {
      // Draw background image first if it's valid
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    } else {
      // Fill background with semi-transparent gray if no background image
      ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Set text style
    ctx.fillStyle = 'black';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    
    // Draw text in bottom left corner (with some padding)
    ctx.fillText(text, 50, canvas.height - 50);
    
    // Create texture from canvas
    return new CanvasTexture(canvas);
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
    this.control.boundingBox.getCenter(center);
    
    const boxSize = this.control.boundingBox.getSize(new Vector3());
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
      const numberOfFloors = this.control.sceneGraph?.numberOfFloors || 1;

      floorsToCreate = Array.from({ length: numberOfFloors }, (_, i) => i);
    }
    
    // Calculate scene size for floor dimensions
    const sceneBox = new Box3();
    sceneBox.setFromObject(this.control.zUpRoot);
    const floorSizes = this.floorSizes;
    
    if (!floorSizes) {
      return;
    }

    let floorImage;
    if (cubeTexture && cubeTexture.images && cubeTexture.images[3]) {
      floorImage = cubeTexture.images[3]; // Use raw image instead of CanvasTexture
    }
    
    // Get bounding box center for floor positioning
    const center = new Vector3();
    if (this.control.boundingBox) {
      this.control.boundingBox.getCenter(center);
    } else {
      center.set(0, 0, 0); // fallback to world center
    }
    
    for (const level of floorsToCreate) {
      // Create texture with text on top of floor texture
      const textTexture = this.createFloorTextTexture(`FLOOR ${level}`, floorImage);
      
      // Create material
      const materialOptions = {
        side: DoubleSide,
        color: WHITE,
        map: textTexture
      };
      
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
    if (this.control.sceneGraph && this.control.sceneGraph.root) {
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

  setEnabled(enabled) {
    this.skyboxEnabled = enabled;
  }

  isEnabled() {
    return this.skyboxEnabled;
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
      z: center.z + targetDistance 
    };

    // Animate camera position and target simultaneously
    const updateCallback = () => {
      this.control.controls.update();
      this.control.render();
    };

    gsap.to(this.control.controls.object.position, { ...targetPosition, duration: CAMERA_MOVE_DURATION, ease: "power3.inOut", onUpdate: updateCallback });
    gsap.to(this.control.controls.target, { x: center.x, y: center.y, z: center.z, duration: CAMERA_MOVE_DURATION, ease: "power3.inOut", onUpdate: updateCallback });
  }
}