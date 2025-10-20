package com.top_logic.threed.threejs.scene;

/**
 * Holder object for retrieving dynamic <tt>glTF</tt> data.
 */
public class ImageData extends de.haumacher.msgbuf.graph.AbstractSharedGraphNode {

	/**
	 * Creates a {@link com.top_logic.threed.threejs.scene.ImageData} instance.
	 */
	public static com.top_logic.threed.threejs.scene.ImageData create() {
		return new com.top_logic.threed.threejs.scene.ImageData();
	}

	/** Identifier for the {@link com.top_logic.threed.threejs.scene.ImageData} type in JSON format. */
	public static final String IMAGE_DATA__TYPE = "ImageData";

	/** @see #getImageID() */
	public static final String IMAGE_ID__PROP = "imageID";

	/** @see #getUserData() */
	public static final String USER_DATA__PROP = "userData";

	/** @see #getData() */
	public static final String DATA__PROP = "data";

	private String _imageID = "";

	private transient java.lang.Object _userData = null;

	private transient com.top_logic.model.search.expr.query.QueryExecutor _data = null;

	/**
	 * Creates a {@link ImageData} instance.
	 *
	 * @see com.top_logic.threed.threejs.scene.ImageData#create()
	 */
	protected ImageData() {
		super();
	}

	/**
	 * ID for this image. Multiple images with the same are ID are loaded once.
	 */
	public final String getImageID() {
		return _imageID;
	}

	/**
	 * @see #getImageID()
	 */
	public com.top_logic.threed.threejs.scene.ImageData setImageID(String value) {
		internalSetImageID(value);
		return this;
	}

	/** Internal setter for {@link #getImageID()} without chain call utility. */
	protected final void internalSetImageID(String value) {
		_listener.beforeSet(this, IMAGE_ID__PROP, value);
		_imageID = value;
		_listener.afterChanged(this, IMAGE_ID__PROP);
	}

	/**
	 * User object for this data.
	 */
	public final java.lang.Object getUserData() {
		return _userData;
	}

	/**
	 * @see #getUserData()
	 */
	public com.top_logic.threed.threejs.scene.ImageData setUserData(java.lang.Object value) {
		internalSetUserData(value);
		return this;
	}

	/** Internal setter for {@link #getUserData()} without chain call utility. */
	protected final void internalSetUserData(java.lang.Object value) {
		_listener.beforeSet(this, USER_DATA__PROP, value);
		_userData = value;
		_listener.afterChanged(this, USER_DATA__PROP);
	}

	/**
	 * Checks, whether {@link #getUserData()} has a value.
	 */
	public final boolean hasUserData() {
		return _userData != null;
	}

	/**
	 * {@link com.top_logic.model.search.expr.query.QueryExecutor} computing the actual image data 
	 * from {@link #getUserData()}.
	 */
	public final com.top_logic.model.search.expr.query.QueryExecutor getData() {
		return _data;
	}

	/**
	 * @see #getData()
	 */
	public com.top_logic.threed.threejs.scene.ImageData setData(com.top_logic.model.search.expr.query.QueryExecutor value) {
		internalSetData(value);
		return this;
	}

	/** Internal setter for {@link #getData()} without chain call utility. */
	protected final void internalSetData(com.top_logic.model.search.expr.query.QueryExecutor value) {
		_listener.beforeSet(this, DATA__PROP, value);
		_data = value;
		_listener.afterChanged(this, DATA__PROP);
	}

	/**
	 * Checks, whether {@link #getData()} has a value.
	 */
	public final boolean hasData() {
		return _data != null;
	}

	@Override
	public String jsonType() {
		return IMAGE_DATA__TYPE;
	}

	private static java.util.List<String> PROPERTIES = java.util.Collections.unmodifiableList(
		java.util.Arrays.asList(
			IMAGE_ID__PROP, 
			USER_DATA__PROP, 
			DATA__PROP));

	private static java.util.Set<String> TRANSIENT_PROPERTIES = java.util.Collections.unmodifiableSet(new java.util.HashSet<>(
			java.util.Arrays.asList(
				USER_DATA__PROP, 
				DATA__PROP)));

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
			case IMAGE_ID__PROP: return getImageID();
			case USER_DATA__PROP: return getUserData();
			case DATA__PROP: return getData();
			default: return super.get(field);
		}
	}

	@Override
	public void set(String field, Object value) {
		switch (field) {
			case IMAGE_ID__PROP: internalSetImageID((String) value); break;
			case USER_DATA__PROP: internalSetUserData((java.lang.Object) value); break;
			case DATA__PROP: internalSetData((com.top_logic.model.search.expr.query.QueryExecutor) value); break;
		}
	}

	/** Reads a new instance from the given reader. */
	public static com.top_logic.threed.threejs.scene.ImageData readImageData(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in) throws java.io.IOException {
		if (in.peek() == de.haumacher.msgbuf.json.JsonToken.NUMBER) {
			return (com.top_logic.threed.threejs.scene.ImageData) scope.resolveOrFail(in.nextInt());
		}
		in.beginArray();
		String type = in.nextString();
		assert IMAGE_DATA__TYPE.equals(type);
		int id = in.nextInt();
		com.top_logic.threed.threejs.scene.ImageData result = new com.top_logic.threed.threejs.scene.ImageData();
		scope.readData(result, id, in);
		in.endArray();
		return result;
	}

	@Override
	protected void writeFields(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out) throws java.io.IOException {
		super.writeFields(scope, out);
		out.name(IMAGE_ID__PROP);
		out.value(getImageID());
	}

	@Override
	public void writeFieldValue(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out, String field) throws java.io.IOException {
		switch (field) {
			case IMAGE_ID__PROP: {
				out.value(getImageID());
				break;
			}
			case USER_DATA__PROP: {
				if (hasUserData()) {
				} else {
					out.nullValue();
				}
				break;
			}
			case DATA__PROP: {
				if (hasData()) {
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
			case IMAGE_ID__PROP: setImageID(de.haumacher.msgbuf.json.JsonUtil.nextStringOptional(in)); break;
			default: super.readField(scope, in, field);
		}
	}

}
