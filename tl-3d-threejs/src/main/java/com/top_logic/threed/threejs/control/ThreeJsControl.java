/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.control;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.top_logic.base.services.simpleajax.JSFunctionCall;
import com.top_logic.basic.col.MapBuilder;
import com.top_logic.basic.io.BinaryContent;
import com.top_logic.basic.io.StreamUtilities;
import com.top_logic.basic.io.binary.BinaryDataSource;
import com.top_logic.basic.json.JSON;
import com.top_logic.basic.json.JSON.ParseException;
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
import com.top_logic.model.search.expr.query.QueryExecutor;
import com.top_logic.threed.core.math.Transformation;
import com.top_logic.threed.core.math.TransformationUtil;
import com.top_logic.threed.threejs.component.CoordinateSystem;
import com.top_logic.threed.threejs.component.CoordinateSystemProvider;
import com.top_logic.threed.threejs.scene.ConnectionPoint;
import com.top_logic.threed.threejs.scene.ImageData;
import com.top_logic.threed.threejs.scene.SceneGraph;
import com.top_logic.threed.threejs.scene.SceneNode;
import com.top_logic.threed.threejs.scene.ScenePart;
import com.top_logic.threed.threejs.scene.SceneUtils;
import com.top_logic.tool.boundsec.HandlerResult;
import com.top_logic.util.Resources;

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
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletResponse;

/**
 * {@link Control} displaying a 3D scene using <code>three.js</code>.
 */
public class ThreeJsControl extends AbstractControl implements ContentHandler {

	private static final String THREEJS_JS_NS = "window.services.threejs";

	/** Common prefix of the content types of glTF data (JSON and binary). */
	private static final String GLTF_CONTENT_TYPE_PREFIX = "model/gltf";

	/** Content type of binary glTF data. */
	private static final String GLTF_BINARY_CONTENT_TYPE = "model/gltf-binary";

	/** Type of the command setting a property in a scene change of the client. */
	private static final String SET_PROPERTY = "S";

	private static final Map<String, ControlCommand> COMMANDS = createCommandMap(ApplySceneChange.INSTANCE);

	private final SceneGraph _model;

	private final Map<String, ImageData> _imageByID;

	private final ExternalScope _nodeScope;

	private boolean _isWorkplaneVisible;

	private boolean _isSkyboxVisible;

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

	private ContentHandler _imageData = new ContentHandler() {

		@Override
		public void handleContent(DisplayContext context, String id, URLParser url)
				throws IOException, ServletException {
			HttpServletResponse response = context.asResponse();
			if (url.isEmpty()) {
				response.sendError(HttpServletResponse.SC_NOT_FOUND, "No image ID given");
				return;
			}
			String imageID = url.removeResource();

			ImageData imageData = _imageByID.get(imageID);
			if (imageData == null) {
				response.sendError(HttpServletResponse.SC_NOT_FOUND, "Unknown image ID: " + imageID);
				return;
			}

			QueryExecutor imageExpr = imageData.getData();
			Object image = imageExpr.execute(imageData.getUserData());
			if (image == null) {
				response.sendError(HttpServletResponse.SC_NOT_FOUND, "No image for ID " + imageID + ".");
				return;
			}
			if (!(image instanceof BinaryContent)) {
				response.sendError(HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
					"No image for ID " + imageID + ". Got " + image.getClass().getName());
				return;
			}

			response.setContentType(contentType(image));
			if (image instanceof BinaryDataSource data) {
				long size = data.getSize();
				if (size >= 0) {
					response.setContentLengthLong(size);
				}
			}
			// The URL contains the ID of the control and changes when the view is rendered again,
			// an image with the same ID may have new content (uploaded again): not worth caching.
			response.setHeader("Cache-Control", "no-store");
			try (InputStream content = ((BinaryContent) image).getStream()) {
				StreamUtilities.copyStreamContents(content, response.getOutputStream());
			}
		}

		/**
		 * The content type of the given glTF data: binary glTF unless the data declares the JSON
		 * form. A generic type, as often stored for uploaded files, is not passed on.
		 */
		private String contentType(Object image) {
			if (image instanceof BinaryDataSource data) {
				String contentType = data.getContentType();
				if (contentType != null && contentType.startsWith(GLTF_CONTENT_TYPE_PREFIX)) {
					return contentType;
				}
			}
			return GLTF_BINARY_CONTENT_TYPE;
		}
	};

	/**
	 * Creates a {@link ThreeJsControl}.
	 */
	public ThreeJsControl(SceneGraph model, Map<String, ImageData> dynamicImages) {
		super(COMMANDS);
		_model = model;
		_imageByID = dynamicImages;
		_nodeScope = new ExternalScope(2, 0);
	}

	@Override
	public SceneGraph getModel() {
		return _model;
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

	/**
	 * Sends the command to the client to zoom out from selection.
	 */
	public void zoomOutFromSelection() {
    	addUpdate(new JSFunctionCall(getID(), THREEJS_JS_NS, "zoomOutFromSelection"));
	}

	/**
	 * Whether the skybox is visible.
	 */
	public boolean getIsSkyboxVisible() {
		return _isSkyboxVisible;
	}

	/**
	 * Setter for {@link #getIsWorkplaneVisible()}.
	 */
	public void setIsSkyboxVisible(boolean visible) {
		_isSkyboxVisible = visible;
		
		addUpdate(new JSFunctionCall(getID(), THREEJS_JS_NS, "toggleSkybox", visible));
	}

	/**
	 * Whether the workplane is visible.
	 */
	public boolean getIsWorkplaneVisible() {
		return _isWorkplaneVisible;
	}

	/**
	 * Setter for {@link #getIsWorkplaneVisible()}.
	 */
	public void setIsWorkplaneVisible(boolean visible) {
		_isWorkplaneVisible = visible;
		
		addUpdate(new JSFunctionCall(getID(), THREEJS_JS_NS, "toggleWorkplane", visible));
	}

	/**
	 * Whether objects are transparent.
	 */
	public boolean getAreObjectsTransparent() {
		return _areObjectsTransparent;
	}

	/**
	 * Setter for {@link #getAreObjectsTransparent()}.
	 */
	public void setAreObjectsTransparent(boolean transparent) {
		_areObjectsTransparent = transparent;
		
		addUpdate(new JSFunctionCall(getID(), THREEJS_JS_NS, "toggleObjectsTransparent", transparent));
	}

	/**
	 * Whether edit mode is active.
	 */
	public boolean getIsInEditMode() {
		return _isInEditMode;
	}

	/**
	 * Sets to edit mode.
	 */
	public void setIsInEditMode(boolean value) {
		_isInEditMode = value;
		_gizmoControl.setEditable(value);
		
		addUpdate(new JSFunctionCall(getID(), THREEJS_JS_NS, "toggleEditMode", value));
	}

	/**
	 * Whether rotate or translate mode is active.
	 */
	public boolean getIsRotateMode() {
		return _isRotateMode;
	}

	/**
	 * Setter for {@link #getIsRotateMode()}.
	 */
	public void setIsRotateMode(boolean value) {
		_isRotateMode = value;

		addUpdate(new JSFunctionCall(getID(), THREEJS_JS_NS, "toggleRotateMode", value));
	}

	@Override
	protected void internalAttach() {
		super.internalAttach();

		_sceneListener.attach(_model);
		updateGizmoControl(findGizmoNode(_model.getSelection()));

		// Initialize step sizes from model. Changes reach the client as scene graph update.
		_gizmoControl.setStepSizes(_model.getTranslateStepSize(), _model.getRotateStepSize(),
			newTranslateSize -> getModel().setTranslateStepSize(newTranslateSize),
			newRotateSize -> getModel().setRotateStepSize(newRotateSize));

		getFrameScope().registerContentHandler(getID(), this);
		getFrameScope().registerContentHandler(imageDataID(), _imageData);
	}

	private String imageDataID() {
		return getID() + "-image";
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
		getFrameScope().deregisterContentHandler(_imageData);
		getFrameScope().deregisterContentHandler(this);
		_sceneListener.detach(_model);

		super.internalDetach();
	}

	@Override
	protected boolean hasUpdates() {
		return super.hasUpdates() || _nodeScope.hasChanges();
	}

	@Override
	protected void internalRevalidate(DisplayContext context, UpdateQueue actions) {
		super.internalRevalidate(context, actions);

		if (_nodeScope.hasChanges()) {
			Writer out = new StringW();
			try {
				_nodeScope.createPatch(new JsonWriter(out));
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
		String imageUrl = getFrameScope().getURL(context, _imageData).getURL();

		Map<String, Object> initialState = new MapBuilder<String, Object>()
			.put("controlId", getID())
			.put("contextPath", context.getContextPath())
			.put("dataUrl", dataUrl)
			.put("imageUrl", imageUrl)
			.put("isWorkplaneVisible", _isWorkplaneVisible)
			.put("isSkyboxVisible", _isSkyboxVisible)
			.put("isInEditMode", _isInEditMode)
			.put("isRotateMode", _isRotateMode)
			.put("areObjectsTransparent", _areObjectsTransparent)
			.put("loadErrorMessage", Resources.getInstance().getString(I18NConstants.ERROR_LOADING_SCENE))
			.toMap();

		String initialStateJson = JSON.toString(initialState);

		HTMLUtil.beginScriptAfterRendering(out);
		out.append(THREEJS_JS_NS);
		out.append(".init(" + initialStateJson + ")");
		HTMLUtil.endScriptAfterRendering(out);

		_gizmoControl.write(context, out);

		out.endTag(DIV);
	}

	@Override
	public void handleContent(DisplayContext context, String id, URLParser url) throws IOException {
		HttpServletResponse response = context.asResponse();
		response.setContentType("application/json");
		response.setCharacterEncoding("utf-8");

		_nodeScope.clear();
		_nodeScope.writeRefOrData(new JsonWriter(new WriterAdapter(response.getWriter())), _model);
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
		applyClientChanges(_nodeScope, changes);
	}

	/**
	 * Applies the changes made by the client to the scene graph of the server.
	 * 
	 * <p>
	 * The server may have changes that are not yet delivered to the client, e.g. because another
	 * component changed the model while the client sent its change. These changes are kept and
	 * delivered with the next update. For nodes with such changes, the client may have worked on
	 * an outdated state:
	 * </p>
	 * <ul>
	 * <li>A new value of a property is applied (the last change wins), and the server sends the
	 * complete value back, which replaces pending list updates of this property.</li>
	 * <li>A list update of the client refers to indices in the outdated list. It is not applied;
	 * the server sends the complete list instead, which reverts the change on the client.</li>
	 * </ul>
	 */
	static void applyClientChanges(DefaultScope scope, String changes) {
		try {
			if (!scope.hasChanges()) {
				scope.applyChanges(new JsonReader(new StringR(changes)));
				return;
			}

			Set<SharedGraphNode> dirty = new HashSet<>(scope.getDirty());
			for (Object entry : (List<?>) JSON.fromString(changes)) {
				List<?> header = (List<?>) ((List<?>) entry).get(0);
				String type = (String) header.get(0);
				Map<?, ?> properties = (Map<?, ?>) header.get(1);
				int id = ((Number) properties.get("id")).intValue();
				String property = (String) properties.get("p");

				SharedGraphNode node = scope.index().get(id);
				if (node == null) {
					// Removed on the server, the client is informed by the pending changes.
					continue;
				}
				if (!dirty.contains(node)) {
					applySingle(scope, entry);
					continue;
				}
				if (SET_PROPERTY.equals(type)) {
					applySingle(scope, entry);
				}
				// Deliver the complete value of the property with the next update.
				scope.beforeSet((Observable) node, property, null);
			}
		} catch (IOException | ParseException ex) {
			throw new IllegalArgumentException("Invalid scene change: " + changes, ex);
		}
	}

	private static void applySingle(DefaultScope scope, Object command) throws IOException {
		scope.applyChanges(new JsonReader(new StringR(JSON.toString(List.of(command)))));
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