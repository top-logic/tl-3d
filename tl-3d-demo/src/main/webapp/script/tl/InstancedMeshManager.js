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
  BoxGeometry,
  Data3DTexture,
  FloatType,
  FrontSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  RGBAFormat,
  ShaderMaterial,
  Sphere,
  Vector2,
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
    // Dispose existing entry for this assetKey before overwriting
    const existingData = this.managedMeshes.get(assetKey);
    if (existingData) {
      existingData.matrixTexture?.dispose();
      existingData.geometry?.dispose();
      existingData.mesh.material?.dispose();
    }

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

    // Get base geometry bounding box
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

    // Store bounding box dimensions
    const size = new Vector3();
    baseBox.getSize(size);
    data.boundingBoxSize = size;

    // Compute world bounding box that encompasses all instances
    const worldBox = new Box3();

    instanceData.forEach((instance) => {
      const matrix = instance.matrix;
      const instanceBox = baseBox.clone();
      instanceBox.applyMatrix4(matrix);
      worldBox.union(instanceBox);
    });

    mesh.geometry.boundingBox = worldBox;

    const sphere = new Sphere();
    worldBox.getBoundingSphere(sphere);
    mesh.geometry.boundingSphere = sphere;

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
   * Create instanced billboard quads for impostors
   * @param {string} assetKey - Unique key for this asset type
   * @param {Texture} colorTexture - Atlas texture with 26 views
   * @param {Texture} depthTexture - Depth atlas texture
   * @param {number} boundingRadius - Radius of the original model's bounding sphere
   * @param {number} maxInstances - Maximum number of instances
   * @param {Array} instanceData - Array of {id, matrix} objects
   * @param {Float32Array} faceCornerUVData - Flattened array of atlas UVs per capture/face/corner
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
    faceCornerUVData,
  ) {
    const existingMeshData = this.managedMeshes.get(assetKey);
    if (!existingMeshData) {
      console.warn(`No existing mesh data for ${assetKey}`);
      return null;
    }

    const { matrixTexture, boundingBoxSize } = existingMeshData;
    const textureWidth = matrixTexture.image.width;
    const textureHeight = matrixTexture.image.height;

    // Create box geometry sized to match the bounding box
    const geometry = new BoxGeometry(
      boundingBoxSize.x,
      boundingBoxSize.y,
      boundingBoxSize.z,
    );

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

    // Build Vector2 array for the uniform — Three.js requires Vector2 objects for vec2 array uniforms
    const faceCornerUVs = [];
    for (let i = 0; i < faceCornerUVData.length; i += 2) {
      faceCornerUVs.push(
        new Vector2(faceCornerUVData[i], faceCornerUVData[i + 1]),
      );
    }

    // Create impostor material
    const material = this.createImpostorMaterial(
      colorTexture,
      depthTexture,
      boundingRadius,
      centerOffset,
      matrixTexture,
      textureWidth,
      textureHeight,
      captureOrientations,
      boundingBoxSize,
      faceCornerUVs,
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
    textureWidth,
    textureHeight,
    captureOrientations,
    boundingBoxSize,
    faceCornerUVs,
  ) {
    return new ShaderMaterial({
      uniforms: {
        colorAtlas: { value: colorTexture },
        depthAtlas: { value: depthTexture },
        matrixTexture: { value: matrixTexture },
        textureWidth: { value: textureWidth },
        textureHeight: { value: textureHeight },
        atlasResolution: { value: 256 },
        centerOffset: { value: centerOffset },
        boundingRadius: { value: boundingRadius },
        boundingBoxSize: { value: boundingBoxSize },
        faceCornerUVs: { value: faceCornerUVs },
      },
      vertexShader: `
        attribute float instanceID;

        uniform sampler3D matrixTexture;
        uniform float textureWidth;
        uniform float textureHeight;
        uniform vec3 centerOffset;

        flat varying int vCaptureIndex;
        varying vec3 vModelPos;
        varying vec3 vWorldNormal;
        varying vec3 vLocalNormal;

        void main() {
          // ---- Matrix lookup ----
          float tx = mod(instanceID, textureWidth);
          float ty = floor(instanceID / textureWidth);
          vec2 tuv = (vec2(tx, ty) + 0.5) / vec2(textureWidth, textureHeight);

          vec4 col0 = texture(matrixTexture, vec3(tuv, 0.125));
          vec4 col1 = texture(matrixTexture, vec3(tuv, 0.375));
          vec4 col2 = texture(matrixTexture, vec3(tuv, 0.625));
          vec4 col3 = texture(matrixTexture, vec3(tuv, 0.875));

          mat4 instanceMatrix = mat4(col0, col1, col2, col3);

          // Extract rotation and position from instance matrix
          mat3 instanceRotation = mat3(
            normalize(instanceMatrix[0].xyz),
            normalize(instanceMatrix[1].xyz),
            normalize(instanceMatrix[2].xyz)
          );
          vec3 instancePosLocal = instanceMatrix[3].xyz;
          vec3 adjustedPosLocal = instancePosLocal + instanceRotation * centerOffset;

          // ---- World position ----
          vec3 transformedPosition = instanceRotation * position + adjustedPosLocal;
          vec4 worldPosition = modelMatrix * vec4(transformedPosition, 1.0);

          vLocalNormal = normal;

          // ---- Model-space position for face UV lookup ----
          vModelPos = position;

          // ---- Capture index from view direction ----
          vec3 instanceWorldCenter = (modelMatrix * vec4(adjustedPosLocal, 1.0)).xyz;
          vec3 worldViewDir = normalize(cameraPosition - instanceWorldCenter);

          mat3 worldToModel = transpose(mat3(modelMatrix) * instanceRotation);
          vec3 modelViewDir = normalize(worldToModel * worldViewDir);

          vec3 a = abs(modelViewDir);
          float maxA = max(a.x, max(a.y, a.z));
          vec3 n = a / maxA; // largest component is now exactly 1, others in [0,1]

          // Each axis is either "in" or "out" based on absolute contribution
          // Raise these to shrink face/edge windows
          float edgeMin = 0.8;  // how close to the dominant axis an edge partner must be
          float faceMax = 0.2;  // how small a component must be to be considered absent

          bool xIn = n.x > edgeMin;
          bool yIn = n.y > edgeMin;
          bool zIn = n.z > edgeMin;

          bool xOut = n.x < faceMax;
          bool yOut = n.y < faceMax;
          bool zOut = n.z < faceMax;

          bool px = modelViewDir.x > 0.0;
          bool py = modelViewDir.y > 0.0;
          bool pz = modelViewDir.z > 0.0;

          int captureIdx;

          // Face: one axis dominant, other two clearly absent
          if (xIn && yOut && zOut) {
            captureIdx = px ? 0 : 1;
          } else if (yIn && xOut && zOut) {
            captureIdx = py ? 2 : 3;
          } else if (zIn && xOut && yOut) {
            captureIdx = pz ? 4 : 5;

          // Edge: two axes close in magnitude, third clearly absent
          } else if (xIn && yIn && zOut) {
            captureIdx = px ? (py ? 6 : 7) : (py ? 8 : 9);
          } else if (xIn && zIn && yOut) {
            captureIdx = px ? (pz ? 10 : 11) : (pz ? 12 : 13);
          } else if (yIn && zIn && xOut) {
            captureIdx = py ? (pz ? 14 : 15) : (pz ? 16 : 17);

          // Vertex: everything else
          } else {
            captureIdx = 18 + (px ? 0 : 4) + (py ? 0 : 2) + (pz ? 0 : 1);
          }

          vCaptureIndex = captureIdx;

          gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
      `,

      fragmentShader: `
        uniform sampler2D colorAtlas;
        uniform vec2 faceCornerUVs[624]; // 26 captures * 6 faces * 4 corners
        uniform vec3 boundingBoxSize;

        flat varying int vCaptureIndex;
        varying vec3 vModelPos;
        varying vec3 vWorldNormal;
        varying vec3 vLocalNormal;

        // Maps a world-space normal to one of 6 face indices:
        //   0 = +X, 1 = -X, 2 = +Y, 3 = -Y, 4 = +Z, 5 = -Z
        int faceIndexFromNormal(vec3 n) {
          vec3 a = abs(n);
          if (a.x >= a.y && a.x >= a.z) return n.x > 0.0 ? 0 : 1;
          if (a.y >= a.x && a.y >= a.z) return n.y > 0.0 ? 2 : 3;
          return n.z > 0.0 ? 4 : 5;
        }

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
          // ---- Determine which bounding box face this fragment is on ----
          int faceIdx = faceIndexFromNormal(normalize(vLocalNormal));

          // ---- Compute local [0,1] UV within this face ----
          // vModelPos is in local bounding box space (centred at origin).
          // Remap each axis from [-half, half] to [0, 1].
          vec3 localPos = vModelPos / boundingBoxSize + 0.5;

          // Each face uses the two axes tangent to it.
          // The axis order here must match the corner winding in buildBoxFaceDefinitions.
          //   +X / -X face: U = Z, V = Y
          //   +Y / -Y face: U = X, V = Z
          //   +Z / -Z face: U = X, V = Y
          vec2 faceUV;
          if (faceIdx == 0 || faceIdx == 1) faceUV = localPos.zy;
          else if (faceIdx == 2 || faceIdx == 3) faceUV = localPos.xz;
          else faceUV = localPos.xy;

          // ---- Look up the 4 corner atlas UVs for this capture + face ----
          int base = vCaptureIndex * 24 + faceIdx * 4; // 24 = 6 faces * 4 corners
          vec2 c00 = faceCornerUVs[base + 0]; // local (0,0)
          vec2 c10 = faceCornerUVs[base + 1]; // local (1,0)
          vec2 c11 = faceCornerUVs[base + 2]; // local (1,1)
          vec2 c01 = faceCornerUVs[base + 3]; // local (0,1)

          // ---- Affine (parallelogram) mapping ----
          vec2 edgeU = c10 - c00;
          vec2 edgeV = c01 - c00;
          vec2 atlasUV = c00 + faceUV.x * edgeU + faceUV.y * edgeV;

          vec4 color= texture2D(colorAtlas, atlasUV);

          if (color.a < 0.5) discard;

          color.rgb = LinearTosRGB(color.rgb);
          gl_FragColor = color;
        }
      `,
      transparent: false,
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
    for (const [assetKey, data] of this.managedMeshes) {
      if (assetKey.endsWith("_impostor")) continue;
      total += data.triangleCount * data.instanceData.length;
    }
    return total;
  }

  /**
   * Clean up resources
   */
  dispose() {
    for (const [assetKey, data] of this.managedMeshes) {
      data.matrixTexture?.dispose();
      data.mesh.geometry.dispose();
      data.mesh.material.dispose();
    }
    this.managedMeshes.clear();
  }
}
