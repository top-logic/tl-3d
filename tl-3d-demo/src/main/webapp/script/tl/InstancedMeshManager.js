/**
 * InstancedMeshManager.js
 *
 * Manages instanced meshes using ID-based rendering with Data3DTexture matrix storage.
 * Uses custom instanceID attribute (more efficient than gl_InstanceID + mapping texture).
 *
 * This allows fast per-frame swapping of which instances to render by only changing
 * the ID array instead of copying full 4x4 matrices.
 */

import {
  Box3,
  Data3DTexture,
  FloatType,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  RGBAFormat,
  Sphere,
  Vector3,
} from "three";

export class InstancedMeshManager {
  constructor() {
    // Map of assetKey -> InstancedMeshData
    this.managedMeshes = new Map();
  }

  /**
   * Calculate optimal texture dimensions for a given number of instances
   * Returns dimensions that are as square as possible while staying within limits
   */
  calculateTextureDimensions(maxInstances, maxTextureSize = 16384) {
    // Try to make it roughly square
    const idealSize = Math.ceil(Math.sqrt(maxInstances));

    // Clamp to max texture size
    const width = Math.min(idealSize, maxTextureSize);
    const height = Math.ceil(maxInstances / width);

    if (height > maxTextureSize) {
      throw new Error(
        `Cannot fit ${maxInstances} instances in texture (exceeds ${maxTextureSize}x${maxTextureSize})`,
      );
    }

    return { width, height };
  }

  /**
   * Create an instanced mesh with ID-based rendering
   * @param {string} assetKey - Unique key for this asset type
   * @param {BufferGeometry} geometry - The geometry to instance
   * @param {Material} baseMaterial - The base material (will be converted to shader material)
   * @param {number} maxInstances - Maximum number of instances
   * @param {Array} instanceData - Array of {id, matrix} objects
   */
  createInstancedMesh(
    assetKey,
    geometry,
    baseMaterial,
    maxInstances,
    instanceData,
    triangleCount = 100,
  ) {
    // Calculate optimal texture dimensions
    const { width: textureWidth, height: textureHeight } =
      this.calculateTextureDimensions(maxInstances);

    // Create Data3DTexture to store transformation matrices
    const { matrixTexture, matrixTextureData } = this.createMatrixTexture(
      textureWidth,
      textureHeight,
      instanceData,
    );

    // Create InstancedBufferGeometry (gives us full control over instanced attributes)
    const instancedGeometry = new InstancedBufferGeometry().copy(geometry);

    // Add custom instanceID attribute
    const instanceIDs = new Float32Array(maxInstances);
    instanceData.forEach((instance, index) => {
      instanceIDs[index] = instance.id;
    });

    const instanceIDAttribute = new InstancedBufferAttribute(instanceIDs, 1);
    instancedGeometry.setAttribute("instanceID", instanceIDAttribute);

    // Set instance count (this is what controls how many instances are rendered)
    instancedGeometry.instanceCount = instanceData.length;

    // Convert material to use our matrix lookup shader
    const customMaterial = this.createMatrixLookupMaterial(
      baseMaterial,
      matrixTexture,
      textureWidth,
      textureHeight,
    );

    // Create regular Mesh with instanced geometry (not InstancedMesh)
    const mesh = new Mesh(instancedGeometry, customMaterial);

    // Mark as instanced for identification
    mesh.userData.isInstancedMesh = true;

    // Store management data
    this.managedMeshes.set(assetKey, {
      mesh,
      geometry: instancedGeometry,
      matrixTexture,
      matrixTextureData,
      instanceIDAttribute,
      instanceIDs,
      maxInstances,
      textureWidth,
      textureHeight,
      instanceData: instanceData.map((d) => ({
        id: d.id,
        matrix: d.matrix.clone(),
      })),
      triangleCount: triangleCount,
    });

    // Compute proper bounding box and sphere
    this.computeBounds(assetKey);

    return mesh;
  }

  /**
   * Create the matrix texture using Data3DTexture
   * Depth dimension contains the 4 columns of each matrix
   */
  createMatrixTexture(textureWidth, textureHeight, instanceData) {
    const textureDepth = 4; // 4 columns per matrix

    // Each layer is width * height, each pixel stores 4 floats (RGBA)
    const layerSize = textureWidth * textureHeight * 4; // RGBA
    const textureSize = layerSize * textureDepth;

    const matrixTextureData = new Float32Array(textureSize);

    // Populate texture with matrices
    instanceData.forEach((instance) => {
      const matrix = instance.matrix;
      const matrixArray = matrix.elements; // Column-major order

      // Calculate 2D position for this instance
      const x = instance.id % textureWidth;
      const y = Math.floor(instance.id / textureWidth);
      const pixelIndex = y * textureWidth + x;

      // Store each column of the matrix in a separate depth layer
      for (let col = 0; col < 4; col++) {
        const layerOffset = col * layerSize;
        const pixelOffset = pixelIndex * 4; // RGBA
        const baseIndex = layerOffset + pixelOffset;

        // Store the 4 values of this column
        for (let row = 0; row < 4; row++) {
          const matrixIndex = col * 4 + row; // Column-major: col * 4 + row
          matrixTextureData[baseIndex + row] = matrixArray[matrixIndex];
        }
      }
    });

    const matrixTexture = new Data3DTexture(
      matrixTextureData,
      textureWidth,
      textureHeight,
      textureDepth,
    );
    matrixTexture.format = RGBAFormat;
    matrixTexture.type = FloatType;
    matrixTexture.needsUpdate = true;

    return { matrixTexture, matrixTextureData };
  }

  /**
   * Patch the material's shader to use matrix lookup from Data3DTexture
   * Uses onBeforeCompile to inject custom code into Three.js standard shaders
   */
  createMatrixLookupMaterial(
    baseMaterial,
    matrixTexture,
    textureWidth,
    textureHeight,
  ) {
    // Clone the material to avoid modifying the original
    const material = baseMaterial.clone();

    // Patch the shader using onBeforeCompile
    material.onBeforeCompile = (shader) => {
      // Add uniforms to shader
      shader.uniforms.matrixTexture = { value: matrixTexture };
      shader.uniforms.textureWidth = { value: textureWidth };
      shader.uniforms.textureHeight = { value: textureHeight };

      // Add custom attribute and uniforms at the top
      shader.vertexShader = `
        attribute float instanceID;
        uniform sampler3D matrixTexture;
        uniform float textureWidth;
        uniform float textureHeight;

        ${shader.vertexShader}
      `;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <beginnormal_vertex>",
        `
        #ifdef USE_INSTANCING
          // Calculate 2D texture coordinates from instanceID
          float x = mod(instanceID, textureWidth);
          float y = floor(instanceID / textureWidth);

          // Normalise to [0, 1] range and centre on pixel
          vec2 uv = (vec2(x, y) + 0.5) / vec2(textureWidth, textureHeight);

          // Look up 4 columns from the 4 depth layers
          vec4 col0 = texture(matrixTexture, vec3(uv, 0.125));
          vec4 col1 = texture(matrixTexture, vec3(uv, 0.375));
          vec4 col2 = texture(matrixTexture, vec3(uv, 0.625));
          vec4 col3 = texture(matrixTexture, vec3(uv, 0.875));

          mat4 instanceMatrix = mat4(col0, col1, col2, col3);
        #endif

        #include <beginnormal_vertex>
        `,
      );
    };

    // Enable instancing so Three.js includes the necessary shader code
    material.defines = material.defines || {};
    material.defines.USE_INSTANCING = "";

    return material;
  }

  /**
   * Compute proper bounding box and sphere for an instanced mesh
   * accounting for all instance transforms
   */
  computeBounds(assetKey) {
    const data = this.managedMeshes.get(assetKey);
    if (!data) return;

    const { mesh, instanceData } = data;

    // Get base geometry bounding box (single object, not instanced)
    // We need to compute this from the position attribute
    const positionAttr = mesh.geometry.attributes.position;
    if (!positionAttr) return;

    const baseBox = new Box3();
    for (let i = 0; i < positionAttr.count; i++) {
      const x = positionAttr.getX(i);
      const y = positionAttr.getY(i);
      const z = positionAttr.getZ(i);
      baseBox.expandByPoint(new Vector3(x, y, z));
    }

    // Store base box for BVH to use
    data.baseBoundingBox = baseBox.clone();

    // Compute world bounding box that encompasses all instances
    const worldBox = new Box3();

    instanceData.forEach((instance) => {
      const matrix = instance.matrix;

      // Transform the base bounding box by the instance matrix
      const instanceBox = baseBox.clone();
      instanceBox.applyMatrix4(matrix);

      // Expand world box to include this instance
      worldBox.union(instanceBox);
    });

    // Set bounding box for frustum culling
    mesh.geometry.boundingBox = worldBox;

    // Compute and set bounding sphere from the box
    const sphere = new Sphere();
    worldBox.getBoundingSphere(sphere);
    mesh.geometry.boundingSphere = sphere;

    // Enable frustum culling
    mesh.frustumCulled = true;
  }

  /**
   * Update which instances are visible by swapping IDs
   * @param {string} assetKey - Which instanced mesh to update
   * @param {Array<number>} visibleInstanceIDs - Array of instance IDs to render
   */
  updateVisibleInstances(assetKey, visibleInstanceIDs) {
    const data = this.managedMeshes.get(assetKey);
    if (!data) {
      console.warn(`No managed mesh found for ${assetKey}`);
      return;
    }

    const { geometry, instanceIDs, instanceIDAttribute, mesh } = data;

    // Update the instance ID buffer with new visible IDs
    const count = Math.min(visibleInstanceIDs.length, data.maxInstances);

    for (let i = 0; i < count; i++) {
      instanceIDs[i] = visibleInstanceIDs[i];
    }

    // Mark attribute for update
    instanceIDAttribute.needsUpdate = true;

    // Update instance count (this is what actually controls rendering!)
    geometry.instanceCount = count;
  }

  /**
   * Update a specific instance's transformation matrix
   * @param {string} assetKey - Which instanced mesh
   * @param {number} instanceID - The instance ID
   * @param {Matrix4} newMatrix - New transformation matrix
   */
  updateInstanceMatrix(assetKey, instanceID, newMatrix) {
    const data = this.managedMeshes.get(assetKey);
    if (!data) {
      console.warn(`No managed mesh found for ${assetKey}`);
      return;
    }

    const {
      matrixTextureData,
      matrixTexture,
      instanceData,
      textureWidth,
      textureHeight,
    } = data;

    // Instance ID is the index in the array
    const instance = instanceData[instanceID];

    if (!instance) {
      console.warn(`Instance ${instanceID} not found`);
      return;
    }

    // Update matrix in our storage
    instance.matrix.copy(newMatrix);

    // Calculate 2D position for this instance
    const x = instanceID % textureWidth;
    const y = Math.floor(instanceID / textureWidth);
    const pixelIndex = y * textureWidth + x;

    const matrixArray = newMatrix.elements;
    const layerSize = textureWidth * textureHeight * 4; // RGBA

    // Update matrix in texture data (4 columns across 4 depth layers)
    for (let col = 0; col < 4; col++) {
      const layerOffset = col * layerSize;
      const pixelOffset = pixelIndex * 4; // RGBA
      const baseIndex = layerOffset + pixelOffset;

      // Update the 4 values of this column
      for (let row = 0; row < 4; row++) {
        const matrixIndex = col * 4 + row;
        matrixTextureData[baseIndex + row] = matrixArray[matrixIndex];
      }
    }

    // Mark texture for update
    matrixTexture.needsUpdate = true;
  }

  /**
   * Get statistics about managed meshes
   */
  getStats() {
    const stats = {
      totalManagedMeshes: this.managedMeshes.size,
      meshes: [],
    };

    for (const [assetKey, data] of this.managedMeshes) {
      stats.meshes.push({
        assetKey,
        maxInstances: data.maxInstances,
        currentlyVisible: data.geometry.instanceCount,
        textureSize: `${data.textureWidth}x${data.textureHeight}x4`,
      });
    }

    return stats;
  }

  /**
   * Calculate the total triangle count across all managed instanced meshes.
   * This is the sum of (triangleCount * instanceCount) for each asset.
   * Used to decide whether BVH visibility culling is needed.
   * @returns {number} Total triangle count
   */
  getTotalInstancedTriangleCount() {
    let total = 0;
    for (const [, data] of this.managedMeshes) {
      total += data.triangleCount * data.instanceData.length;
    }
    return total;
  }

  /**
   * Clean up resources
   */
  dispose() {
    for (const [assetKey, data] of this.managedMeshes) {
      data.matrixTexture.dispose();
      data.mesh.geometry.dispose();
      data.mesh.material.dispose();
    }
    this.managedMeshes.clear();
  }
}
