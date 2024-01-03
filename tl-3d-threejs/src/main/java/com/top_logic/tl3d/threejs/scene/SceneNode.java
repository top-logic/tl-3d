package com.top_logic.tl3d.threejs.scene;

/**
 * Base class for a node in a {@link SceneGraph}
 */
public abstract class SceneNode extends de.haumacher.msgbuf.graph.AbstractSharedGraphNode {

	/** Type codes for the {@link com.top_logic.tl3d.threejs.scene.SceneNode} hierarchy. */
	public enum TypeKind {

		/** Type literal for {@link com.top_logic.tl3d.threejs.scene.GroupNode}. */
		GROUP_NODE,

		/** Type literal for {@link com.top_logic.tl3d.threejs.scene.PartNode}. */
		PART_NODE,
		;

	}

	/** Visitor interface for the {@link com.top_logic.tl3d.threejs.scene.SceneNode} hierarchy.*/
	public interface Visitor<R,A,E extends Throwable> {

		/** Visit case for {@link com.top_logic.tl3d.threejs.scene.GroupNode}.*/
		R visit(com.top_logic.tl3d.threejs.scene.GroupNode self, A arg) throws E;

		/** Visit case for {@link com.top_logic.tl3d.threejs.scene.PartNode}.*/
		R visit(com.top_logic.tl3d.threejs.scene.PartNode self, A arg) throws E;

	}

	/** @see #getTransform() */
	public static final String TRANSFORM__PROP = "transform";

	private final java.util.List<Float> _transform = new de.haumacher.msgbuf.util.ReferenceList<>() {
		@Override
		protected void beforeAdd(int index, Float element) {
			_listener.beforeAdd(SceneNode.this, TRANSFORM__PROP, index, element);
		}

		@Override
		protected void afterRemove(int index, Float element) {
			_listener.afterRemove(SceneNode.this, TRANSFORM__PROP, index, element);
		}
	};

	/**
	 * Creates a {@link SceneNode} instance.
	 */
	protected SceneNode() {
		super();
	}

	/** The type code of this instance. */
	public abstract TypeKind kind();

	/**
	 * Optional transformation applied to this and all potential sub-nodes.
	 */
	public final java.util.List<Float> getTransform() {
		return _transform;
	}

	/**
	 * @see #getTransform()
	 */
	public com.top_logic.tl3d.threejs.scene.SceneNode setTransform(java.util.List<? extends Float> value) {
		internalSetTransform(value);
		return this;
	}

	/** Internal setter for {@link #getTransform()} without chain call utility. */
	protected final void internalSetTransform(java.util.List<? extends Float> value) {
		_transform.clear();
		_transform.addAll(value);
	}

	/**
	 * Adds a value to the {@link #getTransform()} list.
	 */
	public com.top_logic.tl3d.threejs.scene.SceneNode addTransform(float value) {
		internalAddTransform(value);
		return this;
	}

	/** Implementation of {@link #addTransform(float)} without chain call utility. */
	protected final void internalAddTransform(float value) {
		_transform.add(value);
	}

	/**
	 * Removes a value from the {@link #getTransform()} list.
	 */
	public final void removeTransform(float value) {
		_transform.remove(value);
	}

	private static java.util.List<String> PROPERTIES = java.util.Collections.unmodifiableList(
		java.util.Arrays.asList(
			TRANSFORM__PROP));

	@Override
	public java.util.List<String> properties() {
		return PROPERTIES;
	}

	@Override
	public Object get(String field) {
		switch (field) {
			case TRANSFORM__PROP: return getTransform();
			default: return super.get(field);
		}
	}

	@Override
	public void set(String field, Object value) {
		switch (field) {
			case TRANSFORM__PROP: internalSetTransform(de.haumacher.msgbuf.util.Conversions.asList(Float.class, value)); break;
		}
	}

	/** Reads a new instance from the given reader. */
	public static com.top_logic.tl3d.threejs.scene.SceneNode readSceneNode(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in) throws java.io.IOException {
		if (in.peek() == de.haumacher.msgbuf.json.JsonToken.NUMBER) {
			return (com.top_logic.tl3d.threejs.scene.SceneNode) scope.resolveOrFail(in.nextInt());
		}
		com.top_logic.tl3d.threejs.scene.SceneNode result;
		in.beginArray();
		String type = in.nextString();
		int id = in.nextInt();
		switch (type) {
			case GroupNode.GROUP_NODE__TYPE: result = com.top_logic.tl3d.threejs.scene.GroupNode.create(); break;
			case PartNode.PART_NODE__TYPE: result = com.top_logic.tl3d.threejs.scene.PartNode.create(); break;
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
		out.name(TRANSFORM__PROP);
		out.beginArray();
		for (float x : getTransform()) {
			out.value(x);
		}
		out.endArray();
	}

	@Override
	public void writeFieldValue(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out, String field) throws java.io.IOException {
		switch (field) {
			case TRANSFORM__PROP: {
				out.beginArray();
				for (float x : getTransform()) {
					out.value(x);
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
			case TRANSFORM__PROP: {
				in.beginArray();
				while (in.hasNext()) {
					addTransform((float) in.nextDouble());
				}
				in.endArray();
			}
			break;
			default: super.readField(scope, in, field);
		}
	}

	@Override
	public void writeElement(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out, String field, Object element) throws java.io.IOException {
		switch (field) {
			case TRANSFORM__PROP: {
				out.value(((float) element));
				break;
			}
			default: super.writeElement(scope, out, field, element);
		}
	}

	@Override
	public Object readElement(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in, String field) throws java.io.IOException {
		switch (field) {
			case TRANSFORM__PROP: {
				return (float) in.nextDouble();
			}
			default: return super.readElement(scope, in, field);
		}
	}

	/** Accepts the given visitor. */
	public abstract <R,A,E extends Throwable> R visit(Visitor<R,A,E> v, A arg) throws E;

}
