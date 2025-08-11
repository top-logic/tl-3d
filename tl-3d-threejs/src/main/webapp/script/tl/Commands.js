/**
 * Command Classes for ThreeJS Control
 * Contains all command classes used for scene modifications
 */

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
  	var target = this.resolveTarget(scope);
  	if (target == null) {
  		return;
  	}
  	target.setProperty(scope, this.property, this.value);
  }
  
  
  extract() {
  	return [["S", {id: this.id, p: this.property}], this.value]; 
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
  	var target = this.resolveTarget(scope);
  	if (target == null) {
  		return;
  	}
  	
  	// Store old element for reference updating
  	const oldElement = target[this.property] && target[this.property][this.idx];
  	
  	target.insertElementAt(scope, this.property, this.idx, this.element);
  	
  	// Update 3D object references if this is a PartNode replacement
  	if (this.property === 'contents' && oldElement) {
  		// Get the newly inserted element
  		const newElement = target[this.property] && target[this.property][this.idx];
  		if (newElement) {
  			this.updateNodeReferences(scope, oldElement, newElement);
  		}
  	}
  }
  
  updateNodeReferences(scope, oldSharedObject, newSharedObject) {
  	// Skip if not dealing with SharedObjects that have 3D nodes
  	if (!oldSharedObject || !newSharedObject) {
  		return;
  	}
  	
  	// Update the nodeRef in the 3D object's userData
  	if (oldSharedObject.node && oldSharedObject.node.userData) {
  		oldSharedObject.node.userData.nodeRef = newSharedObject;
  		// Transfer the 3D node to the new SharedObject
  		newSharedObject.node = oldSharedObject.node;
  		oldSharedObject.node = null;
  	}
  }

  extract() {
  	return [["I", {id: this.id, p: this.property, i: this.idx}], this.element]; 
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
  	var target = this.resolveTarget(scope);
  	if (target == null) {
  		return;
  	}
  	
  	// Store element being removed for cleanup
  	const removedElement = target[this.property] && target[this.property][this.idx];
  	
  	target.removeElementAt(scope, this.property, this.idx);
  	
  	// Clean up 3D object references if this was a PartNode
  	if (this.property === 'contents' && removedElement && removedElement.node) {
  		// The 3D node will be orphaned, but that's expected for removal
  		removedElement.node = null;
  	}
  }

  extract() {
  	return [["R", {id: this.id, p: this.property, i: this.idx}]]; 
  }
}