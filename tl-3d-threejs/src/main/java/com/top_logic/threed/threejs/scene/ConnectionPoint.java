package com.top_logic.threed.threejs.scene;

/**
 * Class defining a point in a {@link SceneNode} where other {@link ConnectionPoint}s can be connected.
 */
public class ConnectionPoint extends de.haumacher.msgbuf.graph.AbstractSharedGraphNode {

	/**
	 * Creates a {@link com.top_logic.threed.threejs.scene.ConnectionPoint} instance.
	 */
	public static com.top_logic.threed.threejs.scene.ConnectionPoint create() {
		return new com.top_logic.threed.threejs.scene.ConnectionPoint();
	}

	/** Identifier for the {@link com.top_logic.threed.threejs.scene.ConnectionPoint} type in JSON format. */
	public static final String CONNECTION_POINT__TYPE = "ConnectionPoint";

	/** @see #getOwner() */
	public static final String OWNER__PROP = "owner";

	/** @see #getTransform() */
	public static final String TRANSFORM__PROP = "transform";

	/** @see #getClassifiers() */
	public static final String CLASSIFIERS__PROP = "classifiers";

	private com.top_logic.threed.threejs.scene.SceneNode _owner = null;

	private final java.util.List<Double> _transform = new de.haumacher.msgbuf.util.ReferenceList<Double>() {
		@Override
		protected void beforeAdd(int index, Double element) {
			_listener.beforeAdd(ConnectionPoint.this, TRANSFORM__PROP, index, element);
		}

		@Override
		protected void afterRemove(int index, Double element) {
			_listener.afterRemove(ConnectionPoint.this, TRANSFORM__PROP, index, element);
		}

		@Override
		protected void afterChanged() {
			_listener.afterChanged(ConnectionPoint.this, TRANSFORM__PROP);
		}
	};

	private final java.util.List<String> _classifiers = new de.haumacher.msgbuf.util.ReferenceList<String>() {
		@Override
		protected void beforeAdd(int index, String element) {
			_listener.beforeAdd(ConnectionPoint.this, CLASSIFIERS__PROP, index, element);
		}

		@Override
		protected void afterRemove(int index, String element) {
			_listener.afterRemove(ConnectionPoint.this, CLASSIFIERS__PROP, index, element);
		}

		@Override
		protected void afterChanged() {
			_listener.afterChanged(ConnectionPoint.this, CLASSIFIERS__PROP);
		}
	};

	/**
	 * Creates a {@link ConnectionPoint} instance.
	 *
	 * @see com.top_logic.threed.threejs.scene.ConnectionPoint#create()
	 */
	protected ConnectionPoint() {
		super();
	}

	/**
	 * The {@link SceneNode} where this {@link ConnectionPoint} is a part of.
	 */
	public final com.top_logic.threed.threejs.scene.SceneNode getOwner() {
		return _owner;
	}

	/**
	 * Internal setter for updating derived field.
	 */
	com.top_logic.threed.threejs.scene.ConnectionPoint setOwner(com.top_logic.threed.threejs.scene.SceneNode value) {
		internalSetOwner(value);
		return this;
	}

	/** Internal setter for {@link #getOwner()} without chain call utility. */
	protected final void internalSetOwner(com.top_logic.threed.threejs.scene.SceneNode value) {
		_listener.beforeSet(this, OWNER__PROP, value);
		if (value != null && _owner != null) {
			throw new IllegalStateException("Object may not be part of two different containers.");
		}
		_owner = value;
		_listener.afterChanged(this, OWNER__PROP);
	}

	/**
	 * Checks, whether {@link #getOwner()} has a value.
	 */
	public final boolean hasOwner() {
		return _owner != null;
	}

	/**
	 * Transformation where the connection point in its {@link SceneNode} lies.
	 */
	public final java.util.List<Double> getTransform() {
		return _transform;
	}

	/**
	 * @see #getTransform()
	 */
	public com.top_logic.threed.threejs.scene.ConnectionPoint setTransform(java.util.List<? extends Double> value) {
		internalSetTransform(value);
		return this;
	}

	/** Internal setter for {@link #getTransform()} without chain call utility. */
	protected final void internalSetTransform(java.util.List<? extends Double> value) {
		_transform.clear();
		_transform.addAll(value);
	}

	/**
	 * Adds a value to the {@link #getTransform()} list.
	 */
	public com.top_logic.threed.threejs.scene.ConnectionPoint addTransform(double value) {
		internalAddTransform(value);
		return this;
	}

	/** Implementation of {@link #addTransform(double)} without chain call utility. */
	protected final void internalAddTransform(double value) {
		_transform.add(value);
	}

	/**
	 * Removes a value from the {@link #getTransform()} list.
	 */
	public final void removeTransform(double value) {
		_transform.remove(value);
	}

	/**
	 * List of classifiers which defines which {@link ConnectionPoint}s can be connected.
	 */
	public final java.util.List<String> getClassifiers() {
		return _classifiers;
	}

	/**
	 * @see #getClassifiers()
	 */
	public com.top_logic.threed.threejs.scene.ConnectionPoint setClassifiers(java.util.List<? extends String> value) {
		internalSetClassifiers(value);
		return this;
	}

	/** Internal setter for {@link #getClassifiers()} without chain call utility. */
	protected final void internalSetClassifiers(java.util.List<? extends String> value) {
		_classifiers.clear();
		_classifiers.addAll(value);
	}

	/**
	 * Adds a value to the {@link #getClassifiers()} list.
	 */
	public com.top_logic.threed.threejs.scene.ConnectionPoint addClassifier(String value) {
		internalAddClassifier(value);
		return this;
	}

	/** Implementation of {@link #addClassifier(String)} without chain call utility. */
	protected final void internalAddClassifier(String value) {
		_classifiers.add(value);
	}

	/**
	 * Removes a value from the {@link #getClassifiers()} list.
	 */
	public final void removeClassifier(String value) {
		_classifiers.remove(value);
	}

	@Override
	public String jsonType() {
		return CONNECTION_POINT__TYPE;
	}

	private static java.util.List<String> PROPERTIES = java.util.Collections.unmodifiableList(
		java.util.Arrays.asList(
			OWNER__PROP, 
			TRANSFORM__PROP, 
			CLASSIFIERS__PROP));

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
			case OWNER__PROP: return getOwner();
			case TRANSFORM__PROP: return getTransform();
			case CLASSIFIERS__PROP: return getClassifiers();
			default: return super.get(field);
		}
	}

	@Override
	public void set(String field, Object value) {
		switch (field) {
			case TRANSFORM__PROP: internalSetTransform(de.haumacher.msgbuf.util.Conversions.asList(Double.class, value)); break;
			case CLASSIFIERS__PROP: internalSetClassifiers(de.haumacher.msgbuf.util.Conversions.asList(String.class, value)); break;
		}
	}

	/** Reads a new instance from the given reader. */
	public static com.top_logic.threed.threejs.scene.ConnectionPoint readConnectionPoint(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in) throws java.io.IOException {
		if (in.peek() == de.haumacher.msgbuf.json.JsonToken.NUMBER) {
			return (com.top_logic.threed.threejs.scene.ConnectionPoint) scope.resolveOrFail(in.nextInt());
		}
		in.beginArray();
		String type = in.nextString();
		assert CONNECTION_POINT__TYPE.equals(type);
		int id = in.nextInt();
		com.top_logic.threed.threejs.scene.ConnectionPoint result = new com.top_logic.threed.threejs.scene.ConnectionPoint();
		scope.readData(result, id, in);
		in.endArray();
		return result;
	}

	@Override
	protected void writeFields(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out) throws java.io.IOException {
		super.writeFields(scope, out);
		out.name(TRANSFORM__PROP);
		out.beginArray();
		for (double x : getTransform()) {
			out.value(x);
		}
		out.endArray();
		out.name(CLASSIFIERS__PROP);
		out.beginArray();
		for (String x : getClassifiers()) {
			out.value(x);
		}
		out.endArray();
	}

	@Override
	public void writeFieldValue(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out, String field) throws java.io.IOException {
		switch (field) {
			case OWNER__PROP: {
				if (hasOwner()) {
					getOwner().writeTo(scope, out);
				} else {
					out.nullValue();
				}
				break;
			}
			case TRANSFORM__PROP: {
				out.beginArray();
				for (double x : getTransform()) {
					out.value(x);
				}
				out.endArray();
				break;
			}
			case CLASSIFIERS__PROP: {
				out.beginArray();
				for (String x : getClassifiers()) {
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
				java.util.List<Double> newValue = new java.util.ArrayList<>();
				in.beginArray();
				while (in.hasNext()) {
					newValue.add(in.nextDouble());
				}
				in.endArray();
				setTransform(newValue);
			}
			break;
			case CLASSIFIERS__PROP: {
				java.util.List<String> newValue = new java.util.ArrayList<>();
				in.beginArray();
				while (in.hasNext()) {
					newValue.add(de.haumacher.msgbuf.json.JsonUtil.nextStringOptional(in));
				}
				in.endArray();
				setClassifiers(newValue);
			}
			break;
			default: super.readField(scope, in, field);
		}
	}

	@Override
	public void writeElement(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out, String field, Object element) throws java.io.IOException {
		switch (field) {
			case TRANSFORM__PROP: {
				out.value(((double) element));
				break;
			}
			case CLASSIFIERS__PROP: {
				out.value(((String) element));
				break;
			}
			default: super.writeElement(scope, out, field, element);
		}
	}

	@Override
	public Object readElement(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in, String field) throws java.io.IOException {
		switch (field) {
			case TRANSFORM__PROP: {
				return in.nextDouble();
			}
			case CLASSIFIERS__PROP: {
				return de.haumacher.msgbuf.json.JsonUtil.nextStringOptional(in);
			}
			default: return super.readElement(scope, in, field);
		}
	}

}
