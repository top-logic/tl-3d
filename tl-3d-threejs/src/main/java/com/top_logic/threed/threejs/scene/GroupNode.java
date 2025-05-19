package com.top_logic.threed.threejs.scene;

/**
 * A collection of {@link SceneNode}s.
 */
public class GroupNode extends SceneNode {

	/**
	 * Creates a {@link com.top_logic.threed.threejs.scene.GroupNode} instance.
	 */
	public static com.top_logic.threed.threejs.scene.GroupNode create() {
		return new com.top_logic.threed.threejs.scene.GroupNode();
	}

	/** Identifier for the {@link com.top_logic.threed.threejs.scene.GroupNode} type in JSON format. */
	public static final String GROUP_NODE__TYPE = "GroupNode";

	/** @see #getContents() */
	public static final String CONTENTS__PROP = "contents";

	private final java.util.List<com.top_logic.threed.threejs.scene.SceneNode> _contents = new de.haumacher.msgbuf.util.ReferenceList<com.top_logic.threed.threejs.scene.SceneNode>() {
		@Override
		protected void beforeAdd(int index, com.top_logic.threed.threejs.scene.SceneNode element) {
			com.top_logic.threed.threejs.scene.SceneNode added = element;
			com.top_logic.threed.threejs.scene.ScenePart oldContainer = added.getParent();
			if (oldContainer != null && oldContainer != GroupNode.this) {
				throw new IllegalStateException("Object may not be part of two different containers.");
			}
			_listener.beforeAdd(GroupNode.this, CONTENTS__PROP, index, element);
			added.internalSetParent(GroupNode.this);
		}

		@Override
		protected void afterRemove(int index, com.top_logic.threed.threejs.scene.SceneNode element) {
			com.top_logic.threed.threejs.scene.SceneNode removed = element;
			removed.internalSetParent(null);
			_listener.afterRemove(GroupNode.this, CONTENTS__PROP, index, element);
		}

		@Override
		protected void afterChanged() {
			_listener.afterChanged(GroupNode.this, CONTENTS__PROP);
		}
	};

	/**
	 * Creates a {@link GroupNode} instance.
	 *
	 * @see com.top_logic.threed.threejs.scene.GroupNode#create()
	 */
	protected GroupNode() {
		super();
	}

	@Override
	public TypeKind kind() {
		return TypeKind.GROUP_NODE;
	}

	/**
	 * The {@link SceneNode}s grouped together.
	 */
	public final java.util.List<com.top_logic.threed.threejs.scene.SceneNode> getContents() {
		return _contents;
	}

	/**
	 * @see #getContents()
	 */
	public com.top_logic.threed.threejs.scene.GroupNode setContents(java.util.List<? extends com.top_logic.threed.threejs.scene.SceneNode> value) {
		internalSetContents(value);
		return this;
	}

	/** Internal setter for {@link #getContents()} without chain call utility. */
	protected final void internalSetContents(java.util.List<? extends com.top_logic.threed.threejs.scene.SceneNode> value) {
		if (value == null) throw new IllegalArgumentException("Property 'contents' cannot be null.");
		_contents.clear();
		_contents.addAll(value);
	}

	/**
	 * Adds a value to the {@link #getContents()} list.
	 */
	public com.top_logic.threed.threejs.scene.GroupNode addContent(com.top_logic.threed.threejs.scene.SceneNode value) {
		internalAddContent(value);
		return this;
	}

	/** Implementation of {@link #addContent(com.top_logic.threed.threejs.scene.SceneNode)} without chain call utility. */
	protected final void internalAddContent(com.top_logic.threed.threejs.scene.SceneNode value) {
		_contents.add(value);
	}

	/**
	 * Removes a value from the {@link #getContents()} list.
	 */
	public final void removeContent(com.top_logic.threed.threejs.scene.SceneNode value) {
		_contents.remove(value);
	}

	@Override
	public com.top_logic.threed.threejs.scene.GroupNode setUserData(java.lang.Object value) {
		internalSetUserData(value);
		return this;
	}

	@Override
	public com.top_logic.threed.threejs.scene.GroupNode setTransform(java.util.List<? extends Double> value) {
		internalSetTransform(value);
		return this;
	}

	@Override
	public com.top_logic.threed.threejs.scene.GroupNode addTransform(double value) {
		internalAddTransform(value);
		return this;
	}

	@Override
	public com.top_logic.threed.threejs.scene.GroupNode setHidden(boolean value) {
		internalSetHidden(value);
		return this;
	}

	@Override
	public com.top_logic.threed.threejs.scene.GroupNode setColor(String value) {
		internalSetColor(value);
		return this;
	}

	@Override
	public String jsonType() {
		return GROUP_NODE__TYPE;
	}

	private static java.util.List<String> PROPERTIES = java.util.Collections.unmodifiableList(
		java.util.Arrays.asList(
			CONTENTS__PROP));

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
			case CONTENTS__PROP: return getContents();
			default: return super.get(field);
		}
	}

	@Override
	public void set(String field, Object value) {
		switch (field) {
			case CONTENTS__PROP: internalSetContents(de.haumacher.msgbuf.util.Conversions.asList(com.top_logic.threed.threejs.scene.SceneNode.class, value)); break;
			default: super.set(field, value); break;
		}
	}

	/** Reads a new instance from the given reader. */
	public static com.top_logic.threed.threejs.scene.GroupNode readGroupNode(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in) throws java.io.IOException {
		if (in.peek() == de.haumacher.msgbuf.json.JsonToken.NUMBER) {
			return (com.top_logic.threed.threejs.scene.GroupNode) scope.resolveOrFail(in.nextInt());
		}
		in.beginArray();
		String type = in.nextString();
		assert GROUP_NODE__TYPE.equals(type);
		int id = in.nextInt();
		com.top_logic.threed.threejs.scene.GroupNode result = new com.top_logic.threed.threejs.scene.GroupNode();
		scope.readData(result, id, in);
		in.endArray();
		return result;
	}

	@Override
	protected void writeFields(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out) throws java.io.IOException {
		super.writeFields(scope, out);
		out.name(CONTENTS__PROP);
		out.beginArray();
		for (com.top_logic.threed.threejs.scene.SceneNode x : getContents()) {
			x.writeTo(scope, out);
		}
		out.endArray();
	}

	@Override
	public void writeFieldValue(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out, String field) throws java.io.IOException {
		switch (field) {
			case CONTENTS__PROP: {
				out.beginArray();
				for (com.top_logic.threed.threejs.scene.SceneNode x : getContents()) {
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
			case CONTENTS__PROP: {
				java.util.List<com.top_logic.threed.threejs.scene.SceneNode> newValue = new java.util.ArrayList<>();
				in.beginArray();
				while (in.hasNext()) {
					newValue.add(com.top_logic.threed.threejs.scene.SceneNode.readSceneNode(scope, in));
				}
				in.endArray();
				setContents(newValue);
			}
			break;
			default: super.readField(scope, in, field);
		}
	}

	@Override
	public void writeElement(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out, String field, Object element) throws java.io.IOException {
		switch (field) {
			case CONTENTS__PROP: {
				((com.top_logic.threed.threejs.scene.SceneNode) element).writeTo(scope, out);
				break;
			}
			default: super.writeElement(scope, out, field, element);
		}
	}

	@Override
	public Object readElement(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in, String field) throws java.io.IOException {
		switch (field) {
			case CONTENTS__PROP: {
				return com.top_logic.threed.threejs.scene.SceneNode.readSceneNode(scope, in);
			}
			default: return super.readElement(scope, in, field);
		}
	}

	@Override
	public <R,A,E extends Throwable> R visit(com.top_logic.threed.threejs.scene.SceneNode.Visitor<R,A,E> v, A arg) throws E {
		return v.visit(this, arg);
	}

}
