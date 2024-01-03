package com.top_logic.tl3d.threejs.control.model;

public class Model3D extends Asset {

	/**
	 * Creates a {@link com.top_logic.tl3d.threejs.control.model.Model3D} instance.
	 */
	public static com.top_logic.tl3d.threejs.control.model.Model3D create() {
		return new com.top_logic.tl3d.threejs.control.model.Model3D();
	}

	/** Identifier for the {@link com.top_logic.tl3d.threejs.control.model.Model3D} type in JSON format. */
	public static final String MODEL_3_D__TYPE = "Model3D";

	/** @see #getUrl() */
	public static final String URL__PROP = "url";

	private String _url = "";

	/**
	 * Creates a {@link Model3D} instance.
	 *
	 * @see com.top_logic.tl3d.threejs.control.model.Model3D#create()
	 */
	protected Model3D() {
		super();
	}

	@Override
	public TypeKind kind() {
		return TypeKind.MODEL_3_D;
	}

	public final String getUrl() {
		return _url;
	}

	/**
	 * @see #getUrl()
	 */
	public com.top_logic.tl3d.threejs.control.model.Model3D setUrl(String value) {
		internalSetUrl(value);
		return this;
	}

	/** Internal setter for {@link #getUrl()} without chain call utility. */
	protected final void internalSetUrl(String value) {
		_listener.beforeSet(this, URL__PROP, value);
		_url = value;
	}

	@Override
	public String jsonType() {
		return MODEL_3_D__TYPE;
	}

	private static java.util.List<String> PROPERTIES = java.util.Collections.unmodifiableList(
		java.util.Arrays.asList(
			URL__PROP));

	@Override
	public java.util.List<String> properties() {
		return PROPERTIES;
	}

	@Override
	public Object get(String field) {
		switch (field) {
			case URL__PROP: return getUrl();
			default: return super.get(field);
		}
	}

	@Override
	public void set(String field, Object value) {
		switch (field) {
			case URL__PROP: internalSetUrl((String) value); break;
			default: super.set(field, value); break;
		}
	}

	/** Reads a new instance from the given reader. */
	public static com.top_logic.tl3d.threejs.control.model.Model3D readModel3D(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in) throws java.io.IOException {
		if (in.peek() == de.haumacher.msgbuf.json.JsonToken.NUMBER) {
			return (com.top_logic.tl3d.threejs.control.model.Model3D) scope.resolveOrFail(in.nextInt());
		}
		in.beginArray();
		String type = in.nextString();
		assert MODEL_3_D__TYPE.equals(type);
		int id = in.nextInt();
		com.top_logic.tl3d.threejs.control.model.Model3D result = new com.top_logic.tl3d.threejs.control.model.Model3D();
		scope.readData(result, id, in);
		in.endArray();
		return result;
	}

	@Override
	protected void writeFields(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out) throws java.io.IOException {
		super.writeFields(scope, out);
		out.name(URL__PROP);
		out.value(getUrl());
	}

	@Override
	public void writeFieldValue(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out, String field) throws java.io.IOException {
		switch (field) {
			case URL__PROP: {
				out.value(getUrl());
				break;
			}
			default: super.writeFieldValue(scope, out, field);
		}
	}

	@Override
	public void readField(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in, String field) throws java.io.IOException {
		switch (field) {
			case URL__PROP: setUrl(de.haumacher.msgbuf.json.JsonUtil.nextStringOptional(in)); break;
			default: super.readField(scope, in, field);
		}
	}

	@Override
	public <R,A,E extends Throwable> R visit(com.top_logic.tl3d.threejs.control.model.Asset.Visitor<R,A,E> v, A arg) throws E {
		return v.visit(this, arg);
	}

}
