package com.top_logic.threed.threejs.scene;

/**
 * Base class for a part in a {@link SceneGraph}
 */
public abstract class ScenePart extends de.haumacher.msgbuf.graph.AbstractSharedGraphNode {

	/** Type codes for the {@link com.top_logic.threed.threejs.scene.ScenePart} hierarchy. */
	public enum TypeKind {

		/** Type literal for {@link com.top_logic.threed.threejs.scene.GroupNode}. */
		GROUP_NODE,

		/** Type literal for {@link com.top_logic.threed.threejs.scene.PartNode}. */
		PART_NODE,

		/** Type literal for {@link com.top_logic.threed.threejs.scene.SceneGraph}. */
		SCENE_GRAPH,
		;

	}

	/** Visitor interface for the {@link com.top_logic.threed.threejs.scene.ScenePart} hierarchy.*/
	public interface Visitor<R,A,E extends Throwable> extends com.top_logic.threed.threejs.scene.SceneNode.Visitor<R,A,E> {

		/** Visit case for {@link com.top_logic.threed.threejs.scene.SceneGraph}.*/
		R visit(com.top_logic.threed.threejs.scene.SceneGraph self, A arg) throws E;

	}

	/** @see #getParent() */
	public static final String PARENT__PROP = "parent";

	private com.top_logic.threed.threejs.scene.ScenePart _parent = null;

	/**
	 * Creates a {@link ScenePart} instance.
	 */
	protected ScenePart() {
		super();
	}

	/** The type code of this instance. */
	public abstract TypeKind kind();

	/**
	 * The {@link ScenePart} where this {@link ScenePart} is a part of.
	 */
	public final com.top_logic.threed.threejs.scene.ScenePart getParent() {
		return _parent;
	}

	/**
	 * Internal setter for updating derived field.
	 */
	com.top_logic.threed.threejs.scene.ScenePart setParent(com.top_logic.threed.threejs.scene.ScenePart value) {
		internalSetParent(value);
		return this;
	}

	/** Internal setter for {@link #getParent()} without chain call utility. */
	protected final void internalSetParent(com.top_logic.threed.threejs.scene.ScenePart value) {
		_listener.beforeSet(this, PARENT__PROP, value);
		if (value != null && _parent != null) {
			throw new IllegalStateException("Object may not be part of two different containers.");
		}
		_parent = value;
		_listener.afterChanged(this, PARENT__PROP);
	}

	/**
	 * Checks, whether {@link #getParent()} has a value.
	 */
	public final boolean hasParent() {
		return _parent != null;
	}

	private static java.util.List<String> PROPERTIES = java.util.Collections.unmodifiableList(
		java.util.Arrays.asList(
			PARENT__PROP));

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
			case PARENT__PROP: return getParent();
			default: return super.get(field);
		}
	}

	@Override
	public void set(String field, Object value) {
		switch (field) {
		}
	}

	/** Reads a new instance from the given reader. */
	public static com.top_logic.threed.threejs.scene.ScenePart readScenePart(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in) throws java.io.IOException {
		if (in.peek() == de.haumacher.msgbuf.json.JsonToken.NUMBER) {
			return (com.top_logic.threed.threejs.scene.ScenePart) scope.resolveOrFail(in.nextInt());
		}
		com.top_logic.threed.threejs.scene.ScenePart result;
		in.beginArray();
		String type = in.nextString();
		int id = in.nextInt();
		switch (type) {
			case SceneGraph.SCENE_GRAPH__TYPE: result = com.top_logic.threed.threejs.scene.SceneGraph.create(); break;
			case GroupNode.GROUP_NODE__TYPE: result = com.top_logic.threed.threejs.scene.GroupNode.create(); break;
			case PartNode.PART_NODE__TYPE: result = com.top_logic.threed.threejs.scene.PartNode.create(); break;
			default: in.skipValue(); result = null; break;
		}
		if (result != null) {
			scope.readData(result, id, in);
		}
		in.endArray();
		return result;
	}

	@Override
	protected void writeFields(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out) throws java.io.IOException {
		super.writeFields(scope, out);
	}

	@Override
	public void writeFieldValue(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out, String field) throws java.io.IOException {
		switch (field) {
			case PARENT__PROP: {
				if (hasParent()) {
					getParent().writeTo(scope, out);
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
			default: super.readField(scope, in, field);
		}
	}

	/** Accepts the given visitor. */
	public abstract <R,A,E extends Throwable> R visit(Visitor<R,A,E> v, A arg) throws E;

}
