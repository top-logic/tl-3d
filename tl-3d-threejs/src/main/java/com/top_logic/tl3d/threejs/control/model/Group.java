package com.top_logic.tl3d.threejs.control.model;

public class Group extends Node {

	/**
	 * Creates a {@link com.top_logic.tl3d.threejs.control.model.Group} instance.
	 */
	public static com.top_logic.tl3d.threejs.control.model.Group create() {
		return new com.top_logic.tl3d.threejs.control.model.Group();
	}

	/** Identifier for the {@link com.top_logic.tl3d.threejs.control.model.Group} type in JSON format. */
	public static final String GROUP__TYPE = "Group";

	/** @see #getContents() */
	public static final String CONTENTS__PROP = "contents";

	private final java.util.List<com.top_logic.tl3d.threejs.control.model.Node> _contents = new de.haumacher.msgbuf.util.ReferenceList<>() {
		@Override
		protected void beforeAdd(int index, com.top_logic.tl3d.threejs.control.model.Node element) {
			_listener.beforeAdd(Group.this, CONTENTS__PROP, index, element);
		}

		@Override
		protected void afterRemove(int index, com.top_logic.tl3d.threejs.control.model.Node element) {
			_listener.afterRemove(Group.this, CONTENTS__PROP, index, element);
		}
	};

	/**
	 * Creates a {@link Group} instance.
	 *
	 * @see com.top_logic.tl3d.threejs.control.model.Group#create()
	 */
	protected Group() {
		super();
	}

	@Override
	public TypeKind kind() {
		return TypeKind.GROUP;
	}

	public final java.util.List<com.top_logic.tl3d.threejs.control.model.Node> getContents() {
		return _contents;
	}

	/**
	 * @see #getContents()
	 */
	public com.top_logic.tl3d.threejs.control.model.Group setContents(java.util.List<? extends com.top_logic.tl3d.threejs.control.model.Node> value) {
		internalSetContents(value);
		return this;
	}

	/** Internal setter for {@link #getContents()} without chain call utility. */
	protected final void internalSetContents(java.util.List<? extends com.top_logic.tl3d.threejs.control.model.Node> value) {
		if (value == null) throw new IllegalArgumentException("Property 'contents' cannot be null.");
		_contents.clear();
		_contents.addAll(value);
	}

	/**
	 * Adds a value to the {@link #getContents()} list.
	 */
	public com.top_logic.tl3d.threejs.control.model.Group addContent(com.top_logic.tl3d.threejs.control.model.Node value) {
		internalAddContent(value);
		return this;
	}

	/** Implementation of {@link #addContent(com.top_logic.tl3d.threejs.control.model.Node)} without chain call utility. */
	protected final void internalAddContent(com.top_logic.tl3d.threejs.control.model.Node value) {
		_contents.add(value);
	}

	/**
	 * Removes a value from the {@link #getContents()} list.
	 */
	public final void removeContent(com.top_logic.tl3d.threejs.control.model.Node value) {
		_contents.remove(value);
	}

	@Override
	public com.top_logic.tl3d.threejs.control.model.Group setTransform(java.util.List<? extends Float> value) {
		internalSetTransform(value);
		return this;
	}

	@Override
	public com.top_logic.tl3d.threejs.control.model.Group addTransform(float value) {
		internalAddTransform(value);
		return this;
	}

	@Override
	public String jsonType() {
		return GROUP__TYPE;
	}

	private static java.util.List<String> PROPERTIES = java.util.Collections.unmodifiableList(
		java.util.Arrays.asList(
			CONTENTS__PROP));

	@Override
	public java.util.List<String> properties() {
		return PROPERTIES;
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
			case CONTENTS__PROP: internalSetContents(de.haumacher.msgbuf.util.Conversions.asList(com.top_logic.tl3d.threejs.control.model.Node.class, value)); break;
			default: super.set(field, value); break;
		}
	}

	/** Reads a new instance from the given reader. */
	public static com.top_logic.tl3d.threejs.control.model.Group readGroup(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in) throws java.io.IOException {
		if (in.peek() == de.haumacher.msgbuf.json.JsonToken.NUMBER) {
			return (com.top_logic.tl3d.threejs.control.model.Group) scope.resolveOrFail(in.nextInt());
		}
		in.beginArray();
		String type = in.nextString();
		assert GROUP__TYPE.equals(type);
		int id = in.nextInt();
		com.top_logic.tl3d.threejs.control.model.Group result = new com.top_logic.tl3d.threejs.control.model.Group();
		scope.readData(result, id, in);
		in.endArray();
		return result;
	}

	@Override
	protected void writeFields(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out) throws java.io.IOException {
		super.writeFields(scope, out);
		out.name(CONTENTS__PROP);
		out.beginArray();
		for (com.top_logic.tl3d.threejs.control.model.Node x : getContents()) {
			x.writeTo(scope, out);
		}
		out.endArray();
	}

	@Override
	public void writeFieldValue(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonWriter out, String field) throws java.io.IOException {
		switch (field) {
			case CONTENTS__PROP: {
				out.beginArray();
				for (com.top_logic.tl3d.threejs.control.model.Node x : getContents()) {
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
				in.beginArray();
				while (in.hasNext()) {
					addContent(com.top_logic.tl3d.threejs.control.model.Node.readNode(scope, in));
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
			case CONTENTS__PROP: {
				((com.top_logic.tl3d.threejs.control.model.Node) element).writeTo(scope, out);
				break;
			}
			default: super.writeElement(scope, out, field, element);
		}
	}

	@Override
	public Object readElement(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in, String field) throws java.io.IOException {
		switch (field) {
			case CONTENTS__PROP: {
				return com.top_logic.tl3d.threejs.control.model.Node.readNode(scope, in);
			}
			default: return super.readElement(scope, in, field);
		}
	}

	@Override
	public <R,A,E extends Throwable> R visit(com.top_logic.tl3d.threejs.control.model.Node.Visitor<R,A,E> v, A arg) throws E {
		return v.visit(this, arg);
	}

}
