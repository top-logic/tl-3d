package com.top_logic.tl3d.threejs.scene;

public class Cube extends Asset {

	/**
	 * Creates a {@link com.top_logic.tl3d.threejs.scene.Cube} instance.
	 */
	public static com.top_logic.tl3d.threejs.scene.Cube create() {
		return new com.top_logic.tl3d.threejs.scene.Cube();
	}

	/** Identifier for the {@link com.top_logic.tl3d.threejs.scene.Cube} type in JSON format. */
	public static final String CUBE__TYPE = "Cube";

	/** @see #getWidth() */
	public static final String WIDTH__PROP = "width";

	/** @see #getHeight() */
	public static final String HEIGHT__PROP = "height";

	/** @see #getDepth() */
	public static final String DEPTH__PROP = "depth";

	private float _width = 0.0f;

	private float _height = 0.0f;

	private float _depth = 0.0f;

	/**
	 * Creates a {@link Cube} instance.
	 *
	 * @see com.top_logic.tl3d.threejs.scene.Cube#create()
	 */
	protected Cube() {
		super();
	}

	@Override
	public TypeKind kind() {
		return TypeKind.CUBE;
	}

	public final float getWidth() {
		return _width;
	}

	/**
	 * @see #getWidth()
	 */
	public com.top_logic.tl3d.threejs.scene.Cube setWidth(float value) {
		internalSetWidth(value);
		return this;
	}

	/** Internal setter for {@link #getWidth()} without chain call utility. */
	protected final void internalSetWidth(float value) {
		_listener.beforeSet(this, WIDTH__PROP, value);
		_width = value;
	}

	public final float getHeight() {
		return _height;
	}

	/**
	 * @see #getHeight()
	 */
	public com.top_logic.tl3d.threejs.scene.Cube setHeight(float value) {
		internalSetHeight(value);
		return this;
	}

	/** Internal setter for {@link #getHeight()} without chain call utility. */
	protected final void internalSetHeight(float value) {
		_listener.beforeSet(this, HEIGHT__PROP, value);
		_height = value;
	}

	public final float getDepth() {
		return _depth;
	}

	/**
	 * @see #getDepth()
	 */
	public com.top_logic.tl3d.threejs.scene.Cube setDepth(float value) {
		internalSetDepth(value);
		return this;
	}

	/** Internal setter for {@link #getDepth()} without chain call utility. */
	protected final void internalSetDepth(float value) {
		_listener.beforeSet(this, DEPTH__PROP, value);
		_depth = value;
	}

	@Override
	public String jsonType() {
		return CUBE__TYPE;
	}

	private static java.util.List<String> PROPERTIES = java.util.Collections.unmodifiableList(
		java.util.Arrays.asList(
			WIDTH__PROP, 
			HEIGHT__PROP, 
			DEPTH__PROP));

	@Override
	public java.util.List<String> properties() {
		return PROPERTIES;
	}

	@Override
	public Object get(String field) {
		switch (field) {
			case WIDTH__PROP: return getWidth();
			case HEIGHT__PROP: return getHeight();
			case DEPTH__PROP: return getDepth();
			default: return super.get(field);
		}
	}

	@Override
	public void set(String field, Object value) {
		switch (field) {
			case WIDTH__PROP: internalSetWidth((float) value); break;
			case HEIGHT__PROP: internalSetHeight((float) value); break;
			case DEPTH__PROP: internalSetDepth((float) value); break;
			default: super.set(field, value); break;
		}
	}

	/** Reads a new instance from the given reader. */
	public static com.top_logic.tl3d.threejs.scene.Cube readCube(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in) throws java.io.IOException {
		if (in.peek() == de.haumacher.msgbuf.json.JsonToken.NUMBER) {
			return (com.top_logic.tl3d.threejs.scene.Cube) scope.resolveOrFail(in.nextInt());
		}
		in.beginArray();
		String type = in.nextString();
		assert CUBE__TYPE.equals(type);
		int id = in.nextInt();
		com.top_logic.tl3d.threejs.scene.Cube result = new com.top_logic.tl3d.threejs.scene.Cube();
		scope.readData(result, id, in);
		in.endArray();
		return result;
	}

	@Override
	protected void writeFields(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out) throws java.io.IOException {
		super.writeFields(scope, out);
		out.name(WIDTH__PROP);
		out.value(getWidth());
		out.name(HEIGHT__PROP);
		out.value(getHeight());
		out.name(DEPTH__PROP);
		out.value(getDepth());
	}

	@Override
	public void writeFieldValue(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out, String field) throws java.io.IOException {
		switch (field) {
			case WIDTH__PROP: {
				out.value(getWidth());
				break;
			}
			case HEIGHT__PROP: {
				out.value(getHeight());
				break;
			}
			case DEPTH__PROP: {
				out.value(getDepth());
				break;
			}
			default: super.writeFieldValue(scope, out, field);
		}
	}

	@Override
	public void readField(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in, String field) throws java.io.IOException {
		switch (field) {
			case WIDTH__PROP: setWidth((float) in.nextDouble()); break;
			case HEIGHT__PROP: setHeight((float) in.nextDouble()); break;
			case DEPTH__PROP: setDepth((float) in.nextDouble()); break;
			default: super.readField(scope, in, field);
		}
	}

	@Override
	public <R,A,E extends Throwable> R visit(com.top_logic.tl3d.threejs.scene.Asset.Visitor<R,A,E> v, A arg) throws E {
		return v.visit(this, arg);
	}

}
