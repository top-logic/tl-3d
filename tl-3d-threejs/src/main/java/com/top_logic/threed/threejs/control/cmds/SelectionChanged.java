package com.top_logic.tl3d.threejs.control.cmds;

public class SelectionChanged extends de.haumacher.msgbuf.data.AbstractDataObject implements de.haumacher.msgbuf.observer.Observable {

	/**
	 * Creates a {@link com.top_logic.tl3d.threejs.control.cmds.SelectionChanged} instance.
	 */
	public static com.top_logic.tl3d.threejs.control.cmds.SelectionChanged create() {
		return new com.top_logic.tl3d.threejs.control.cmds.SelectionChanged();
	}

	/** Identifier for the {@link com.top_logic.tl3d.threejs.control.cmds.SelectionChanged} type in JSON format. */
	public static final String SELECTION_CHANGED__TYPE = "SelectionChanged";

	/** @see #getChanged() */
	public static final String CHANGED__PROP = "changed";

	private final java.util.Map<Integer, com.top_logic.tl3d.threejs.control.cmds.SelectionChange> _changed = new de.haumacher.msgbuf.util.ReferenceMap<>() {
		@Override
		protected void beforeAdd(Integer index, com.top_logic.tl3d.threejs.control.cmds.SelectionChange element) {
			_listener.beforeAdd(SelectionChanged.this, CHANGED__PROP, index, element);
		}

		@Override
		protected void afterRemove(Integer index, com.top_logic.tl3d.threejs.control.cmds.SelectionChange element) {
			_listener.afterRemove(SelectionChanged.this, CHANGED__PROP, index, element);
		}
	};

	/**
	 * Creates a {@link SelectionChanged} instance.
	 *
	 * @see com.top_logic.tl3d.threejs.control.cmds.SelectionChanged#create()
	 */
	protected SelectionChanged() {
		super();
	}

	public final java.util.Map<Integer, com.top_logic.tl3d.threejs.control.cmds.SelectionChange> getChanged() {
		return _changed;
	}

	/**
	 * @see #getChanged()
	 */
	public com.top_logic.tl3d.threejs.control.cmds.SelectionChanged setChanged(java.util.Map<Integer, com.top_logic.tl3d.threejs.control.cmds.SelectionChange> value) {
		internalSetChanged(value);
		return this;
	}

	/** Internal setter for {@link #getChanged()} without chain call utility. */
	protected final void internalSetChanged(java.util.Map<Integer, com.top_logic.tl3d.threejs.control.cmds.SelectionChange> value) {
		if (value == null) throw new IllegalArgumentException("Property 'changed' cannot be null.");
		_changed.clear();
		_changed.putAll(value);
	}

	/**
	 * Adds a key value pair to the {@link #getChanged()} map.
	 */
	public com.top_logic.tl3d.threejs.control.cmds.SelectionChanged putChanged(int key, com.top_logic.tl3d.threejs.control.cmds.SelectionChange value) {
		internalPutChanged(key, value);
		return this;
	}

	/** Implementation of {@link #putChanged(int, com.top_logic.tl3d.threejs.control.cmds.SelectionChange)} without chain call utility. */
	protected final void  internalPutChanged(int key, com.top_logic.tl3d.threejs.control.cmds.SelectionChange value) {
		if (_changed.containsKey(key)) {
			throw new IllegalArgumentException("Property 'changed' already contains a value for key '" + key + "'.");
		}
		_changed.put(key, value);
	}

	/**
	 * Removes a key from the {@link #getChanged()} map.
	 */
	public final void removeChanged(int key) {
		_changed.remove(key);
	}

	protected de.haumacher.msgbuf.observer.Listener _listener = de.haumacher.msgbuf.observer.Listener.NONE;

	@Override
	public com.top_logic.tl3d.threejs.control.cmds.SelectionChanged registerListener(de.haumacher.msgbuf.observer.Listener l) {
		internalRegisterListener(l);
		return this;
	}

	protected final void internalRegisterListener(de.haumacher.msgbuf.observer.Listener l) {
		_listener = de.haumacher.msgbuf.observer.Listener.register(_listener, l);
	}

	@Override
	public com.top_logic.tl3d.threejs.control.cmds.SelectionChanged unregisterListener(de.haumacher.msgbuf.observer.Listener l) {
		internalUnregisterListener(l);
		return this;
	}

	protected final void internalUnregisterListener(de.haumacher.msgbuf.observer.Listener l) {
		_listener = de.haumacher.msgbuf.observer.Listener.unregister(_listener, l);
	}

	@Override
	public String jsonType() {
		return SELECTION_CHANGED__TYPE;
	}

	private static java.util.List<String> PROPERTIES = java.util.Collections.unmodifiableList(
		java.util.Arrays.asList(
			CHANGED__PROP));

	@Override
	public java.util.List<String> properties() {
		return PROPERTIES;
	}

	@Override
	public Object get(String field) {
		switch (field) {
			case CHANGED__PROP: return getChanged();
			default: return null;
		}
	}

	@Override
	public void set(String field, Object value) {
		switch (field) {
			case CHANGED__PROP: internalSetChanged((java.util.Map<Integer, com.top_logic.tl3d.threejs.control.cmds.SelectionChange>) value); break;
		}
	}

	/** Reads a new instance from the given reader. */
	public static com.top_logic.tl3d.threejs.control.cmds.SelectionChanged readSelectionChanged(de.haumacher.msgbuf.json.JsonReader in) throws java.io.IOException {
		com.top_logic.tl3d.threejs.control.cmds.SelectionChanged result = new com.top_logic.tl3d.threejs.control.cmds.SelectionChanged();
		result.readContent(in);
		return result;
	}

	@Override
	public final void writeTo(de.haumacher.msgbuf.json.JsonWriter out) throws java.io.IOException {
		writeContent(out);
	}

	@Override
	protected void writeFields(de.haumacher.msgbuf.json.JsonWriter out) throws java.io.IOException {
		super.writeFields(out);
		out.name(CHANGED__PROP);
		out.beginArray();
		for (java.util.Map.Entry<Integer,com.top_logic.tl3d.threejs.control.cmds.SelectionChange> entry : getChanged().entrySet()) {
			out.beginObject();
			out.name("key");
			out.value(entry.getKey());
			out.name("value");
			entry.getValue().writeTo(out);
			out.endObject();
		}
		out.endArray();
	}

	@Override
	protected void readField(de.haumacher.msgbuf.json.JsonReader in, String field) throws java.io.IOException {
		switch (field) {
			case CHANGED__PROP: {
				in.beginArray();
				while (in.hasNext()) {
					in.beginObject();
					int key = 0;
					com.top_logic.tl3d.threejs.control.cmds.SelectionChange value = com.top_logic.tl3d.threejs.control.cmds.SelectionChange.ADD;
					while (in.hasNext()) {
						switch (in.nextName()) {
							case "key": key = in.nextInt(); break;
							case "value": value = com.top_logic.tl3d.threejs.control.cmds.SelectionChange.readSelectionChange(in); break;
							default: in.skipValue(); break;
						}
					}
					putChanged(key, value);
					in.endObject();
				}
				in.endArray();
				break;
			}
			default: super.readField(in, field);
		}
	}

}
