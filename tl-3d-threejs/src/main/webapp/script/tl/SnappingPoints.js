/**
 * Snapping points of instanced parts, which have no 3D objects of their own.
 */
import {
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
} from "three";

import {
  C_P_RADIUS,
  GREEN,
  HEIGHT_SEGMENTS,
  WIDTH_SEGMENTS,
  YELLOW,
} from "./Constants.js";
import { layoutPointInverse } from "./DataModels.js";
import { toMatrix } from "./ThreeJsUtils.js";

const GREEN_COLOR = new Color(GREEN);
const YELLOW_COLOR = new Color(YELLOW);

/** Scale of the sphere of the snapping point closest to the dragged object. */
const HIGHLIGHT_SCALE = 1.5;

/**
 * Snapping points of instanced parts.
 *
 * Instanced parts have no 3D objects of their own, so their snapping points are not built as
 * spheres below the part (see ConnectionPoint.build). Instead, all of them are shown by one
 * instanced mesh, and their positions are computed from the instance matrix of the part, the
 * layout point of its asset and the transformation of the point (as in GltfAsset.build).
 *
 * The points exist only in edit mode, see rebuild().
 */
export class InstancedSnappingPoints {
  /**
   * @param {Object3D} parent - The group the instance matrices are relative to (zUpRoot).
   */
  constructor(parent) {
    this.parent = parent;
    /** Entries {partNode, point, matrix}; matrix is relative to the parent. */
    this.entries = [];
    this.mesh = null;
    this.highlighted = -1;
  }

  /**
   * Rebuilds the points of all shown instanced parts below the given root node.
   */
  rebuild(instanceManager, root) {
    this.dispose();
    if (!root) {
      return;
    }

    const entries = [];
    const collect = (node) => {
      if (node.contents) {
        node.contents.forEach(collect);
        return;
      }
      const points = node.asset?.snappingPoints;
      if (!node.willBeInstanced || !points?.length) {
        return;
      }
      if (instanceManager.isInstanceHidden(node.assetKey, node.instanceID)) {
        return;
      }
      const instance = instanceManager.managedMeshes.get(node.assetKey)
        ?.instanceData[node.instanceID];
      if (!instance) {
        return;
      }
      const assetMatrix = instance.matrix.clone();
      const layoutInverse = layoutPointInverse(node.asset);
      if (layoutInverse) {
        assetMatrix.multiply(layoutInverse);
      }
      for (const point of points) {
        entries.push({
          partNode: node,
          point,
          matrix: assetMatrix.clone().multiply(toMatrix(point.transform)),
        });
      }
    };
    collect(root);

    this.entries = entries;
    if (entries.length === 0) {
      return;
    }

    const geometry = new SphereGeometry(
      C_P_RADIUS,
      WIDTH_SEGMENTS,
      HEIGHT_SEGMENTS,
    );
    const material = new MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new InstancedMesh(geometry, material, entries.length);
    for (let i = 0; i < entries.length; i++) {
      this.mesh.setMatrixAt(i, this.sphereMatrix(i, 1));
      this.mesh.setColorAt(i, GREEN_COLOR);
    }
    this.parent.add(this.mesh);
  }

  /** Matrix of the sphere of the given point (only its position, scaled). */
  sphereMatrix(index, scale) {
    const position = new Vector3().setFromMatrixPosition(
      this.entries[index].matrix,
    );
    return new Matrix4()
      .makeTranslation(position.x, position.y, position.z)
      .scale(new Vector3(scale, scale, scale));
  }

  /** World matrix of the given point. */
  worldMatrix(index) {
    this.parent.updateMatrixWorld(true);
    return this.parent.matrixWorld.clone().multiply(this.entries[index].matrix);
  }

  /** Marks the given point as the one closest to the dragged object. */
  highlight(index) {
    if (index === this.highlighted || !this.mesh) {
      return;
    }
    this.clearHighlight();
    this.mesh.setColorAt(index, YELLOW_COLOR);
    this.mesh.setMatrixAt(index, this.sphereMatrix(index, HIGHLIGHT_SCALE));
    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.highlighted = index;
  }

  /** Removes the mark set by highlight(). */
  clearHighlight() {
    if (this.highlighted < 0 || !this.mesh) {
      this.highlighted = -1;
      return;
    }
    this.mesh.setColorAt(this.highlighted, GREEN_COLOR);
    this.mesh.setMatrixAt(this.highlighted, this.sphereMatrix(this.highlighted, 1));
    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.highlighted = -1;
  }

  dispose() {
    if (this.mesh) {
      this.parent.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.material.dispose();
      this.mesh.dispose();
      this.mesh = null;
    }
    this.entries = [];
    this.highlighted = -1;
  }
}
