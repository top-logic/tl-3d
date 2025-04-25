package com.top_logic.threed.threejs.scene;

/**
 * An atomic {@link SceneNode} displaying an {@link Asset}.
 */
public class PartNode extends SceneNode {

	/**
	 * Creates a {@link com.top_logic.threed.threejs.scene.PartNode} instance.
	 */
	public static com.top_logic.threed.threejs.scene.PartNode create() {
		return new com.top_logic.threed.threejs.scene.PartNode();
	}

	/** Identifier for the {@link com.top_logic.threed.threejs.scene.PartNode} type in JSON format. */
	public static final String PART_NODE__TYPE = "PartNode";

	/** @see #getAsset() */
	public static final String ASSET__PROP = "asset";

	private com.top_logic.threed.threejs.scene.Asset _asset = null;

	/**
	 * Creates a {@link PartNode} instance.
	 *
	 * @see com.top_logic.threed.threejs.scene.PartNode#create()
	 */
	protected PartNode() {
		super();
	}

	@Override
	public TypeKind kind() {
		return TypeKind.PART_NODE;
	}

	/**
	 * The {@link Asset} to display.
	 */
	public final com.top_logic.threed.threejs.scene.Asset getAsset() {
		return _asset;
	}

	/**
	 * @see #getAsset()
	 */
	public com.top_logic.threed.threejs.scene.PartNode setAsset(com.top_logic.threed.threejs.scene.Asset value) {
		internalSetAsset(value);
		return this;
	}

	/** Internal setter for {@link #getAsset()} without chain call utility. */
	protected final void internalSetAsset(com.top_logic.threed.threejs.scene.Asset value) {
		_listener.beforeSet(this, ASSET__PROP, value);
		_asset = value;
	}

	/**
	 * Checks, whether {@link #getAsset()} has a value.
	 */
	public final boolean hasAsset() {
		return _asset != null;
	}

	@Override
	public com.top_logic.threed.threejs.scene.PartNode setUserData(java.lang.Object value) {
		internalSetUserData(value);
		return this;
	}

	@Override
	public com.top_logic.threed.threejs.scene.PartNode setLayoutPoint(com.top_logic.threed.threejs.scene.ConnectionPoint value) {
		internalSetLayoutPoint(value);
		return this;
	}

	@Override
	public com.top_logic.threed.threejs.scene.PartNode setSnappingPoints(java.util.List<? extends com.top_logic.threed.threejs.scene.ConnectionPoint> value) {
		internalSetSnappingPoints(value);
		return this;
	}

	@Override
	public com.top_logic.threed.threejs.scene.PartNode addSnappingPoint(com.top_logic.threed.threejs.scene.ConnectionPoint value) {
		internalAddSnappingPoint(value);
		return this;
	}

	@Override
	public String jsonType() {
		return PART_NODE__TYPE;
	}

	private static java.util.List<String> PROPERTIES = java.util.Collections.unmodifiableList(
		java.util.Arrays.asList(
			ASSET__PROP));

	@Override
	public java.util.List<String> properties() {
		return PROPERTIES;
	}

	@Override
	public Object get(String field) {
		switch (field) {
			case ASSET__PROP: return getAsset();
			default: return super.get(field);
		}
	}

	@Override
	public void set(String field, Object value) {
		switch (field) {
			case ASSET__PROP: internalSetAsset((com.top_logic.threed.threejs.scene.Asset) value); break;
			default: super.set(field, value); break;
		}
	}

	/** Reads a new instance from the given reader. */
	public static com.top_logic.threed.threejs.scene.PartNode readPartNode(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in) throws java.io.IOException {
		if (in.peek() == de.haumacher.msgbuf.json.JsonToken.NUMBER) {
			return (com.top_logic.threed.threejs.scene.PartNode) scope.resolveOrFail(in.nextInt());
		}
		in.beginArray();
		String type = in.nextString();
		assert PART_NODE__TYPE.equals(type);
		int id = in.nextInt();
		com.top_logic.threed.threejs.scene.PartNode result = new com.top_logic.threed.threejs.scene.PartNode();
		scope.readData(result, id, in);
		in.endArray();
		return result;
	}

	@Override
	protected void writeFields(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out) throws java.io.IOException {
		super.writeFields(scope, out);
		if (hasAsset()) {
			out.name(ASSET__PROP);
			getAsset().writeTo(scope, out);
		}
	}

	@Override
	public void writeFieldValue(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out, String field) throws java.io.IOException {
		switch (field) {
			case ASSET__PROP: {
				if (hasAsset()) {
					getAsset().writeTo(scope, out);
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
			case ASSET__PROP: setAsset(com.top_logic.threed.threejs.scene.Asset.readAsset(scope, in)); break;
			default: super.readField(scope, in, field);
		}
	}

	@Override
	public <R,A,E extends Throwable> R visit(com.top_logic.threed.threejs.scene.SceneNode.Visitor<R,A,E> v, A arg) throws E {
		return v.visit(this, arg);
	}

}
