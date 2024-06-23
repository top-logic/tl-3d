package com.top_logic.threed.threejs.control.cmds;

public enum SelectionChange implements de.haumacher.msgbuf.data.ProtocolEnum {

	ADD("ADD"),

	REMOVE("REMOVE"),

	;

	private final String _protocolName;

	private SelectionChange(String protocolName) {
		_protocolName = protocolName;
	}

	/**
	 * The protocol name of a {@link SelectionChange} constant.
	 *
	 * @see #valueOfProtocol(String)
	 */
	@Override
	public String protocolName() {
		return _protocolName;
	}

	/** Looks up a {@link SelectionChange} constant by it's protocol name. */
	public static SelectionChange valueOfProtocol(String protocolName) {
		if (protocolName == null) { return null; }
		switch (protocolName) {
			case "ADD": return ADD;
			case "REMOVE": return REMOVE;
		}
		return ADD;
	}

	/** Writes this instance to the given output. */
	public final void writeTo(de.haumacher.msgbuf.json.JsonWriter out) throws java.io.IOException {
		out.value(protocolName());
	}

	/** Reads a new instance from the given reader. */
	public static SelectionChange readSelectionChange(de.haumacher.msgbuf.json.JsonReader in) throws java.io.IOException {
		return valueOfProtocol(in.nextString());
	}

	/** Writes this instance to the given binary output. */
	public final void writeTo(de.haumacher.msgbuf.binary.DataWriter out) throws java.io.IOException {
		switch (this) {
			case ADD: out.value(1); break;
			case REMOVE: out.value(2); break;
			default: out.value(0);
		}
	}

	/** Reads a new instance from the given binary reader. */
	public static SelectionChange readSelectionChange(de.haumacher.msgbuf.binary.DataReader in) throws java.io.IOException {
		switch (in.nextInt()) {
			case 1: return ADD;
			case 2: return REMOVE;
			default: return ADD;
		}
	}
}
