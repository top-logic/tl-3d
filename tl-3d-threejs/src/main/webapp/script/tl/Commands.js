/**
 * Command Classes for ThreeJS Control
 * Contains all command classes used for scene modifications
 */
import { INCREMENTAL_ADD_RELOAD_THRESHOLD } from "./Constants.js";
import { instanceKey, refreshDisplay } from "./DataModels.js";

/**
 * Recursively cleans up a removed node: detaches non-instanced Three.js nodes
 * from the scene and hides instanced nodes in the GPU texture.
 */
function cleanUpRemovedNode(scope, node) {
  if (node.willBeInstanced) {
    scope.instanceManager.setInstanceHidden(node.assetKey, node.instanceID, true);
  } else if (node.node) {
    if (node.node.parent) {
      node.node.parent.remove(node.node);
    }
    node.node = null;
    // The 3D objects of the part are gone: release its model materials and point markers.
    // (A node whose 3D object was taken over by a replacement has no node any more.)
    node.asset?.dispose();
  }
  if (node.contents) {
    for (const child of node.contents) {
      cleanUpRemovedNode(scope, child);
    }
  }
}

class Command {
  constructor(id) {
    this.id = id;
  }

  resolveTarget(scope) {
    return scope.getNode(this.id);
  }
}

export class SetProperty extends Command {
  constructor(id) {
    super(id);
  }

  loadJson(props, additional) {
    this.property = props["p"];
    this.value = additional[0];
  }

  create(id, property, value) {
    const cmd = new SetProperty(id);
    cmd.property = property;
    cmd.value = value;
    return cmd;
  }

  apply(scope) {
    const target = this.resolveTarget(scope);
    if (target == null) {
      return;
    }
    target.setProperty(scope, this.property, this.value);
  }

  extract() {
    return [["S", { id: this.id, p: this.property }], this.value];
  }
}

export class ListUpdate extends Command {
  constructor(id) {
    super(id);
  }
}

export class InsertElement extends ListUpdate {
  constructor(id) {
    super(id);
  }

  loadJson(props, additional) {
    this.idx = props["i"];
    this.property = props["p"];
    this.element = additional[0];
  }

  create(id, property, idx, element) {
    const cmd = new InsertElement(id);
    cmd.property = property;
    cmd.idx = idx;
    cmd.element = element;
    return cmd;
  }

  apply(scope) {
    const target = this.resolveTarget(scope);
    if (target == null) {
      return;
    }

    // Store old element for reference updating.
    //
    // The server replaces a node with List.set(idx, newNode), which msgbuf
    // (ReferenceList.set) reports as an insert of the new node at idx followed by
    // a remove of the old node at idx + 1. Therefore, the element at idx before
    // the insert is the node being replaced. A plain insert without a following
    // remove is not sent by the server; only appending an element is handled.
    const oldElement = target[this.property] && target[this.property][this.idx];

    target.insertElementAt(scope, this.property, this.idx, this.element);

    if (this.property !== "contents") {
      return;
    }
    const newElement = target[this.property] && target[this.property][this.idx];
    if (!newElement) {
      return;
    }
    if (oldElement) {
      // Update 3D object references if this is a replacement
      if (!this.updateNodeReferences(scope, oldElement, newElement)) {
        this.needsFullReload = true;
      } else {
        if (newElement.contents) {
          // A group takes over the 3D object of the replaced group without comparing the
          // transformation (only parts are compared, see fingerprint()): its place may have
          // changed, e.g. in another view. Moves the 3D object and the instances below.
          newElement.setProperty(scope, "transform", newElement.transform);
        }
        refreshDisplay(scope, newElement);
      }
    } else if (target.node) {
      // Appended element (not sent by the server today): build it, so that it does not stay
      // invisible until the next reload.
      this.buildAddedChild(scope, newElement, target.node);
    }
  }

  /**
   * Transfers Three.js node references and instancing annotations from an old
   * data model node to its replacement. Returns false if a full scene reload
   * is needed (ambiguous structural change that can't be resolved).
   */
  updateNodeReferences(scope, oldSharedObject, newSharedObject) {
    if (!oldSharedObject || !newSharedObject) {
      return true;
    }

    // A part that shows another model (other GLTF or layout point) cannot take over the 3D
    // object of the former part.
    if (
      oldSharedObject.asset &&
      newSharedObject.asset &&
      InsertElement.fingerprint(oldSharedObject, scope.ctrl) !==
        InsertElement.fingerprint(newSharedObject, scope.ctrl)
    ) {
      return false;
    }

    // Transfer instancing annotations if present
    if (oldSharedObject.willBeInstanced) {
      newSharedObject.willBeInstanced = true;
      newSharedObject.assetKey = oldSharedObject.assetKey;
      newSharedObject.instanceID = oldSharedObject.instanceID;

      // Update the partNode reference in instanceData
      const data = scope.instanceManager.managedMeshes.get(oldSharedObject.assetKey);
      if (data) {
        const instanceEntry = data.instanceData[oldSharedObject.instanceID];
        if (instanceEntry) {
          instanceEntry.partNode = newSharedObject;
        }
      }

      // The instance now belongs to the new node: the old node is removed afterwards
      // (see RemoveElement.apply) and must not hide it.
      oldSharedObject.willBeInstanced = false;
      oldSharedObject.assetKey = null;
      oldSharedObject.instanceID = null;
    }

    // Recursively transfer for GroupNode children
    if (oldSharedObject.contents && newSharedObject.contents) {
      const sameChildren =
        oldSharedObject.contents.length === newSharedObject.contents.length &&
        oldSharedObject.contents.every(
          (child, i) =>
            InsertElement.fingerprint(child, scope.ctrl) ===
            InsertElement.fingerprint(newSharedObject.contents[i], scope.ctrl),
        );
      if (!sameChildren) {
        // Children added, removed or changed — use fingerprint matching instead of index
        if (!this.matchChildren(scope, oldSharedObject, newSharedObject)) {
          return false;
        }
      } else {
        for (let i = 0; i < oldSharedObject.contents.length; i++) {
          if (!this.updateNodeReferences(scope, oldSharedObject.contents[i], newSharedObject.contents[i])) {
            return false;
          }
        }
      }
    }

    // The part keeps its 3D objects: the new asset takes them over (with the built snapping
    // points, and releases them when the part is removed).
    if (
      oldSharedObject.node &&
      oldSharedObject.asset &&
      newSharedObject.asset?.takeOver?.(oldSharedObject.asset) === false
    ) {
      return false;
    }

    // Update the nodeRef in the 3D object's userData
    if (oldSharedObject.node && oldSharedObject.node.userData) {
      oldSharedObject.node.userData.nodeRef = newSharedObject;
      newSharedObject.node = oldSharedObject.node;
      oldSharedObject.node = null;
    }
    return true;
  }

  /**
   * Returns a structural fingerprint for matching old children to new children.
   *
   * Uses node type + asset identity (for PartNodes) or child count (for GroupNodes),
   * and the transformation of the node. The server sends the replacement nodes as new
   * objects, so the transformation is what tells apart the copies of the same asset in a
   * group: without it, removing the first of several equal parts matched the remaining
   * parts to the wrong instances and hid the last one instead of the removed one.
   */
  static fingerprint(node, ctrl) {
    const tx = node.transform ? "@" + node.transform.join(",") : "";
    if (node.asset) {
      // The same key as for loading and instancing: the GLTF actually shown (an uploaded image
      // takes precedence over the URL) and the layout point. Otherwise a part whose asset now
      // has another image or layout point would keep showing the former model.
      const key = instanceKey(ctrl, node.asset);
      return "P:" + (key || "?") + tx;
    } else if (node.contents) {
      return "G:" + node.contents.length + tx;
    }
    return "?" + tx;
  }

  /**
   * Matches old and new GroupNode children by structural fingerprint when
   * contents lengths differ. Transfers node references for surviving children,
   * cleans up removed children, and builds new children inline.
   * Returns false if the change is ambiguous and a full reload is needed.
   */
  matchChildren(scope, oldGroupNode, newGroupNode) {
    const oldContents = oldGroupNode.contents;
    const newContents = newGroupNode.contents;
    const parentThreeJsNode = oldGroupNode.node;
    const ctrl = scope.ctrl;

    // If many children were added, fall back to a full reload so
    // analyzeForInstancing can fold them into instanced groups.
    const addedCount = Math.max(0, newContents.length - oldContents.length);
    if (addedCount > INCREMENTAL_ADD_RELOAD_THRESHOLD) {
      return false;
    }

    let i = 0; // old pointer
    let j = 0; // new pointer

    while (i < oldContents.length && j < newContents.length) {
      const oldFp = InsertElement.fingerprint(oldContents[i], ctrl);
      const newFp = InsertElement.fingerprint(newContents[j], ctrl);

      if (oldFp === newFp) {
        // Match — transfer recursively
        if (!this.updateNodeReferences(scope, oldContents[i], newContents[j])) {
          return false;
        }
        i++;
        j++;
      } else {
        // Mismatch — peek ahead to determine if it's a deletion or addition
        const nextOldFp = (i + 1 < oldContents.length) ? InsertElement.fingerprint(oldContents[i + 1], ctrl) : null;
        const nextNewFp = (j + 1 < newContents.length) ? InsertElement.fingerprint(newContents[j + 1], ctrl) : null;

        if (nextOldFp === newFp) {
          // old[i] was removed, old[i+1] matches new[j]
          this.cleanUpRemovedChild(scope, oldContents[i]);
          i++;
        } else if (oldFp === nextNewFp) {
          // new[j] was added, old[i] matches new[j+1]
          this.buildAddedChild(scope, newContents[j], parentThreeJsNode);
          j++;
        } else {
          // Ambiguous — fall back to full reload
          if (parentThreeJsNode && parentThreeJsNode.parent) {
            parentThreeJsNode.parent.remove(parentThreeJsNode);
          }
          oldGroupNode.node = null;
          return false;
        }
      }
    }

    // Handle remaining old children (all removed)
    while (i < oldContents.length) {
      this.cleanUpRemovedChild(scope, oldContents[i]);
      i++;
    }

    // Handle remaining new children (all added)
    while (j < newContents.length) {
      this.buildAddedChild(scope, newContents[j], parentThreeJsNode);
      j++;
    }

    return true;
  }

  cleanUpRemovedChild(scope, oldChild) {
    cleanUpRemovedNode(scope, oldChild);
  }

  buildAddedChild(scope, newChild, parentThreeJsNode) {
    if (parentThreeJsNode && newChild.build) {
      newChild.build(parentThreeJsNode);
      // Without its model, the added part would remain a placeholder.
      if (scope.ctrl) {
        scope.showModels(scope.ctrl, newChild);
      }
    }
  }

  extract() {
    return [
      ["I", { id: this.id, p: this.property, i: this.idx }],
      this.element,
    ];
  }
}

export class RemoveElement extends ListUpdate {
  constructor(id) {
    super(id);
  }

  loadJson(props, additional) {
    this.idx = props["i"];
    this.property = props["p"];
  }

  create(id, property, idx, element) {
    const cmd = new RemoveElement(id);
    cmd.property = property;
    cmd.idx = idx;
    return cmd;
  }

  apply(scope) {
    const target = this.resolveTarget(scope);
    if (target == null) {
      return;
    }

    // Store element being removed for cleanup
    const removedElement =
      target[this.property] && target[this.property][this.idx];

    target.removeElementAt(scope, this.property, this.idx);

    // Remove the 3D node and hide the instances of the removed subtree.
    // When the server replaces a node (insert at idx, then remove at idx + 1, see
    // InsertElement.apply), the 3D node and the instancing data have already been
    // transferred to the new node (updateNodeReferences clears them at the old node),
    // so only what was not transferred is cleaned up here.
    if (this.property === "contents" && removedElement) {
      cleanUpRemovedNode(scope, removedElement);
    }
  }

  extract() {
    return [["R", { id: this.id, p: this.property, i: this.idx }]];
  }
}
