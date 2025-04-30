package com.top_logic.threed.threejs.scene;

/**
 * The top-level object of a scene.
 */
public class SceneGraph extends ScenePart {

	/**
	 * Creates a {@link com.top_logic.threed.threejs.scene.SceneGraph} instance.
	 */
	public static com.top_logic.threed.threejs.scene.SceneGraph create() {
		return new com.top_logic.threed.threejs.scene.SceneGraph();
	}

	/** Identifier for the {@link com.top_logic.threed.threejs.scene.SceneGraph} type in JSON format. */
	public static final String SCENE_GRAPH__TYPE = "SceneGraph";

	/** @see #getRoot() */
	public static final String ROOT__PROP = "root";

	/** @see #getSelection() */
	public static final String SELECTION__PROP = "selection";

	private com.top_logic.threed.threejs.scene.SceneNode _root = null;

	private final java.util.List<com.top_logic.threed.threejs.scene.SceneNode> _selection = new de.haumacher.msgbuf.util.ReferenceList<com.top_logic.threed.threejs.scene.SceneNode>() {
		@Override
		protected void beforeAdd(int index, com.top_logic.threed.threejs.scene.SceneNode element) {
			_listener.beforeAdd(SceneGraph.this, SELECTION__PROP, index, element);
		}

		@Override
		protected void afterRemove(int index, com.top_logic.threed.threejs.scene.SceneNode element) {
			_listener.afterRemove(SceneGraph.this, SELECTION__PROP, index, element);
		}

		@Override
		protected void afterChanged() {
			_listener.afterChanged(SceneGraph.this, SELECTION__PROP);
		}
	};

	/**
	 * Creates a {@link SceneGraph} instance.
	 *
	 * @see com.top_logic.threed.threejs.scene.SceneGraph#create()
	 */
	protected SceneGraph() {
		super();
	}

	@Override
	public TypeKind kind() {
		return TypeKind.SCENE_GRAPH;
	}

	/**
	 * The top-level {@link SceneNode} of the scene.
	 */
	public final com.top_logic.threed.threejs.scene.SceneNode getRoot() {
		return _root;
	}

	/**
	 * @see #getRoot()
	 */
	public com.top_logic.threed.threejs.scene.SceneGraph setRoot(com.top_logic.threed.threejs.scene.SceneNode value) {
		internalSetRoot(value);
		return this;
	}

	/** Internal setter for {@link #getRoot()} without chain call utility. */
	protected final void internalSetRoot(com.top_logic.threed.threejs.scene.SceneNode value) {
		com.top_logic.threed.threejs.scene.SceneNode before = _root;
		com.top_logic.threed.threejs.scene.SceneNode after = value;
		if (after != null) {
			com.top_logic.threed.threejs.scene.ScenePart oldContainer = after.getParent();
			if (oldContainer != null && oldContainer != this) {
				throw new IllegalStateException("Object may not be part of two different containers.");
			}
		}
		_listener.beforeSet(this, ROOT__PROP, value);
		if (before != null) {
			before.internalSetParent(null);
		}
		_root = value;
		if (after != null) {
			after.internalSetParent(this);
		}
		_listener.afterChanged(this, ROOT__PROP);
	}

	/**
	 * Checks, whether {@link #getRoot()} has a value.
	 */
	public final boolean hasRoot() {
		return _root != null;
	}

	/**
	 * The currently selected {@link SceneNode}s.
	 */
	public final java.util.List<com.top_logic.threed.threejs.scene.SceneNode> getSelection() {
		return _selection;
	}

	/**
	 * @see #getSelection()
	 */
	public com.top_logic.threed.threejs.scene.SceneGraph setSelection(java.util.List<? extends com.top_logic.threed.threejs.scene.SceneNode> value) {
		internalSetSelection(value);
		return this;
	}

	/** Internal setter for {@link #getSelection()} without chain call utility. */
	protected final void internalSetSelection(java.util.List<? extends com.top_logic.threed.threejs.scene.SceneNode> value) {
		if (value == null) throw new IllegalArgumentException("Property 'selection' cannot be null.");
		_selection.clear();
		_selection.addAll(value);
	}

	/**
	 * Adds a value to the {@link #getSelection()} list.
	 */
	public com.top_logic.threed.threejs.scene.SceneGraph addSelection(com.top_logic.threed.threejs.scene.SceneNode value) {
		internalAddSelection(value);
		return this;
	}

	/** Implementation of {@link #addSelection(com.top_logic.threed.threejs.scene.SceneNode)} without chain call utility. */
	protected final void internalAddSelection(com.top_logic.threed.threejs.scene.SceneNode value) {
		_selection.add(value);
	}

	/**
	 * Removes a value from the {@link #getSelection()} list.
	 */
	public final void removeSelection(com.top_logic.threed.threejs.scene.SceneNode value) {
		_selection.remove(value);
	}

	@Override
	public String jsonType() {
		return SCENE_GRAPH__TYPE;
	}

	private static java.util.List<String> PROPERTIES = java.util.Collections.unmodifiableList(
		java.util.Arrays.asList(
			ROOT__PROP, 
			SELECTION__PROP));

	private static java.util.Set<String> TRANSIENT_PROPERTIES = java.util.Collections.unmodifiableSet(new java.util.HashSet<>(
			java.util.Arrays.asList(
				)));

	@Override
	public java.util.List<String> properties() {
		return PROPERTIES;
	}

	@Override
	public java.util.Set<String> transientProperties() {
		return TRANSIENT_PROPERTIES;
	}

	@Override
	public Object get(String field) {
		switch (field) {
			case ROOT__PROP: return getRoot();
			case SELECTION__PROP: return getSelection();
			default: return super.get(field);
		}
	}

	@Override
	public void set(String field, Object value) {
		switch (field) {
			case ROOT__PROP: internalSetRoot((com.top_logic.threed.threejs.scene.SceneNode) value); break;
			case SELECTION__PROP: internalSetSelection(de.haumacher.msgbuf.util.Conversions.asList(com.top_logic.threed.threejs.scene.SceneNode.class, value)); break;
			default: super.set(field, value); break;
		}
	}

	/** Reads a new instance from the given reader. */
	public static com.top_logic.threed.threejs.scene.SceneGraph readSceneGraph(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in) throws java.io.IOException {
		if (in.peek() == de.haumacher.msgbuf.json.JsonToken.NUMBER) {
			return (com.top_logic.threed.threejs.scene.SceneGraph) scope.resolveOrFail(in.nextInt());
		}
		in.beginArray();
		String type = in.nextString();
		assert SCENE_GRAPH__TYPE.equals(type);
		int id = in.nextInt();
		com.top_logic.threed.threejs.scene.SceneGraph result = new com.top_logic.threed.threejs.scene.SceneGraph();
		scope.readData(result, id, in);
		in.endArray();
		return result;
	}

	@Override
	protected void writeFields(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out) throws java.io.IOException {
		super.writeFields(scope, out);
		if (hasRoot()) {
			out.name(ROOT__PROP);
			getRoot().writeTo(scope, out);
		}
		out.name(SELECTION__PROP);
		out.beginArray();
		for (com.top_logic.threed.threejs.scene.SceneNode x : getSelection()) {
			x.writeTo(scope, out);
		}
		out.endArray();
	}

	@Override
	public void writeFieldValue(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out, String field) throws java.io.IOException {
		switch (field) {
			case ROOT__PROP: {
				if (hasRoot()) {
					getRoot().writeTo(scope, out);
				} else {
					out.nullValue();
				}
				break;
			}
			case SELECTION__PROP: {
				out.beginArray();
				for (com.top_logic.threed.threejs.scene.SceneNode x : getSelection()) {
					x.writeTo(scope, out);
				}
				out.endArray();
				break;
			}
			default: super.writeFieldValue(scope, out, field);
		}
	}

	@Override
	public void readField(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in, String field) throws java.io.IOException {
		switch (field) {
			case ROOT__PROP: setRoot(com.top_logic.threed.threejs.scene.SceneNode.readSceneNode(scope, in)); break;
			case SELECTION__PROP: {
				java.util.List<com.top_logic.threed.threejs.scene.SceneNode> newValue = new java.util.ArrayList<>();
				in.beginArray();
				while (in.hasNext()) {
					newValue.add(com.top_logic.threed.threejs.scene.SceneNode.readSceneNode(scope, in));
				}
				in.endArray();
				setSelection(newValue);
			}
			break;
			default: super.readField(scope, in, field);
		}
	}

	@Override
	public void writeElement(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out, String field, Object element) throws java.io.IOException {
		switch (field) {
			case SELECTION__PROP: {
				((com.top_logic.threed.threejs.scene.SceneNode) element).writeTo(scope, out);
				break;
			}
			default: super.writeElement(scope, out, field, element);
		}
	}

	@Override
	public Object readElement(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in, String field) throws java.io.IOException {
		switch (field) {
			case SELECTION__PROP: {
				return com.top_logic.threed.threejs.scene.SceneNode.readSceneNode(scope, in);
			}
			default: return super.readElement(scope, in, field);
		}
	}

	@Override
	public <R,A,E extends Throwable> R visit(com.top_logic.threed.threejs.scene.ScenePart.Visitor<R,A,E> v, A arg) throws E {
		return v.visit(this, arg);
	}

}
