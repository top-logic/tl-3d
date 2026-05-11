/**
 * Command Classes for ThreeJS Control
 * Contains all command classes used for scene modifications
 */
import { INCREMENTAL_ADD_RELOAD_THRESHOLD } from "./Constants.js";

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

    // Store old element for reference updating
    const oldElement = target[this.property] && target[this.property][this.idx];

    target.insertElementAt(scope, this.property, this.idx, this.element);

    // Update 3D object references if this is a replacement
    if (this.property === "contents" && oldElement) {
      const newElement =
        target[this.property] && target[this.property][this.idx];
      if (newElement) {
        if (!this.updateNodeReferences(scope, oldElement, newElement)) {
          this.needsFullReload = true;
        }
      }
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
    }

    // Recursively transfer for GroupNode children
    if (oldSharedObject.contents && newSharedObject.contents) {
      if (oldSharedObject.contents.length !== newSharedObject.contents.length) {
        // Contents length changed — use fingerprint matching instead of index
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
   * Uses node type + asset identity (for PartNodes) or child count (for GroupNodes).
   */
  static fingerprint(node) {
    if (node.asset) {
      const key = node.asset.url || (node.asset.dynamicImage ? "dyn:" + node.asset.dynamicImage.imageID : null);
      return "P:" + (key || "?");
    } else if (node.contents) {
      return "G:" + node.contents.length;
    }
    return "?";
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

    // If many children were added, fall back to a full reload so
    // analyzeForInstancing can fold them into instanced groups.
    const addedCount = Math.max(0, newContents.length - oldContents.length);
    if (addedCount > INCREMENTAL_ADD_RELOAD_THRESHOLD) {
      return false;
    }

    let i = 0; // old pointer
    let j = 0; // new pointer

    while (i < oldContents.length && j < newContents.length) {
      const oldFp = InsertElement.fingerprint(oldContents[i]);
      const newFp = InsertElement.fingerprint(newContents[j]);

      if (oldFp === newFp) {
        // Match — transfer recursively
        if (!this.updateNodeReferences(scope, oldContents[i], newContents[j])) {
          return false;
        }
        i++;
        j++;
      } else {
        // Mismatch — peek ahead to determine if it's a deletion or addition
        const nextOldFp = (i + 1 < oldContents.length) ? InsertElement.fingerprint(oldContents[i + 1]) : null;
        const nextNewFp = (j + 1 < newContents.length) ? InsertElement.fingerprint(newContents[j + 1]) : null;

        if (nextOldFp === newFp) {
          // old[i] was removed, old[i+1] matches new[j]
          this.cleanUpRemovedChild(scope, oldContents[i]);
          i++;
        } else if (oldFp === nextNewFp) {
          // new[j] was added, old[i] matches new[j+1]
          this.buildAddedChild(newContents[j], parentThreeJsNode);
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
      this.buildAddedChild(newContents[j], parentThreeJsNode);
      j++;
    }

    return true;
  }

  cleanUpRemovedChild(scope, oldChild) {
    cleanUpRemovedNode(scope, oldChild);
  }

  buildAddedChild(newChild, parentThreeJsNode) {
    if (parentThreeJsNode && newChild.build) {
      newChild.build(parentThreeJsNode);
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

    // Remove the 3D node from the scene if this was a non-instanced node.
    // Instanced cleanup is handled by InsertElement.matchChildren when the
    // server replaces the parent via a Remove+Insert pair.
    if (this.property === "contents" && removedElement && removedElement.node) {
      if (removedElement.node.parent) {
        removedElement.node.parent.remove(removedElement.node);
      }
      removedElement.node = null;
    }
  }

  extract() {
    return [["R", { id: this.id, p: this.property, i: this.idx }]];
  }
}
