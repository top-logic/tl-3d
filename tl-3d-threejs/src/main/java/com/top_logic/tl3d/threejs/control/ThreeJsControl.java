/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.threejs.control;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import javax.servlet.http.HttpServletResponse;

import com.top_logic.basic.xml.TagWriter;
import com.top_logic.layout.ContentHandler;
import com.top_logic.layout.Control;
import com.top_logic.layout.DisplayContext;
import com.top_logic.layout.URLParser;
import com.top_logic.layout.UpdateQueue;
import com.top_logic.layout.basic.AbstractControlBase;
import com.top_logic.mig.html.HTMLUtil;
import com.top_logic.tl3d.threejs.scene.SceneGraph;

import de.haumacher.msgbuf.graph.Scope;
import de.haumacher.msgbuf.graph.SharedGraphNode;
import de.haumacher.msgbuf.json.JsonReader;
import de.haumacher.msgbuf.json.JsonWriter;
import de.haumacher.msgbuf.observer.Listener;
import de.haumacher.msgbuf.observer.Observable;
import de.haumacher.msgbuf.server.io.WriterAdapter;

/**
 * {@link Control} displaying a 3D scene using <code>three.js</code>.
 */
public class ThreeJsControl extends AbstractControlBase implements ContentHandler, Listener {

	private SceneGraph _model;

	/**
	 * Creates a {@link ThreeJsControl}.
	 */
	public ThreeJsControl(SceneGraph model) {
		_model = model;
	}

	@Override
	public Object getModel() {
		return null;
	}

	@Override
	public boolean isVisible() {
		return true;
	}

	@Override
	protected boolean hasUpdates() {
		return false;
	}

	@Override
	protected void internalAttach() {
		super.internalAttach();

		_model.registerListener(this);

		getFrameScope().registerContentHandler(getID(), this);
	}

	@Override
	protected void internalDetach() {
		getFrameScope().deregisterContentHandler(this);

		_model.unregisterListener(this);

		super.internalDetach();
	}

	@Override
	public void beforeSet(Observable obj, String property, Object value) {
		requestRepaint();
	}

	@Override
	protected void internalRevalidate(DisplayContext context, UpdateQueue actions) {
		// Nothing yet.
	}

	@Override
	protected void internalWrite(DisplayContext context, TagWriter out) throws IOException {
		out.beginBeginTag(DIV);
		out.writeAttribute(ID_ATTR, getID());
		out.writeAttribute(STYLE_ATTR, "position: absolute; width: 100%; height: 100%; background-color: skyblue;");
		out.endBeginTag();
		
		String dataUrl =
			getFrameScope().getURL(context, this).appendParameter("t", Long.toString(System.nanoTime())).getURL();

		HTMLUtil.beginScriptAfterRendering(out);
		out.append("window.services.threejs.init('" + getID() + "', '" + context.getContextPath() + "', '" + dataUrl + "')");
		HTMLUtil.endScriptAfterRendering(out);

		out.endTag(DIV);
	}

	@Override
	public void handleContent(DisplayContext context, String id, URLParser url) throws IOException {
		HttpServletResponse response = context.asResponse();
		response.setContentType("application/json");
		response.setCharacterEncoding("utf-8");

		// Only full updates until the client has a GWT implementation.
		Scope scope = new DummyScope();
		scope.writeRefOrData(new JsonWriter(new WriterAdapter(response.getWriter())), _model);
	}

}

class DummyScope implements Scope {

	private int _nextId = 1;

	private Map<Object, Integer> _ids = new HashMap<>();

	@Override
	public SharedGraphNode resolveOrFail(int id) {
		throw new UnsupportedOperationException();
	}

	@Override
	public void readData(SharedGraphNode node, int id, JsonReader in) {
		throw new UnsupportedOperationException();
	}

	@Override
	public void writeRefOrData(JsonWriter out, SharedGraphNode node) throws IOException {
		Integer id = _ids.get(node);
		if (id == null) {
			id = Integer.valueOf(_nextId++);
			_ids.put(node, id);
			node.writeData(this, out, id.intValue());
		} else {
			out.value(id.intValue());
		}
	}

}
