package com.top_logic.threed.threejs.scene;

/**
 * Base class for a node in a {@link SceneGraph}
 */
public abstract class SceneNode extends ScenePart {

	/** Visitor interface for the {@link com.top_logic.threed.threejs.scene.SceneNode} hierarchy.*/
	public interface Visitor<R,A,E extends Throwable> {

		/** Visit case for {@link com.top_logic.threed.threejs.scene.GroupNode}.*/
		R visit(com.top_logic.threed.threejs.scene.GroupNode self, A arg) throws E;

		/** Visit case for {@link com.top_logic.threed.threejs.scene.PartNode}.*/
		R visit(com.top_logic.threed.threejs.scene.PartNode self, A arg) throws E;

	}

	/** @see #getUserData() */
	public static final String USER_DATA__PROP = "userData";

	/** @see #getLayoutPoint() */
	public static final String LAYOUT_POINT__PROP = "layoutPoint";

	/** @see #getSnappingPoints() */
	public static final String SNAPPING_POINTS__PROP = "snappingPoints";

	private transient java.lang.Object _userData = null;

	private com.top_logic.threed.threejs.scene.ConnectionPoint _layoutPoint = null;

	private final java.util.List<com.top_logic.threed.threejs.scene.ConnectionPoint> _snappingPoints = new de.haumacher.msgbuf.util.ReferenceList<com.top_logic.threed.threejs.scene.ConnectionPoint>() {
		@Override
		protected void beforeAdd(int index, com.top_logic.threed.threejs.scene.ConnectionPoint element) {
			com.top_logic.threed.threejs.scene.ConnectionPoint added = element;
			com.top_logic.threed.threejs.scene.SceneNode oldContainer = added.getOwner();
			if (oldContainer != null && oldContainer != SceneNode.this) {
				throw new IllegalStateException("Object may not be part of two different containers.");
			}
			_listener.beforeAdd(SceneNode.this, SNAPPING_POINTS__PROP, index, element);
			added.internalSetOwner(SceneNode.this);
		}

		@Override
		protected void afterRemove(int index, com.top_logic.threed.threejs.scene.ConnectionPoint element) {
			com.top_logic.threed.threejs.scene.ConnectionPoint removed = element;
			removed.internalSetOwner(null);
			_listener.afterRemove(SceneNode.this, SNAPPING_POINTS__PROP, index, element);
		}

		@Override
		protected void afterChanged() {
			_listener.afterChanged(SceneNode.this, SNAPPING_POINTS__PROP);
		}
	};

	/**
	 * Creates a {@link SceneNode} instance.
	 */
	protected SceneNode() {
		super();
	}

	/**
	 * Reference to a custom object that is represented by this scene node.
	 */
	public final java.lang.Object getUserData() {
		return _userData;
	}

	/**
	 * @see #getUserData()
	 */
	public com.top_logic.threed.threejs.scene.SceneNode setUserData(java.lang.Object value) {
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
	 * Optional {@link ConnectionPoint} defining the point where this node can be connected.
	 */
	public final com.top_logic.threed.threejs.scene.ConnectionPoint getLayoutPoint() {
		return _layoutPoint;
	}

	/**
	 * @see #getLayoutPoint()
	 */
	public com.top_logic.threed.threejs.scene.SceneNode setLayoutPoint(com.top_logic.threed.threejs.scene.ConnectionPoint value) {
		internalSetLayoutPoint(value);
		return this;
	}

	/** Internal setter for {@link #getLayoutPoint()} without chain call utility. */
	protected final void internalSetLayoutPoint(com.top_logic.threed.threejs.scene.ConnectionPoint value) {
		com.top_logic.threed.threejs.scene.ConnectionPoint before = _layoutPoint;
		com.top_logic.threed.threejs.scene.ConnectionPoint after = value;
		if (after != null) {
			com.top_logic.threed.threejs.scene.SceneNode oldContainer = after.getOwner();
			if (oldContainer != null && oldContainer != this) {
				throw new IllegalStateException("Object may not be part of two different containers.");
			}
		}
		_listener.beforeSet(this, LAYOUT_POINT__PROP, value);
		if (before != null) {
			before.internalSetOwner(null);
		}
		_layoutPoint = value;
		if (after != null) {
			after.internalSetOwner(this);
		}
		_listener.afterChanged(this, LAYOUT_POINT__PROP);
	}

	/**
	 * Checks, whether {@link #getLayoutPoint()} has a value.
	 */
	public final boolean hasLayoutPoint() {
		return _layoutPoint != null;
	}

	/**
	 * Optional {@link ConnectionPoint}s defining points where other {@link SceneNode}s can be connected with its {@link SceneNode#getLayoutPoint()}.
	 */
	public final java.util.List<com.top_logic.threed.threejs.scene.ConnectionPoint> getSnappingPoints() {
		return _snappingPoints;
	}

	/**
	 * @see #getSnappingPoints()
	 */
	public com.top_logic.threed.threejs.scene.SceneNode setSnappingPoints(java.util.List<? extends com.top_logic.threed.threejs.scene.ConnectionPoint> value) {
		internalSetSnappingPoints(value);
		return this;
	}

	/** Internal setter for {@link #getSnappingPoints()} without chain call utility. */
	protected final void internalSetSnappingPoints(java.util.List<? extends com.top_logic.threed.threejs.scene.ConnectionPoint> value) {
		if (value == null) throw new IllegalArgumentException("Property 'snappingPoints' cannot be null.");
		_snappingPoints.clear();
		_snappingPoints.addAll(value);
	}

	/**
	 * Adds a value to the {@link #getSnappingPoints()} list.
	 */
	public com.top_logic.threed.threejs.scene.SceneNode addSnappingPoint(com.top_logic.threed.threejs.scene.ConnectionPoint value) {
		internalAddSnappingPoint(value);
		return this;
	}

	/** Implementation of {@link #addSnappingPoint(com.top_logic.threed.threejs.scene.ConnectionPoint)} without chain call utility. */
	protected final void internalAddSnappingPoint(com.top_logic.threed.threejs.scene.ConnectionPoint value) {
		_snappingPoints.add(value);
	}

	/**
	 * Removes a value from the {@link #getSnappingPoints()} list.
	 */
	public final void removeSnappingPoint(com.top_logic.threed.threejs.scene.ConnectionPoint value) {
		_snappingPoints.remove(value);
	}

	private static java.util.List<String> PROPERTIES = java.util.Collections.unmodifiableList(
		java.util.Arrays.asList(
			USER_DATA__PROP, 
			LAYOUT_POINT__PROP, 
			SNAPPING_POINTS__PROP));

	private static java.util.Set<String> TRANSIENT_PROPERTIES = java.util.Collections.unmodifiableSet(new java.util.HashSet<>(
			java.util.Arrays.asList(
				USER_DATA__PROP)));

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
			case USER_DATA__PROP: return getUserData();
			case LAYOUT_POINT__PROP: return getLayoutPoint();
			case SNAPPING_POINTS__PROP: return getSnappingPoints();
			default: return super.get(field);
		}
	}

	@Override
	public void set(String field, Object value) {
		switch (field) {
			case USER_DATA__PROP: internalSetUserData((java.lang.Object) value); break;
			case LAYOUT_POINT__PROP: internalSetLayoutPoint((com.top_logic.threed.threejs.scene.ConnectionPoint) value); break;
			case SNAPPING_POINTS__PROP: internalSetSnappingPoints(de.haumacher.msgbuf.util.Conversions.asList(com.top_logic.threed.threejs.scene.ConnectionPoint.class, value)); break;
			default: super.set(field, value); break;
		}
	}

	/** Reads a new instance from the given reader. */
	public static com.top_logic.threed.threejs.scene.SceneNode readSceneNode(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in) throws java.io.IOException {
		if (in.peek() == de.haumacher.msgbuf.json.JsonToken.NUMBER) {
			return (com.top_logic.threed.threejs.scene.SceneNode) scope.resolveOrFail(in.nextInt());
		}
		com.top_logic.threed.threejs.scene.SceneNode result;
		in.beginArray();
		String type = in.nextString();
		int id = in.nextInt();
		switch (type) {
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
		if (hasLayoutPoint()) {
			out.name(LAYOUT_POINT__PROP);
			getLayoutPoint().writeTo(scope, out);
		}
		out.name(SNAPPING_POINTS__PROP);
		out.beginArray();
		for (com.top_logic.threed.threejs.scene.ConnectionPoint x : getSnappingPoints()) {
			x.writeTo(scope, out);
		}
		out.endArray();
	}

	@Override
	public void writeFieldValue(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out, String field) throws java.io.IOException {
		switch (field) {
			case USER_DATA__PROP: {
				if (hasUserData()) {
				} else {
					out.nullValue();
				}
				break;
			}
			case LAYOUT_POINT__PROP: {
				if (hasLayoutPoint()) {
					getLayoutPoint().writeTo(scope, out);
				} else {
					out.nullValue();
				}
				break;
			}
			case SNAPPING_POINTS__PROP: {
				out.beginArray();
				for (com.top_logic.threed.threejs.scene.ConnectionPoint x : getSnappingPoints()) {
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
			case LAYOUT_POINT__PROP: setLayoutPoint(com.top_logic.threed.threejs.scene.ConnectionPoint.readConnectionPoint(scope, in)); break;
			case SNAPPING_POINTS__PROP: {
				java.util.List<com.top_logic.threed.threejs.scene.ConnectionPoint> newValue = new java.util.ArrayList<>();
				in.beginArray();
				while (in.hasNext()) {
					newValue.add(com.top_logic.threed.threejs.scene.ConnectionPoint.readConnectionPoint(scope, in));
				}
				in.endArray();
				setSnappingPoints(newValue);
			}
			break;
			default: super.readField(scope, in, field);
		}
	}

	@Override
	public void writeElement(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out, String field, Object element) throws java.io.IOException {
		switch (field) {
			case SNAPPING_POINTS__PROP: {
				((com.top_logic.threed.threejs.scene.ConnectionPoint) element).writeTo(scope, out);
				break;
			}
			default: super.writeElement(scope, out, field, element);
		}
	}

	@Override
	public Object readElement(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in, String field) throws java.io.IOException {
		switch (field) {
			case SNAPPING_POINTS__PROP: {
				return com.top_logic.threed.threejs.scene.ConnectionPoint.readConnectionPoint(scope, in);
			}
			default: return super.readElement(scope, in, field);
		}
	}

	/** Accepts the given visitor. */
	public abstract <R,A,E extends Throwable> R visit(Visitor<R,A,E> v, A arg) throws E;

	@Override
	public final <R,A,E extends Throwable> R visit(com.top_logic.threed.threejs.scene.ScenePart.Visitor<R,A,E> v, A arg) throws E {
		return visit((com.top_logic.threed.threejs.scene.SceneNode.Visitor<R,A,E>) v, arg);
	}

}
