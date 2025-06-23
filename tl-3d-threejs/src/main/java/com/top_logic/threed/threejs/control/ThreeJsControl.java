/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.control;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
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
import com.top_logic.threed.core.math.Transformation;
import com.top_logic.threed.core.math.TransformationUtil;
import com.top_logic.threed.threejs.component.CoordinateSystem;
import com.top_logic.threed.threejs.component.CoordinateSystemProvider;
import com.top_logic.threed.threejs.scene.ConnectionPoint;
import com.top_logic.threed.threejs.scene.SceneGraph;
import com.top_logic.threed.threejs.scene.SceneNode;
import com.top_logic.threed.threejs.scene.ScenePart;
import com.top_logic.threed.threejs.scene.SceneUtils;
import com.top_logic.tool.boundsec.HandlerResult;

import de.haumacher.msgbuf.graph.DefaultScope;
import de.haumacher.msgbuf.graph.SharedGraphNode;
import de.haumacher.msgbuf.io.StringR;
import de.haumacher.msgbuf.io.StringW;
import de.haumacher.msgbuf.io.Writer;
import de.haumacher.msgbuf.json.JsonReader;
import de.haumacher.msgbuf.json.JsonWriter;
import de.haumacher.msgbuf.observer.Listener;
import de.haumacher.msgbuf.observer.Observable;
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

	private boolean _areObjectsTransparent;

	private boolean _isInEditMode;

	private boolean _isRotateMode;

	private class SceneListener implements Listener {

		private Map<Observable, List<SceneNode>> _upcomingSelectionChange = new HashMap<>();

		private Listener transformationListener = new Listener() {
			
			@Override
			public void afterChanged(Observable obj, String property) {
				switch (property) {
					case ConnectionPoint.TRANSFORM__PROP: {
						updateGizmoControl((SceneNode) obj);
					}
				}
			}

			@Override
			public void beforeSet(Observable obj, String property, Object value) {
				// Nothing to do here. See afterChanged(...)
			}

		};

		void attach(SceneGraph graph) {
			graph.registerListener(this);

			List<SceneNode> selection = graph.getSelection();
			SceneNode gizmoNode = findGizmoNode(selection);
			registerTxListener(gizmoNode);
		}

		void detach(SceneGraph graph) {
			List<SceneNode> selection = graph.getSelection();
			selection.forEach(this::unregisterTXListener);

			graph.unregisterListener(this);
		}

		private void registerTxListener(SceneNode node) {
			updateGizmoControl(node);
			if (node != null) {
				node.registerListener(transformationListener);
			}

		}

		private void unregisterTXListener(SceneNode node) {
			node.unregisterListener(transformationListener);
		}

		@Override
		public void afterChanged(Observable obj, String property) {
			switch (property) {
				case SceneGraph.SELECTION__PROP: {
					List<SceneNode> oldSelection = _upcomingSelectionChange.remove(obj);
					oldSelection.forEach(this::unregisterTXListener);
					SceneNode gizmoNode = findGizmoNode(((SceneGraph) obj).getSelection());
					registerTxListener(gizmoNode);
				}
			}
		}

		@Override
		public void beforeSet(Observable obj, String property, Object value) {
			switch (property) {
				case SceneGraph.SELECTION__PROP: {
					_upcomingSelectionChange.put(obj, ((SceneGraph) obj).getSelection());
				}
			}
		}

		@Override
		public void beforeAdd(Observable obj, String property, int index, Object element) {
			switch (property) {
				case SceneGraph.SELECTION__PROP: {
					if (!_upcomingSelectionChange.containsKey(obj)) {
						_upcomingSelectionChange.put(obj, ((SceneGraph) obj).getSelection());
					}
				}
			}
		}

		@Override
		public void afterRemove(Observable obj, String property, int index, Object element) {
			switch (property) {
				case SceneGraph.SELECTION__PROP: {
					if (!_upcomingSelectionChange.containsKey(obj)) {
						List<SceneNode> currSelection = new ArrayList<>(((SceneGraph) obj).getSelection());
						currSelection.add(index, (SceneNode) element);
						_upcomingSelectionChange.put(obj, currSelection);
					}
				}
			}
		}

	}

	private SceneListener _sceneListener = new SceneListener();

	private GizmoControl _gizmoControl = new GizmoControl();

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

	public boolean getAreObjectsTransparent() {
		return _areObjectsTransparent;
	}

	public void setAreObjectsTransparent(boolean transparent) {
		_areObjectsTransparent = transparent;
		
		addUpdate(new JSFunctionCall(getID(), THREEJS_JS_NS, "toggleObjectsTransparent", transparent));
	}

	public boolean getIsInEditMode() {
		return _isInEditMode;
	}

	public void setIsInEditMode(boolean value) {
		_isInEditMode = value;
		_gizmoControl.setEditable(value);
		
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

		_sceneListener.attach(_model);
		updateGizmoControl(findGizmoNode(_model.getSelection()));

		getFrameScope().registerContentHandler(getID(), this);
	}

	private void updateGizmoControl(SceneNode node) {
		if (node == null) {
			_gizmoControl.setConsumer(null);
			_gizmoControl.setModel(null);
		} else {
			List<Double> transform = node.getTransform();
			if (transform.size() == 12) {
				_gizmoControl.setConsumer(null);
				ScenePart parent = node.getParent();
				Transformation absoluteParentTX;
				if (parent != null) {
					absoluteParentTX = SceneUtils.getAbsoluteTransformation(parent);
				} else {
					absoluteParentTX = Transformation.identity();
				}
				_gizmoControl.setModel(absoluteParentTX.after(TransformationUtil.fromList(transform)));
				_gizmoControl
					.setConsumer(tx -> SceneUtils.setTransform(node, absoluteParentTX.inverse().after(tx)));
			}
		}
	}

	private SceneNode findGizmoNode(List<SceneNode> selection) {
		int selectionCnt = selection.size();
		switch (selectionCnt) {
			case 0:
				return null;
			case 1:
				return selection.get(0);
			default: {
				SceneNode first = selection.get(0);
				List<ScenePart> pathToRoot = new ArrayList<>();
				ScenePart p = first;
				do {
					pathToRoot.add(p);
					p = p.getParent();
				} while (p != null);

				int maxIdx = 0;
				for (int i = 1; i < selectionCnt; i++) {
					maxIdx = Math.max(maxIdx, pathToRoot.indexOf(selection.get(i)));
				}
				return (SceneNode) pathToRoot.get(maxIdx);
			}
		}
	}

	@Override
	protected void internalDetach() {
		getFrameScope().deregisterContentHandler(this);
		_sceneListener.detach(_model);

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
			_areObjectsTransparent + ", " + 
			_isInEditMode + ", " +
			_isRotateMode +
			")"
		);
		HTMLUtil.endScriptAfterRendering(out);

		_gizmoControl.write(context, out);

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

	/**
	 * Sets the given coordinate systems as possible {@link CoordinateSystem}s.
	 */
	public void setCoordinateSystems(List<CoordinateSystemProvider> globalCoordinateSystems) {
		_gizmoControl.setCoordinateSystems(globalCoordinateSystems, this::handleCoordinateSystemChanged);

	}

	private void handleCoordinateSystemChanged(CoordinateSystem system) {
		Transformation tx;
		if (system == null) {
			tx = Transformation.identity();
		} else {
			tx = system.getTx();
		}
		SceneUtils.setCoordinateSystem(_model, tx);
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