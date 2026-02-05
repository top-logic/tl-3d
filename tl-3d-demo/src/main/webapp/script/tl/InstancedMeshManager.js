/**
 * InstancedMeshManager.js
 *
 * Manages instanced meshes using ID-based rendering with DataTexture matrix storage.
 * Uses custom instanceID attribute (more efficient than gl_InstanceID + mapping texture).
 *
 * This allows fast per-frame swapping of which instances to render by only changing
 * the ID array instead of copying full 4x4 matrices.
 */

import {
  Box3,
  DataTexture,
  FloatType,
  FrontSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  PlaneGeometry,
  RGBAFormat,
  ShaderMaterial,
  Sphere,
  Vector3,
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
    triangleCount = 100,
  ) {
    // Create DataTexture to store transformation matrices
    // Each matrix is 16 floats (4x4), packed into RGBA texture
    // Each matrix takes 4 pixels (4 rows × 4 RGBA values = 16 floats)
    const textureWidth = 4; // 4 pixels wide (one matrix row per pixel)
    const textureHeight = Math.ceil(maxInstances); // One row per instance
    const textureSize = textureWidth * textureHeight * 4; // RGBA

    const matrixTextureData = new Float32Array(textureSize);

    // Populate texture with matrices
    instanceData.forEach((instance) => {
      const matrix = instance.matrix;
      const matrixArray = matrix.elements;

      // Store matrix in texture at position = instance.id
      const baseIndex = instance.id * 16;
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
   * Patch the material's shader to use matrix lookup from DataTexture
   * Uses onBeforeCompile to inject custom code into Three.js standard shaders
   */
  createMatrixLookupMaterial(baseMaterial, matrixTexture) {
    // Clone the material to avoid modifying the original
    const material = baseMaterial.clone();

    // Patch the shader using onBeforeCompile
    material.onBeforeCompile = (shader) => {
      // Add uniforms to shader
      shader.uniforms.matrixTexture = { value: matrixTexture };
      shader.uniforms.textureHeight = { value: matrixTexture.image.height };

      // Add custom attribute and uniforms at the top
      shader.vertexShader = `
        attribute float instanceID;
        uniform sampler2D matrixTexture;
        uniform float textureHeight;

        ${shader.vertexShader}
      `;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <beginnormal_vertex>",
        `
        #ifdef USE_INSTANCING
          // Look up transformation matrix from DataTexture using instanceID attribute
          float row = instanceID;
          float rowNorm = (row + 0.5) / textureHeight;

          vec4 col0 = texture2D(matrixTexture, vec2(0.125, rowNorm));
          vec4 col1 = texture2D(matrixTexture, vec2(0.375, rowNorm));
          vec4 col2 = texture2D(matrixTexture, vec2(0.625, rowNorm));
          vec4 col3 = texture2D(matrixTexture, vec2(0.875, rowNorm));

          mat4 instanceMatrix = mat4(col0, col1, col2, col3);
        #endif

        #include <beginnormal_vertex>
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

    const { matrixTextureData, matrixTexture, instanceData } = data;

    // Instance ID is the index in the array
    const instance = instanceData[instanceID];

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
   * Create instanced billboard quads for impostors
   * @param {string} assetKey - Unique key for this asset type
   * @param {Texture} colorTexture - Atlas texture with 26 views
   * @param {Texture} depthTexture - Depth atlas texture
   * @param {number} boundingRadius - Radius of the original model's bounding sphere
   * @param {number} maxInstances - Maximum number of instances
   * @param {Array} instanceData - Array of {id, matrix} objects
   */
  createImpostorMesh(
    assetKey,
    colorTexture,
    depthTexture,
    boundingRadius,
    centerOffset,
    maxInstances,
    instanceData,
    captureOrientations,
  ) {
    // Get the existing instanced mesh data to access matrixTexture
    const existingMeshData = this.managedMeshes.get(assetKey);
    if (!existingMeshData) {
      console.warn(`No existing mesh data for ${assetKey}`);
      return null;
    }

    const { matrixTexture } = existingMeshData;
    const textureHeight = matrixTexture.image.height;

    // Create quad geometry sized to match bounding sphere diameter
    const size = boundingRadius * 2;
    const geometry = new PlaneGeometry(size, size);

    // Convert to InstancedBufferGeometry
    const instancedGeometry = new InstancedBufferGeometry().copy(geometry);

    // Add instanceID attribute
    const instanceIDs = new Float32Array(maxInstances);
    instanceData.forEach((instance, index) => {
      instanceIDs[index] = instance.id;
    });

    const instanceIDAttribute = new InstancedBufferAttribute(instanceIDs, 1);
    instancedGeometry.setAttribute("instanceID", instanceIDAttribute);
    instancedGeometry.instanceCount = instanceData.length;

    // Create impostor material with matrix texture
    const material = this.createImpostorMaterial(
      colorTexture,
      depthTexture,
      boundingRadius,
      centerOffset,
      matrixTexture,
      textureHeight,
      captureOrientations,
    );

    const mesh = new Mesh(instancedGeometry, material);
    mesh.userData.isImpostorMesh = true;
    mesh.frustumCulled = false;

    // Store management data
    const impostorKey = assetKey + "_impostor";
    this.managedMeshes.set(impostorKey, {
      mesh,
      geometry: instancedGeometry,
      instanceIDAttribute,
      instanceIDs,
      maxInstances,
      instanceData: instanceData.map((d) => ({
        id: d.id,
        matrix: d.matrix.clone(),
      })),
    });

    return mesh;
  }

  createImpostorMaterial(
    colorTexture,
    depthTexture,
    boundingRadius,
    centerOffset,
    matrixTexture,
    textureHeight,
    captureOrientations,
  ) {
    return new ShaderMaterial({
      uniforms: {
        colorAtlas: { value: colorTexture },
        depthAtlas: { value: depthTexture },
        matrixTexture: { value: matrixTexture },
        textureHeight: { value: textureHeight },
        atlasResolution: { value: 256 },
        centerOffset: { value: centerOffset },
        boundingRadius: { value: boundingRadius },
        captureOrientations: { value: captureOrientations },
      },
      vertexShader: `
       attribute float instanceID;
       uniform sampler2D matrixTexture;
       uniform float textureHeight;
       uniform vec3 centerOffset;
       uniform float boundingRadius;

       varying vec2 vUv;
       flat varying int vSpriteIndex;
       varying vec3 vViewPosition;
       varying mat3 vInstanceRotation;

       // Find nearest of 26 cardinal directions
       int findNearestDirection(vec3 dir) {
         vec3 d = normalize(dir);

         vec3 faces[6];
         faces[0] = vec3(1.0, 0.0, 0.0);
         faces[1] = vec3(-1.0, 0.0, 0.0);
         faces[2] = vec3(0.0, 1.0, 0.0);
         faces[3] = vec3(0.0, -1.0, 0.0);
         faces[4] = vec3(0.0, 0.0, 1.0);
         faces[5] = vec3(0.0, 0.0, -1.0);

         vec3 edges[12];
         edges[0] = normalize(vec3(1.0, 1.0, 0.0));
         edges[1] = normalize(vec3(1.0, -1.0, 0.0));
         edges[2] = normalize(vec3(-1.0, 1.0, 0.0));
         edges[3] = normalize(vec3(-1.0, -1.0, 0.0));
         edges[4] = normalize(vec3(1.0, 0.0, 1.0));
         edges[5] = normalize(vec3(1.0, 0.0, -1.0));
         edges[6] = normalize(vec3(-1.0, 0.0, 1.0));
         edges[7] = normalize(vec3(-1.0, 0.0, -1.0));
         edges[8] = normalize(vec3(0.0, 1.0, 1.0));
         edges[9] = normalize(vec3(0.0, 1.0, -1.0));
         edges[10] = normalize(vec3(0.0, -1.0, 1.0));
         edges[11] = normalize(vec3(0.0, -1.0, -1.0));

         vec3 vertices[8];
         vertices[0] = normalize(vec3(1.0, 1.0, 1.0));
         vertices[1] = normalize(vec3(1.0, 1.0, -1.0));
         vertices[2] = normalize(vec3(1.0, -1.0, 1.0));
         vertices[3] = normalize(vec3(1.0, -1.0, -1.0));
         vertices[4] = normalize(vec3(-1.0, 1.0, 1.0));
         vertices[5] = normalize(vec3(-1.0, 1.0, -1.0));
         vertices[6] = normalize(vec3(-1.0, -1.0, 1.0));
         vertices[7] = normalize(vec3(-1.0, -1.0, -1.0));

         float maxDot = -2.0;
         int bestIndex = 0;

         // Test for the camera position vector with the dot product closest to -1.0,
         // since it is the closest to being parallel and opposite to the camera forward direction.

         for (int i = 0; i < 6; i++) {
           float dotProd = dot(d, faces[i]);
           if (dotProd > maxDot) {
             maxDot = dotProd;
             bestIndex = i;
           }
         }

         for (int i = 0; i < 12; i++) {
           float dotProd = dot(d, edges[i]);
           if (dotProd > maxDot) {
             maxDot = dotProd;
             bestIndex = 6 + i;
           }
         }

         for (int i = 0; i < 8; i++) {
           float dotProd = dot(d, vertices[i]);
           if (dotProd > maxDot) {
             maxDot = dotProd;
             bestIndex = 18 + i;
           }
         }

         return bestIndex;
       }

       void main() {
         vUv = uv;

         // Look up instance matrix
         float row = instanceID;
         float rowNorm = (row + 0.5) / textureHeight;

         vec4 col0 = texture2D(matrixTexture, vec2(0.125, rowNorm));
         vec4 col1 = texture2D(matrixTexture, vec2(0.375, rowNorm));
         vec4 col2 = texture2D(matrixTexture, vec2(0.625, rowNorm));
         vec4 col3 = texture2D(matrixTexture, vec2(0.875, rowNorm));

         mat4 instanceMatrix = mat4(col0, col1, col2, col3);

         vec3 instancePosLocal = instanceMatrix[3].xyz;

         // Extract rotation from instance matrix (combined with modelMatrix)
         mat4 fullMatrix = modelMatrix * instanceMatrix;

         mat3 instanceRotationLocal = mat3(
           normalize(instanceMatrix[0].xyz),
           normalize(instanceMatrix[1].xyz),
           normalize(instanceMatrix[2].xyz)
         );

         vInstanceRotation = mat3(
           normalize(fullMatrix[0].xyz),
           normalize(fullMatrix[1].xyz),
           normalize(fullMatrix[2].xyz)
         );

         // Apply instance rotation to center offset and add it back to the instance position
         vec3 adjustedPosLocal = instancePosLocal + instanceRotationLocal * centerOffset;

         vec3 instancePosWorld = (modelMatrix * vec4(adjustedPosLocal, 1.0)).xyz;

         // Simple screen-aligned billboard
         vec3 cameraRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
         vec3 cameraUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);

         vec3 billboardPosWorld = instancePosWorld
           + cameraRight * position.x
           + cameraUp * position.y;

         vec4 viewPos = viewMatrix * vec4(billboardPosWorld, 1.0);
         vViewPosition = viewPos.xyz;

         gl_Position = projectionMatrix * viewPos;

         // Compute view direction in instance local space
         vec3 cameraForward = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
         vec3 localViewDir = transpose(vInstanceRotation) * cameraForward;

         // Find nearest direction
         vSpriteIndex = findNearestDirection(-localViewDir);
       }
      `,

      fragmentShader: `
       uniform float boundingRadius;
       uniform mat4 projectionMatrix;
       uniform sampler2D colorAtlas;
       uniform sampler2D depthAtlas;
       uniform vec3 captureOrientations[26];

       varying vec2 vUv;
       flat varying int vSpriteIndex;
       varying vec3 vViewPosition;
       varying mat3 vInstanceRotation;

       vec3 LinearTosRGB(vec3 color) {
         vec3 a = vec3(0.055);
         vec3 ap1 = vec3(1.0) + a;
         vec3 g = vec3(2.4);
         vec3 ginv = vec3(1.0) / g;

         return mix(
           color * 12.92,
           ap1 * pow(color, ginv) - a,
           step(vec3(0.0031308), color)
         );
       }


       void main() {
         vec2 centeredUv = vUv - 0.5;
         float distFromCenter = length(centeredUv);
         if (distFromCenter > 0.5) discard;

         // Get the capture orientation for this sprite
         vec3 captureUp = captureOrientations[vSpriteIndex];

         // DEBUG: Visualize the capture up vector
         // Transform to world space and then show as color
         vec3 worldCaptureUp = normalize(vInstanceRotation * captureUp);

         // Project onto screen space (view space)
         vec3 screenCaptureUp = normalize(mat3(viewMatrix) * worldCaptureUp);

         // Calculate rotation angle needed to align screenCaptureUp with (0, 1, 0)
         float rotationAngle = atan(screenCaptureUp.x, screenCaptureUp.y);

         // Rotate UV coordinates around center (0.5, 0.5)
         float cosAngle = cos(rotationAngle);
         float sinAngle = sin(rotationAngle);
         vec2 rotatedUv = vec2(
           centeredUv.x * cosAngle - centeredUv.y * sinAngle,
           centeredUv.x * sinAngle + centeredUv.y * cosAngle
         );
         rotatedUv += 0.5;

         // Calculate atlas UV based on sprite index
         int gridX = vSpriteIndex % 6;
         int gridY = vSpriteIndex / 6;
         vec2 atlasUv = (vec2(float(gridX), float(gridY)) + rotatedUv) / vec2(6.0, 5.0);

         // Sample from atlas
         vec4 color = texture2D(colorAtlas, atlasUv);

         float sampledDepth = texture2D(depthAtlas, atlasUv).r;
         if (sampledDepth >= 1.0) discard;

         float near = 0.1;
         float far = boundingRadius * 3.0;
         float linearDepth = near + sampledDepth * (far - near);
         float centerDepthInCapture = boundingRadius * 2.0 - near;
         float depthOffset = centerDepthInCapture - linearDepth;

         vec3 adjustedViewPos = vViewPosition;
         adjustedViewPos.z += depthOffset;

         vec4 clipPos = projectionMatrix * vec4(adjustedViewPos, 1.0);
         gl_FragDepth = (clipPos.z / clipPos.w) * 0.5 + 0.5;

         // Discard transparent pixels
         if (color.a < 0.5) discard;

         color.rgb = LinearTosRGB(color.rgb);
         gl_FragColor = color;
       }
      `,
      transparent: true,
      side: FrontSide,
    });
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
      data.mesh.geometry.dispose();
      data.mesh.material.dispose();
    }
    this.managedMeshes.clear();
  }
}
