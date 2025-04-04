/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.control;

import java.io.IOException;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

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
import com.top_logic.layout.component.model.SelectionListener;
import com.top_logic.mig.html.HTMLUtil;
import com.top_logic.mig.html.SelectionModel;
import com.top_logic.threed.threejs.control.cmds.SelectionChange;
import com.top_logic.threed.threejs.control.cmds.SelectionChanged;
import com.top_logic.threed.threejs.scene.SceneGraph;
import com.top_logic.tool.boundsec.HandlerResult;

import de.haumacher.msgbuf.graph.DefaultScope;
import de.haumacher.msgbuf.graph.SharedGraphNode;
import de.haumacher.msgbuf.json.JsonWriter;
import de.haumacher.msgbuf.observer.Listener;
import de.haumacher.msgbuf.observer.Observable;
import de.haumacher.msgbuf.server.io.WriterAdapter;
import jakarta.servlet.http.HttpServletResponse;

/**
 * {@link Control} displaying a 3D scene using <code>three.js</code>.
 */
public class ThreeJsControl extends AbstractControl implements ContentHandler, Listener, SelectionListener {

	private static final Map<String, ControlCommand> COMMANDS = createCommandMap(UpdateSelection.INSTANCE);

	private SceneGraph _model;

	private final ExternalScope _scope;

	private final SelectionModel _selection;

	private boolean _isWorkplaneVisible;

	private boolean _isInEditMode;

	private boolean _isRotateMode;

	/**
	 * Whether {@link #_selection} is currently updated with new values from the UI. During that
	 * period, events from the {@link #_selection} are ignored.
	 */
	private boolean _selectionUpdating;

	private SelectionChanged _selectionUpdate;

	/**
	 * Creates a {@link ThreeJsControl}.
	 */
	public ThreeJsControl(SceneGraph model, SelectionModel selection) {
		super(COMMANDS);
		_model = model;
		_selection = selection;
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

	/**
	 * Sends the command to the client to zoom to the current selection.
	 */
	public void zoomToSelection() {
		addUpdate(new JSFunctionCall(getID(), "window.services.threejs", "zoomToSelection"));
	}

	public void zoomOutFromSelection() {
    	addUpdate(new JSFunctionCall(getID(), "window.services.threejs", "zoomOutFromSelection"));
	}

	public boolean getIsWorkplaneVisible() {
		return _isWorkplaneVisible;
	}

	public void setIsWorkplaneVisible(boolean visible) {
		_isWorkplaneVisible = visible;
		
		addUpdate(new JSFunctionCall(getID(), "window.services.threejs", "toggleWorkplane", visible));
	}

	public boolean getIsInEditMode() {
		return _isInEditMode;
	}

	public void setIsInEditMode(boolean value) {
		_isInEditMode = value;
		
		addUpdate(new JSFunctionCall(getID(), "window.services.threejs", "toggleEditMode", value));
	}

	public boolean getIsRotateMode() {
		return _isRotateMode;
	}

	public void setIsRotateMode(boolean value) {
		_isRotateMode = value;

		addUpdate(new JSFunctionCall(getID(), "window.services.threejs", "toggleRotateMode", value));
	}

	@Override
	protected void internalAttach() {
		super.internalAttach();

		_model.registerListener(this);
		_selection.addSelectionListener(this);

		getFrameScope().registerContentHandler(getID(), this);
	}

	@Override
	protected void internalDetach() {
		getFrameScope().deregisterContentHandler(this);

		_model.unregisterListener(this);
		_selection.removeSelectionListener(this);

		super.internalDetach();
	}

	@Override
	public void beforeSet(Observable obj, String property, Object value) {
		requestRepaint();
	}

	@Override
	protected boolean hasUpdates() {
		return super.hasUpdates() || _selectionUpdate != null;
	}

	@Override
	protected void internalRevalidate(DisplayContext context, UpdateQueue actions) {
		super.internalRevalidate(context, actions);

		if (_selectionUpdate != null) {
			actions.add(new JSFunctionCall(getID(), "window.services.threejs", "selectionChanged",
				_selectionUpdate.toString()));
			_selectionUpdate = null;
		}
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
		out.append("window.services.threejs.init('" + getID() + "', '" + 
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
	 * Adjusts the selection based on a client-side selection change.
	 */
	public static class UpdateSelection extends ControlCommand {

		/**
		 * Singleton {@link UpdateSelection} instance.
		 */
		public static final UpdateSelection INSTANCE = new UpdateSelection();

		private UpdateSelection() {
			super("updateSelection");
		}

		@Override
		protected HandlerResult execute(DisplayContext commandContext, Control control, Map<String, Object> arguments) {
			ThreeJsControl self = (ThreeJsControl) control;

			@SuppressWarnings("unchecked")
			Map<Number, String> changes = (Map<Number, String>) arguments.get("changes");

			self.updateSelection(changes);
			return HandlerResult.DEFAULT_RESULT;
		}

		@Override
		public ResKey getI18NKey() {
			return ResKey.text("updateSelection");
		}
	}

	/**
	 * Applies command from the UI to update the selection set.
	 */
	void updateSelection(Map<?, ?> changes) {
		_selectionUpdating = true;
		try {
			Map<Object, SharedGraphNode> index = _scope.index();
			Set<Object> newSelection = new HashSet<>(_selection.getSelection());
			for (var entry : changes.entrySet()) {
				Integer id = Integer.valueOf(Integer.parseInt(entry.getKey().toString()));

				SharedGraphNode node = index.get(id);
				if (node != null) {
					switch (entry.getValue().toString()) {
						case "ADD":
							newSelection.add(node);
							break;
						case "REMOVE":
							newSelection.remove(node);
							break;
					}
				}
			}

			// Update model in one call to avoid event chaos.
			_selection.setSelection(newSelection);
		} finally {
			_selectionUpdating = false;
		}
	}

	@Override
	public void notifySelectionChanged(SelectionModel model, Set<?> formerlySelectedObjects, Set<?> selectedObjects) {
		if (_selectionUpdating) {
			return;
		}

		// Send command to the UI.
		if (_selectionUpdate == null) {
			_selectionUpdate = SelectionChanged.create();
		}
		for (Object x : selectedObjects) {
			if (!formerlySelectedObjects.contains(x)) {
				_selectionUpdate.getChanged().put(Integer.valueOf(_scope.id((SharedGraphNode) x)), SelectionChange.ADD);
			}
		}
		for (Object x : formerlySelectedObjects) {
			if (!selectedObjects.contains(x)) {
				_selectionUpdate.getChanged().put(Integer.valueOf(_scope.id((SharedGraphNode) x)),
					SelectionChange.REMOVE);
			}
		}
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