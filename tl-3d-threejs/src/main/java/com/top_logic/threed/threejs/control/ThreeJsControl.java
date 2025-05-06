/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.control;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.HashMap;
import java.util.Map;

import com.top_logic.base.services.simpleajax.JSFunctionCall;
import com.top_logic.basic.util.ResKey;
import com.top_logic.basic.xml.TagWriter;
import com.top_logic.layout.ContentHandler;
import com.top_logic.layout.Control;
import com.top_logic.layout.DisplayContext;
import com.top_logic.layout.URLParser;
import com.top_logic.layout.UpdateQueue;
import com.top_logic.layout.basic.AbstractControl;
import com.top_logic.layout.basic.ControlCommand;
import com.top_logic.mig.html.HTMLUtil;
import com.top_logic.threed.threejs.scene.SceneGraph;
import com.top_logic.tool.boundsec.HandlerResult;

import de.haumacher.msgbuf.graph.DefaultScope;
import de.haumacher.msgbuf.graph.SharedGraphNode;
import de.haumacher.msgbuf.io.StringR;
import de.haumacher.msgbuf.io.StringW;
import de.haumacher.msgbuf.io.Writer;
import de.haumacher.msgbuf.json.JsonReader;
import de.haumacher.msgbuf.json.JsonWriter;
import de.haumacher.msgbuf.server.io.WriterAdapter;
import jakarta.servlet.http.HttpServletResponse;

/**
 * {@link Control} displaying a 3D scene using <code>three.js</code>.
 */
public class ThreeJsControl extends AbstractControl implements ContentHandler {

	private static final String THREEJS_JS_NS = "window.services.threejs";

	private static final Map<String, ControlCommand> COMMANDS = createCommandMap(ApplySceneChange.INSTANCE);

	private SceneGraph _model;

	private final ExternalScope _scope;

	private boolean _isWorkplaneVisible;

	private boolean _isInEditMode;

	private boolean _isRotateMode;

	/**
	 * Creates a {@link ThreeJsControl}.
	 */
	public ThreeJsControl(SceneGraph model) {
		super(COMMANDS);
		_model = model;
		_scope = new ExternalScope(2, 0);
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
	protected String getTypeCssClass() {
		return "cThreeJs";
	}

	/**
	 * Sends the command to the client to zoom to the current selection.
	 */
	public void zoomToSelection() {
		addUpdate(new JSFunctionCall(getID(), THREEJS_JS_NS, "zoomToSelection"));
	}

	public void zoomOutFromSelection() {
    	addUpdate(new JSFunctionCall(getID(), THREEJS_JS_NS, "zoomOutFromSelection"));
	}

	public boolean getIsWorkplaneVisible() {
		return _isWorkplaneVisible;
	}

	public void setIsWorkplaneVisible(boolean visible) {
		_isWorkplaneVisible = visible;
		
		addUpdate(new JSFunctionCall(getID(), THREEJS_JS_NS, "toggleWorkplane", visible));
	}

	public boolean getIsInEditMode() {
		return _isInEditMode;
	}

	public void setIsInEditMode(boolean value) {
		_isInEditMode = value;
		
		addUpdate(new JSFunctionCall(getID(), THREEJS_JS_NS, "toggleEditMode", value));
	}

	public boolean getIsRotateMode() {
		return _isRotateMode;
	}

	public void setIsRotateMode(boolean value) {
		_isRotateMode = value;

		addUpdate(new JSFunctionCall(getID(), THREEJS_JS_NS, "toggleRotateMode", value));
	}

	@Override
	protected void internalAttach() {
		super.internalAttach();

		getFrameScope().registerContentHandler(getID(), this);
	}

	@Override
	protected void internalDetach() {
		getFrameScope().deregisterContentHandler(this);

		super.internalDetach();
	}

	@Override
	protected boolean hasUpdates() {
		return super.hasUpdates() || _scope.hasChanges();
	}

	@Override
	protected void internalRevalidate(DisplayContext context, UpdateQueue actions) {
		super.internalRevalidate(context, actions);

		if (_scope.hasChanges()) {
			Writer out = new StringW();
			try {
				_scope.createPatch(new JsonWriter(out));
			} catch (IOException ex) {
				throw new UncheckedIOException(ex);
			}
			actions.add(new JSFunctionCall(getID(), THREEJS_JS_NS, "sceneChanged", out.toString()));
		}

	}

	@Override
	protected void internalWrite(DisplayContext context, TagWriter out) throws IOException {
		out.beginBeginTag(DIV);
		writeControlAttributes(context, out);
		out.endBeginTag();
		
		String dataUrl =
			getFrameScope().getURL(context, this).appendParameter("t", Long.toString(System.nanoTime())).getURL();

		HTMLUtil.beginScriptAfterRendering(out);
		out.append(THREEJS_JS_NS);
		out.append(".init('" + getID() + "', '" + 
			context.getContextPath() + "', '" + 
			dataUrl + "', " +
			_isWorkplaneVisible + ", " + 
			_isInEditMode + ", " +
			_isRotateMode +
			")"
		);
		HTMLUtil.endScriptAfterRendering(out);

		out.endTag(DIV);
	}

	@Override
	public void handleContent(DisplayContext context, String id, URLParser url) throws IOException {
		HttpServletResponse response = context.asResponse();
		response.setContentType("application/json");
		response.setCharacterEncoding("utf-8");

		_scope.clear();
		_scope.writeRefOrData(new JsonWriter(new WriterAdapter(response.getWriter())), _model);
	}

	/**
	 * Adjusts the {@link SceneGraph} based on a client-side change.
	 */
	public static class ApplySceneChange extends ControlCommand {

		private static final String JSON_ARG = "json";

		/**
		 * Singleton {@link ApplySceneChange} instance.
		 */
		public static final ApplySceneChange INSTANCE = new ApplySceneChange();

		private ApplySceneChange() {
			super("sceneChanged");
		}

		@Override
		public ResKey getI18NKey() {
			return I18NConstants.APPLY_SCENE_CHANGES;
		}

		@Override
		protected HandlerResult execute(DisplayContext commandContext, Control control, Map<String, Object> arguments) {
			ThreeJsControl self = (ThreeJsControl) control;

			String change = (String) arguments.get(JSON_ARG);
			self.applyChange(change);
			return HandlerResult.DEFAULT_RESULT;
		}

	}

	/**
	 * Applies commands from the UI.
	 */
	void applyChange(String changes) {
		if (_scope.hasChanges()) {
			throw new IllegalStateException("Scope has changes which were not delivered to the client.");
		}
		try {
			_scope.applyChanges(new JsonReader(new StringR(changes)));
		} catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
		_scope.dropChanges();
	}

}

class ExternalScope extends DefaultScope {

	Map<SharedGraphNode, Integer> _objectIds = new HashMap<>();

	/**
	 * Creates a {@link ExternalScope}.
	 */
	public ExternalScope(int totalParticipants, int participantId) {
		super(totalParticipants, participantId);
	}

	public void clear() {
		_objectIds.clear();
		index().clear();

		dropChanges();
	}

	@Override
	public int id(SharedGraphNode node) {
		Integer id = _objectIds.get(node);
		return id == null ? 0 : id.intValue();
	}

	@Override
	public void initId(SharedGraphNode node, int id) {
		_objectIds.put(node, Integer.valueOf(id));
	}

}