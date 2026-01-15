/**
 * InstancedMeshManager.js
 *
 * Manages instanced meshes using ID-based rendering with DataTexture matrix storage.
 * Instead of storing matrices in instanceMatrix buffer, stores instance IDs and
 * looks up matrices from a DataTexture in the vertex shader.
 *
 * This allows fast per-frame swapping of which instances to render by only changing
 * the ID array instead of copying full 4x4 matrices.
 */

import {
  Box3,
  DataTexture,
  FloatType,
  InstancedBufferAttribute,
  InstancedMesh,
  RGBAFormat,
  Sphere,
} from "three";

export class InstancedMeshManager {
  constructor() {
    // Map of assetKey -> InstancedMeshData
    this.managedMeshes = new Map();
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
  ) {
    // Create DataTexture to store transformation matrices
    // Each matrix is 16 floats (4x4), packed into RGBA texture
    // Each matrix takes 4 pixels (4 rows × 4 RGBA values = 16 floats)
    const textureWidth = 4; // 4 pixels wide (one matrix row per pixel)
    const textureHeight = Math.ceil(maxInstances); // One row per instance
    const textureSize = textureWidth * textureHeight * 4; // RGBA

    const matrixTextureData = new Float32Array(textureSize);

    // Populate texture with matrices
    instanceData.forEach((instance, index) => {
      const matrix = instance.matrix;
      const matrixArray = matrix.elements;

      // Store matrix in texture (4 pixels = 16 floats)
      const baseIndex = index * 16;
      for (let i = 0; i < 16; i++) {
        matrixTextureData[baseIndex + i] = matrixArray[i];
      }
    });

    const matrixTexture = new DataTexture(
      matrixTextureData,
      textureWidth,
      textureHeight,
      RGBAFormat,
      FloatType,
    );
    matrixTexture.needsUpdate = true;

    // Create InstancedMesh with dummy geometry
    const instancedMesh = new InstancedMesh(
      geometry,
      baseMaterial,
      maxInstances,
    );

    // Add custom instanceID attribute
    const instanceIDs = new Float32Array(maxInstances);
    instanceData.forEach((instance, index) => {
      instanceIDs[index] = instance.id;
    });

    const instanceIDAttribute = new InstancedBufferAttribute(instanceIDs, 1);
    instancedMesh.geometry.setAttribute("instanceID", instanceIDAttribute);

    // Convert material to ShaderMaterial with matrix lookup
    const customMaterial = this.createMatrixLookupMaterial(
      baseMaterial,
      matrixTexture,
    );
    instancedMesh.material = customMaterial;

    // Set initial count
    instancedMesh.count = instanceData.length;

    // Store management data
    this.managedMeshes.set(assetKey, {
      instancedMesh,
      matrixTexture,
      matrixTextureData,
      instanceIDAttribute,
      instanceIDs,
      maxInstances,
      instanceData: instanceData.map((d) => ({
        id: d.id,
        matrix: d.matrix.clone(),
      })),
    });

    this.computeBoundingSphere(assetKey);

    return instancedMesh;
  }

  /**
   * Patch the material's shader to use matrix lookup from DataTexture
   */
  createMatrixLookupMaterial(baseMaterial, matrixTexture) {
    // Clone the material to avoid modifying the original
    const material = baseMaterial.clone();

    // Patch the shader using onBeforeCompile
    material.onBeforeCompile = (shader) => {
      // Add uniforms to shader
      shader.uniforms.matrixTexture = { value: matrixTexture };
      shader.uniforms.textureHeight = { value: matrixTexture.image.height };

      // Add custom attribute and uniforms
      shader.vertexShader = `
        attribute float instanceID;
        uniform sampler2D matrixTexture;
        uniform float textureHeight;

        ${shader.vertexShader}
      `;

      // Inject matrix lookup right before Three.js starts using instanceMatrix
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
        #ifdef USE_INSTANCING
          // Override instanceMatrix with our DataTexture lookup
          float row = instanceID;
          float rowNorm = (row + 0.5) / textureHeight;

          vec4 col0 = texture2D(matrixTexture, vec2(0.125, rowNorm));
          vec4 col1 = texture2D(matrixTexture, vec2(0.375, rowNorm));
          vec4 col2 = texture2D(matrixTexture, vec2(0.625, rowNorm));
          vec4 col3 = texture2D(matrixTexture, vec2(0.875, rowNorm));

          mat4 instanceMatrix = mat4(col0, col1, col2, col3);
        #endif

        #include <begin_vertex>
        `,
      );

      // Store reference for debugging
      material.userData.patchedShader = shader;
    };

    // Enable instancing so Three.js includes the necessary shader code
    material.defines = material.defines || {};
    material.defines.USE_INSTANCING = "";

    return material;
  }

  computeBoundingSphere(assetKey) {
    const data = this.managedMeshes.get(assetKey);
    if (!data) return;

    const { instancedMesh, instanceData } = data;

    // Get base geometry bounding info
    if (!instancedMesh.geometry.boundingBox) {
      instancedMesh.geometry.computeBoundingBox();
    }
    if (!instancedMesh.geometry.boundingSphere) {
      instancedMesh.geometry.computeBoundingSphere();
    }

    const baseBox = instancedMesh.geometry.boundingBox;

    // Compute bounding box that encompasses all instances
    const worldBox = new Box3();

    instanceData.forEach((instance) => {
      const matrix = instance.matrix;

      // Transform the base bounding box by the instance matrix
      const instanceBox = baseBox.clone();
      instanceBox.applyMatrix4(matrix);

      // Expand world box to include this instance
      worldBox.union(instanceBox);
    });

    // Set bounding box
    instancedMesh.geometry.boundingBox = worldBox;

    // Compute and set bounding sphere from the box
    const sphere = new Sphere();
    worldBox.getBoundingSphere(sphere);
    instancedMesh.geometry.boundingSphere = sphere;

    // Enable frustum culling
    instancedMesh.frustumCulled = true;
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

    const { instancedMesh, instanceIDs, instanceIDAttribute } = data;

    // Update the instance ID buffer with new visible IDs
    const count = Math.min(visibleInstanceIDs.length, data.maxInstances);

    for (let i = 0; i < count; i++) {
      instanceIDs[i] = visibleInstanceIDs[i];
    }

    // Mark attribute for update
    instanceIDAttribute.needsUpdate = true;

    // Update instance count
    instancedMesh.count = count;
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

    const { matrixTextureData, matrixTexture } = data;

    // Find this instance's slot in the texture
    const instance = data.instanceData.find((d) => d.id === instanceID);
    if (!instance) {
      console.warn(`Instance ${instanceID} not found`);
      return;
    }

    // Update matrix in our storage
    instance.matrix.copy(newMatrix);

    // Update matrix in texture data
    const baseIndex = instanceID * 16;
    const matrixArray = newMatrix.elements;

    for (let i = 0; i < 16; i++) {
      matrixTextureData[baseIndex + i] = matrixArray[i];
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
        currentlyVisible: data.instancedMesh.count,
        textureSize:
          data.matrixTexture.image.width +
          "x" +
          data.matrixTexture.image.height,
      });
    }

    return stats;
  }

  /**
   * Clean up resources
   */
  dispose() {
    for (const [assetKey, data] of this.managedMeshes) {
      data.matrixTexture.dispose();
      data.instancedMesh.geometry.dispose();
      data.instancedMesh.material.dispose();
    }
    this.managedMeshes.clear();
  }
}
