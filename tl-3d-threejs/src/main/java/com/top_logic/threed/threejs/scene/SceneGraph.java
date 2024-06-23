package com.top_logic.threed.threejs.scene;

/**
 * The top-level object of a scene.
 */
public class SceneGraph extends de.haumacher.msgbuf.graph.AbstractSharedGraphNode {

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

	private com.top_logic.threed.threejs.scene.SceneNode _root = null;

	/**
	 * Creates a {@link SceneGraph} instance.
	 *
	 * @see com.top_logic.threed.threejs.scene.SceneGraph#create()
	 */
	protected SceneGraph() {
		super();
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
		_listener.beforeSet(this, ROOT__PROP, value);
		_root = value;
	}

	/**
	 * Checks, whether {@link #getRoot()} has a value.
	 */
	public final boolean hasRoot() {
		return _root != null;
	}

	@Override
	public String jsonType() {
		return SCENE_GRAPH__TYPE;
	}

	private static java.util.List<String> PROPERTIES = java.util.Collections.unmodifiableList(
		java.util.Arrays.asList(
			ROOT__PROP));

	@Override
	public java.util.List<String> properties() {
		return PROPERTIES;
	}

	@Override
	public Object get(String field) {
		switch (field) {
			case ROOT__PROP: return getRoot();
			default: return super.get(field);
		}
	}

	@Override
	public void set(String field, Object value) {
		switch (field) {
			case ROOT__PROP: internalSetRoot((com.top_logic.threed.threejs.scene.SceneNode) value); break;
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
			default: super.writeFieldValue(scope, out, field);
		}
	}

	@Override
	public void readField(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in, String field) throws java.io.IOException {
		switch (field) {
			case ROOT__PROP: setRoot(com.top_logic.threed.threejs.scene.SceneNode.readSceneNode(scope, in)); break;
			default: super.readField(scope, in, field);
		}
	}

}
