package com.top_logic.threed.threejs.scene;

/**
 * A <tt>glTF</tt> artifact loaded from an URL.
 */
public class GltfAsset extends Asset {

	/**
	 * Creates a {@link com.top_logic.threed.threejs.scene.GltfAsset} instance.
	 */
	public static com.top_logic.threed.threejs.scene.GltfAsset create() {
		return new com.top_logic.threed.threejs.scene.GltfAsset();
	}

	/** Identifier for the {@link com.top_logic.threed.threejs.scene.GltfAsset} type in JSON format. */
	public static final String GLTF_ASSET__TYPE = "GltfAsset";

	/** @see #getUrl() */
	public static final String URL__PROP = "url";

	/** @see #getDynamicImage() */
	public static final String DYNAMIC_IMAGE__PROP = "dynamicImage";

	private String _url = "";

	private com.top_logic.threed.threejs.scene.ImageData _dynamicImage = null;

	/**
	 * Creates a {@link GltfAsset} instance.
	 *
	 * @see com.top_logic.threed.threejs.scene.GltfAsset#create()
	 */
	protected GltfAsset() {
		super();
	}

	@Override
	public TypeKind kind() {
		return TypeKind.GLTF_ASSET;
	}

	/**
	 * The URL from which to retrieve <tt>glTF</tt> data.
	 *
	 * <p>
	 * The URL is not used when a dynamic image is set.
	 * </p>
	 *
	 * @see #getDynamicImage()
	 */
	public final String getUrl() {
		return _url;
	}

	/**
	 * @see #getUrl()
	 */
	public com.top_logic.threed.threejs.scene.GltfAsset setUrl(String value) {
		internalSetUrl(value);
		return this;
	}

	/** Internal setter for {@link #getUrl()} without chain call utility. */
	protected final void internalSetUrl(String value) {
		_listener.beforeSet(this, URL__PROP, value);
		_url = value;
		_listener.afterChanged(this, URL__PROP);
	}

	/**
	 * Dynamic image delivering the <tt>glTF</tt> data.
	 *
	 * @see #getUrl()
	 */
	public final com.top_logic.threed.threejs.scene.ImageData getDynamicImage() {
		return _dynamicImage;
	}

	/**
	 * @see #getDynamicImage()
	 */
	public com.top_logic.threed.threejs.scene.GltfAsset setDynamicImage(com.top_logic.threed.threejs.scene.ImageData value) {
		internalSetDynamicImage(value);
		return this;
	}

	/** Internal setter for {@link #getDynamicImage()} without chain call utility. */
	protected final void internalSetDynamicImage(com.top_logic.threed.threejs.scene.ImageData value) {
		_listener.beforeSet(this, DYNAMIC_IMAGE__PROP, value);
		_dynamicImage = value;
		_listener.afterChanged(this, DYNAMIC_IMAGE__PROP);
	}

	/**
	 * Checks, whether {@link #getDynamicImage()} has a value.
	 */
	public final boolean hasDynamicImage() {
		return _dynamicImage != null;
	}

	@Override
	public com.top_logic.threed.threejs.scene.GltfAsset setLayoutPoint(com.top_logic.threed.threejs.scene.ConnectionPoint value) {
		internalSetLayoutPoint(value);
		return this;
	}

	@Override
	public com.top_logic.threed.threejs.scene.GltfAsset setSnappingPoints(java.util.List<? extends com.top_logic.threed.threejs.scene.ConnectionPoint> value) {
		internalSetSnappingPoints(value);
		return this;
	}

	@Override
	public com.top_logic.threed.threejs.scene.GltfAsset addSnappingPoint(com.top_logic.threed.threejs.scene.ConnectionPoint value) {
		internalAddSnappingPoint(value);
		return this;
	}

	@Override
	public String jsonType() {
		return GLTF_ASSET__TYPE;
	}

	private static java.util.List<String> PROPERTIES = java.util.Collections.unmodifiableList(
		java.util.Arrays.asList(
			URL__PROP, 
			DYNAMIC_IMAGE__PROP));

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
			case URL__PROP: return getUrl();
			case DYNAMIC_IMAGE__PROP: return getDynamicImage();
			default: return super.get(field);
		}
	}

	@Override
	public void set(String field, Object value) {
		switch (field) {
			case URL__PROP: internalSetUrl((String) value); break;
			case DYNAMIC_IMAGE__PROP: internalSetDynamicImage((com.top_logic.threed.threejs.scene.ImageData) value); break;
			default: super.set(field, value); break;
		}
	}

	/** Reads a new instance from the given reader. */
	public static com.top_logic.threed.threejs.scene.GltfAsset readGltfAsset(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in) throws java.io.IOException {
		if (in.peek() == de.haumacher.msgbuf.json.JsonToken.NUMBER) {
			return (com.top_logic.threed.threejs.scene.GltfAsset) scope.resolveOrFail(in.nextInt());
		}
		in.beginArray();
		String type = in.nextString();
		assert GLTF_ASSET__TYPE.equals(type);
		int id = in.nextInt();
		com.top_logic.threed.threejs.scene.GltfAsset result = new com.top_logic.threed.threejs.scene.GltfAsset();
		scope.readData(result, id, in);
		in.endArray();
		return result;
	}

	@Override
	protected void writeFields(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out) throws java.io.IOException {
		super.writeFields(scope, out);
		out.name(URL__PROP);
		out.value(getUrl());
		if (hasDynamicImage()) {
			out.name(DYNAMIC_IMAGE__PROP);
			getDynamicImage().writeTo(scope, out);
		}
	}

	@Override
	public void writeFieldValue(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out, String field) throws java.io.IOException {
		switch (field) {
			case URL__PROP: {
				out.value(getUrl());
				break;
			}
			case DYNAMIC_IMAGE__PROP: {
				if (hasDynamicImage()) {
					getDynamicImage().writeTo(scope, out);
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
			case URL__PROP: setUrl(de.haumacher.msgbuf.json.JsonUtil.nextStringOptional(in)); break;
			case DYNAMIC_IMAGE__PROP: setDynamicImage(com.top_logic.threed.threejs.scene.ImageData.readImageData(scope, in)); break;
			default: super.readField(scope, in, field);
		}
	}

	@Override
	public <R,A,E extends Throwable> R visit(com.top_logic.threed.threejs.scene.Asset.Visitor<R,A,E> v, A arg) throws E {
		return v.visit(this, arg);
	}

}
