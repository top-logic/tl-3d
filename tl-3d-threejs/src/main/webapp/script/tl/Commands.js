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
  	target.insertElementAt(scope, this.property, this.idx, this.element);
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
  	target.removeElementAt(scope, this.property, this.idx);
  }

  extract() {
  	return [["R", {id: this.id, p: this.property, i: this.idx}]]; 
  }
}