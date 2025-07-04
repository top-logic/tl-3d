/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.component;

import java.lang.invoke.MethodHandles;
import java.lang.invoke.MethodHandles.Lookup;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

import org.apache.commons.lang3.mutable.MutableBoolean;

import com.top_logic.base.services.simpleajax.HTMLFragment;
import com.top_logic.basic.CollectionUtil;
import com.top_logic.basic.Log;
import com.top_logic.basic.col.FilterUtil;
import com.top_logic.basic.config.ConfigurationException;
import com.top_logic.basic.config.ConfigurationItem;
import com.top_logic.basic.config.InstantiationContext;
import com.top_logic.basic.config.PolymorphicConfiguration;
import com.top_logic.basic.config.annotation.Label;
import com.top_logic.basic.config.annotation.Name;
import com.top_logic.basic.config.annotation.TagName;
import com.top_logic.basic.config.annotation.defaults.BooleanDefault;
import com.top_logic.basic.config.annotation.defaults.ClassDefault;
import com.top_logic.basic.config.annotation.defaults.ItemDefault;
import com.top_logic.event.infoservice.InfoService;
import com.top_logic.knowledge.service.Transaction;
import com.top_logic.layout.DisplayContext;
import com.top_logic.layout.channel.ChannelSPI;
import com.top_logic.layout.channel.ComponentChannel;
import com.top_logic.layout.channel.ComponentChannel.ChannelListener;
import com.top_logic.layout.channel.DefaultChannelSPI;
import com.top_logic.layout.component.Selectable;
import com.top_logic.layout.component.SelectableWithSelectionModel;
import com.top_logic.layout.component.model.SelectionListener;
import com.top_logic.layout.form.component.Editor;
import com.top_logic.layout.form.component.TransactionHandler;
import com.top_logic.layout.form.component.edit.EditMode;
import com.top_logic.layout.structure.ContentLayoutControlProvider;
import com.top_logic.layout.structure.LayoutControlProvider;
import com.top_logic.layout.table.component.BuilderComponent;
import com.top_logic.mig.html.SelectionModel;
import com.top_logic.mig.html.SelectionModelConfig;
import com.top_logic.mig.html.layout.CommandRegistry;
import com.top_logic.mig.html.layout.LayoutComponent;
import com.top_logic.model.TLClass;
import com.top_logic.model.TLObject;
import com.top_logic.model.TLStructuredType;
import com.top_logic.model.search.expr.SearchExpression;
import com.top_logic.model.search.expr.config.dom.Expr;
import com.top_logic.model.search.expr.query.QueryExecutor;
import com.top_logic.model.util.TLModelUtil;
import com.top_logic.threed.core.math.Transformation;
import com.top_logic.threed.threejs.control.ThreeJsControl;
import com.top_logic.threed.threejs.scene.GroupNode;
import com.top_logic.threed.threejs.scene.PartNode;
import com.top_logic.threed.threejs.scene.SceneGraph;
import com.top_logic.threed.threejs.scene.SceneNode;
import com.top_logic.threed.threejs.scene.SceneUtils;
import com.top_logic.tool.boundsec.AbstractCommandHandler;
import com.top_logic.tool.boundsec.HandlerResult;

import de.haumacher.msgbuf.observer.Listener;
import de.haumacher.msgbuf.observer.Observable;

/**
 * 3D-Viewer using the <code>Three.js</code> library.
 */
public class ThreeJsComponent extends BuilderComponent
		implements SelectionListener, SelectableWithSelectionModel, Editor {

	/**
	 * Configuration options of {@link ThreeJsComponent} that can be choosen "in app".
	 * 
	 * @author <a href="mailto:daniel.busche@top-logic.com">Daniel Busche</a>
	 */
	public interface InAppViewerConfig extends ConfigurationItem {

		/**
		 * Configuration name of {@link #getCoordinateSystems()}.
		 */
		String COORDINATE_SYSTEMS = "coordinate-systems";

		/**
		 * Configuration name of {@link #getApplyScript()}.
		 */
		String APPLY_SCRIPT = "apply-script";

		/**
		 * The operation that takes the changes from the client and applies them to the business
		 * objects.
		 */
		@Label("Store operation")
		Expr getApplyScript();

		/**
		 * Function resolving a set of local coordinate systems that can be selected while moving
		 * objects in layout mode.
		 * 
		 * <p>
		 * The function expects the set of selected objects as first argument and the component's
		 * model as second argument.
		 * </p>
		 * 
		 * <p>
		 * As a result, a list of JSON objects specifying the local coordinate systems is expected.
		 * A coordinate system specification has the two properties <code>label</code> of type
		 * <code>String</code> and <code>tx</code> of type <code>Transformation</code>.
		 * 
		 * <pre>
		 * [
		 *   {
		 *     "label": "My coordinate System 1",
		 *     "tx": $affineTransformation1
		 *   }, {
		 *     "label": "My coordinate System 2",
		 *     "tx": $affineTransformation2
		 *   }
		 * ]
		 * </pre>
		 * </p>
		 */
		@Name(COORDINATE_SYSTEMS)
		Expr getCoordinateSystems();
	}

	/**
	 * {@link ThreeJsComponent} configuration.
	 */
	@TagName("three-js-viewer")
	public interface Config
			extends BuilderComponent.Config, Selectable.SelectableConfig, Editor.Config, SelectionModelConfig,
			InAppViewerConfig {

		/** @see com.top_logic.basic.reflect.DefaultMethodInvoker */
		Lookup LOOKUP = MethodHandles.lookup();

		@Override
		PolymorphicConfiguration<? extends SceneBuilder> getModelBuilder();

		@Override
		@ItemDefault(CP.class)
		PolymorphicConfiguration<LayoutControlProvider> getComponentControlProvider();

		@Override
		@BooleanDefault(true)
		boolean hasToolbar();

		@Override
		default void modifyIntrinsicCommands(CommandRegistry registry) {
			com.top_logic.layout.form.component.Editor.Config.super.modifyIntrinsicCommands(registry);
			BuilderComponent.Config.super.modifyIntrinsicCommands(registry);
		}

		@Override
		@ClassDefault(ThreeJsComponent.class)
		Class<? extends LayoutComponent> getImplementationClass();
	}

	/**
	 * {@link LayoutControlProvider} for {@link ThreeJsComponent}.
	 */
	public static class CP extends ContentLayoutControlProvider<ContentLayoutControlProvider.Config<?>> {

		/**
		 * Creates a {@link CP}.
		 */
		public CP(InstantiationContext context, Config<?> config) {
			super(context, config);
		}

		@Override
		protected HTMLFragment createView(LayoutComponent component) {
			ThreeJsComponent viewer = (ThreeJsComponent) component;
			return viewer.getThreeJSControl();
		}
	}

	/**
	 * Channel definition storing paths of hidden elements.
	 */
	public static final ChannelSPI HIDDEN_ELEMENTS = new DefaultChannelSPI("hiddenElements", Collections.emptySet());

	/**
	 * @see #channels()
	 */
	protected static final Map<String, ChannelSPI> CHANNELS =
		channels(Selectable.MODEL_AND_SELECTION_CHANNEL, EditMode.EDIT_MODE_SPI, HIDDEN_ELEMENTS);

	private final SceneGraph _scene;

	private final SelectionModel _selectionModel;

	private final Map<Object, SceneNode> _nodeByModel = new HashMap<>();

	private final Map<SceneNode, GroupNode> _parentNodes = new HashMap<>();

	private boolean _sceneValid;

	private ThreeJsControl _control;
	
	private Set<? extends TLStructuredType> _typesToObserve;

	private final Set<SceneNode> _transformedNodes = new HashSet<>();

	private final AllNodesObserver _sceneNodeListener = new AllNodesObserver() {

		@Override
		public void registerRecursive(SceneNode node) {
			super.registerRecursive(node);
			node.registerListener(_transformListener);
		}

		@Override
		public void unregisterRecursive(SceneNode node) {
			node.unregisterListener(_transformListener);
			super.unregisterRecursive(node);
		}

	};

	private final Listener _transformListener = new Listener() {

		@Override
		public void afterChanged(Observable obj, String property) {
			switch (property) {
				case SceneNode.TRANSFORM__PROP:
					if (isInEditMode()) {
						_transformedNodes.add((SceneNode) obj);
					}
			}

		}

		@Override
		public void beforeSet(Observable obj, String property, Object value) {
			// Nothing to do here. See afterChanged(...)
		}

	};

	private SceneNode.Visitor<Void, GroupNode, RuntimeException> _addToIndex = new SceneNode.Visitor<>() {

		@Override
		public Void visit(GroupNode self, GroupNode parent) {
			add(self, parent);
			for (SceneNode child : self.getContents()) {
				child.visit(this, self);
			}
			return null;
		}

		@Override
		public Void visit(PartNode self, GroupNode parent) {
			add(self, parent);
			return null;
		}

		private void add(SceneNode self, GroupNode parent) {
			Object userData = self.getUserData();
			if (userData != null) {
				SceneNode clash = _nodeByModel.put(userData, self);
				if (clash != null && clash != self) {
					throw new IllegalArgumentException(
						"Multiple nodes for the same user data '" + userData + "': " + clash + " vs. " + self);
				}
			}
			if (parent != null) {
				GroupNode clash = _parentNodes.put(self, parent);
				if (clash != null && clash != parent) {
					throw new IllegalArgumentException(
						"Multiple parents for the same child '" + self + "': " + clash + " vs. " + parent);
				}
			}
		}
		
	};

	private SceneNode.Visitor<Void, Void, RuntimeException> _removeFromIndex = new SceneNode.Visitor<>() {

		@Override
		public Void visit(GroupNode self, Void arg) {
			remove(self);
			for (SceneNode child : self.getContents()) {
				child.visit(this, arg);
			}
			return null;
		}

		@Override
		public Void visit(PartNode self, Void arg) {
			remove(self);
			return null;
		}

		private void remove(SceneNode self) {
			Object userData = self.getUserData();
			if (userData != null) {
				_nodeByModel.remove(userData);
			}
			_parentNodes.remove(self);
		}

	};

	private QueryExecutor _applyScript;

	private QueryExecutor _coordinateSystemsFunction;

	/**
	 * Creates a {@link ThreeJsComponent}.
	 */
	public ThreeJsComponent(InstantiationContext context, Config config) throws ConfigurationException {
		super(context, config);

		_selectionModel = config.getSelectionModelFactory().newSelectionModel(this);
		_selectionModel.addSelectionListener(this);
		_scene = SceneGraph.create();
		SceneUtils.setCoordinateSystem(_scene, Transformation.identity());
		connect(_scene, _selectionModel);
		_scene.registerListener(new Listener() {

			@Override
			public void beforeSet(Observable obj, String property, Object value) {
				switch (property) {
					case SceneGraph.ROOT__PROP: {
						SceneGraph scene = (SceneGraph) obj;
						SceneNode oldRoot = scene.getRoot();
						if (oldRoot != null) {
							_sceneNodeListener.unregisterRecursive(oldRoot);
						}
						if (value != null) {
							_sceneNodeListener.registerRecursive((SceneNode) value);
						}
					}
				}
			}

		});

		_typesToObserve = computeTypesToObserve();

		_applyScript = QueryExecutor.compileOptional(config.getApplyScript());
		_coordinateSystemsFunction = QueryExecutor.compileOptional(config.getCoordinateSystems());
	}

	private void connect(SceneGraph scene, SelectionModel selectionModel) {
		MutableBoolean ignoreSelectEvent = new MutableBoolean();
		scene.registerListener(new Listener() {

			@Override
			public void beforeSet(Observable obj, String property, Object value) {

				switch (property) {
					case SceneGraph.SELECTION__PROP: {
						if (ignoreSelectEvent.booleanValue()) {
							return;
						}
						ignoreSelectEvent.setTrue();
						try {
							selectionModel.setSelection(CollectionUtil.asSet(value));
						} finally {
							ignoreSelectEvent.setFalse();
						}
						break;
					}
					default: // ignore
				}
			}

			@Override
			public void beforeAdd(Observable obj, String property, int index, Object element) {
				switch (property) {
					case SceneGraph.SELECTION__PROP: {
						if (ignoreSelectEvent.booleanValue()) {
							return;
						}
						ignoreSelectEvent.setTrue();
						try {
							selectionModel.setSelected(element, true);
						} finally {
							ignoreSelectEvent.setFalse();
						}
						break;
					}
					default: // ignore
				}
			}

			@Override
			public void afterRemove(Observable obj, String property, int index, Object element) {
				switch (property) {
					case SceneGraph.SELECTION__PROP: {
						if (ignoreSelectEvent.booleanValue()) {
							return;
						}
						ignoreSelectEvent.setTrue();
						try {
							selectionModel.setSelected(element, false);
						} finally {
							ignoreSelectEvent.setFalse();
						}
						break;
					}
					default: // ignore
				}
			}
		});
		selectionModel.addSelectionListener(new SelectionListener() {

			@Override
			public void notifySelectionChanged(SelectionModel model, Set<?> formerlySelectedObjects,
					Set<?> selectedObjects) {
				if (ignoreSelectEvent.booleanValue()) {
					return;
				}
				ignoreSelectEvent.setTrue();
				try {
					Set<?> newElements = new HashSet<>(selectedObjects);
					newElements.removeAll(formerlySelectedObjects);
					Set<?> removedElements = new HashSet<>(formerlySelectedObjects);
					removedElements.removeAll(selectedObjects);
					List<SceneNode> selection = scene.getSelection();
					selection.removeAll(removedElements);
					selection.addAll((Collection<? extends SceneNode>) newElements);
				} finally {
					ignoreSelectEvent.setFalse();
				}
			}
		});
	}

	@Override
	public SelectionModel getSelectionModel() {
		return _selectionModel;
	}

	/**
	 * Shows the current selection in the viewport.
	 */
	public void zoomToSelection() {
		getThreeJSControl().zoomToSelection();
	}

	public void zoomOutFromSelection() {
    	getThreeJSControl().zoomOutFromSelection();
	}

	public boolean getIsWorkplaneVisible() {
		return getThreeJSControl().getIsWorkplaneVisible();
	}

	public void setIsWorkplaneVisible(boolean visible) {
		getThreeJSControl().setIsWorkplaneVisible(visible);
	}

		public boolean getAreObjectsTransparent() {
		return getThreeJSControl().getAreObjectsTransparent();
	}

	public void setAreObjectsTransparent(boolean transparent) {
		getThreeJSControl().setAreObjectsTransparent(transparent);
	}

	public boolean getIsObjectHidden() {
		List<SceneNode> selection = _scene.getSelection();
		for (SceneNode node : selection) {
			if (node.isHidden()) {
				return true;
			}
		}

		return false;
	}

	public void toggleObjectVisibility(boolean hidden) { 
		List<SceneNode> selection = _scene.getSelection();
		for (SceneNode node : selection) {
			node.setHidden(hidden);
		}
	}

	public boolean getIsInEditMode() {
		return getThreeJSControl().getIsInEditMode();
	}

	public void setIsInEditMode(boolean editing) {
		getThreeJSControl().setIsInEditMode(editing);
	}

	public boolean getIsRotateMode() {
		return getThreeJSControl().getIsRotateMode();
	}

	public void setIsRotateMode(boolean editing) {
		getThreeJSControl().setIsRotateMode(editing);
	}

	@Override
	protected void afterModelSet(Object oldModel, Object newModel) {
		super.afterModelSet(oldModel, newModel);

		invalidateScene();
	}

	ThreeJsControl getThreeJSControl() {
		if (_control == null) {
			_control = new ThreeJsControl(getScene());
		}

		return _control;
	}

	@Override
	protected boolean doValidateModel(DisplayContext context) {
		boolean result = super.doValidateModel(context);

		if (!_sceneValid) {
			buildScene();
			internalSetSelection(getSelected());

			_sceneValid = true;
		}

		return result;
	}

	private void buildScene() {
		_nodeByModel.clear();
		_parentNodes.clear();
		SceneNode root = builder().getModel(getModel(), this);
		root.visit(_addToIndex, null);
		_scene.setRoot(root);
	}

	private SceneBuilder builder() {
		return (SceneBuilder) getBuilder();
	}

	@Override
	public void invalidate() {
		super.invalidate();
		invalidateScene();
	}

	private boolean invalidateScene() {
		return _sceneValid = false;
	}

	/**
	 * The currently displayed {@link SceneGraph}.
	 */
	public SceneGraph getScene() {
		return _scene;
	}

	@Override
	public void linkChannels(Log log) {
		super.linkChannels(log);
		Editor.super.linkChannels(log);

		linkSelectionChannel(log);

		selectionChannel().addListener(this::handleNewSelectionChannelValue);
		getChannel(HIDDEN_ELEMENTS.getName()).addListener(this::handleNewHiddenElementsChannelValue);
	}
	
	@Override
	protected Map<String, ChannelSPI> programmaticChannels() {
		return CHANNELS;
	}

	@Override
	protected Set<? extends TLStructuredType> getTypesToObserve() {
		return _typesToObserve;
	}

	private Set<TLClass> computeTypesToObserve() {
		SceneBuilder builder = builder();

		if (builder != null) {
			return TLModelUtil.getConcreteSubclasses(FilterUtil.filterSet(TLClass.class, builder.getTypesToObserve()));
		} else {
			return Collections.emptySet();
		}
	}

	@Override
	protected void handleTLObjectCreations(Stream<? extends TLObject> createdObjects) {
		updateNodes(createdObjects);
	}

	@Override
	protected void handleTLObjectUpdates(Stream<? extends TLObject> updatedObjects) {
		updateNodes(updatedObjects);
	}

	private void updateNodes(Stream<? extends TLObject> updatedObjects) {
		Object selectedObjects = getSelected();
		SceneBuilder builder = builder();

		updatedObjects
			.filter(object -> _typesToObserve.contains(object.tType()))
			.flatMap(object -> builder.getNodesToUpdate(this, object).stream())
			.distinct()
			.filter(object -> builder.supportsObject(ThreeJsComponent.this, object))
			.forEach(object -> update(object));

		internalSetSelection(selectedObjects);
	}

	private void update(Object object) {
		SceneNode sceneNode = _nodeByModel.get(object);
		if (sceneNode == null) {
			return;
		}

		SceneNode newNode = builder().createSubtree(object, this);
		GroupNode parent = _parentNodes.get(sceneNode);
		if (parent == null) {
			assert _scene.getRoot() == sceneNode : "Only the root node has no parent.";
			_nodeByModel.clear();
			_parentNodes.clear();
			newNode.visit(_addToIndex, null);
			_scene.setRoot(newNode);
		} else {
			List<SceneNode> contents = parent.getContents();
			int idx = contents.indexOf(sceneNode);
			sceneNode.visit(_removeFromIndex, null);
			contents.set(idx, newNode);
			newNode.visit(_addToIndex, parent);
		}

	}

	/**
	 * Implementation of {@link ChannelListener} for the {@link #selectionChannel()}.
	 *
	 * @param sender
	 *        See {@link ChannelListener#handleNewValue(ComponentChannel, Object, Object)}.
	 * @param oldValue
	 *        See {@link ChannelListener#handleNewValue(ComponentChannel, Object, Object)}.
	 * @param newValue
	 *        See {@link ChannelListener#handleNewValue(ComponentChannel, Object, Object)}.
	 */
	private void handleNewSelectionChannelValue(ComponentChannel sender, Object oldValue, Object newValue) {
		// Component received a new selection.
		internalSetSelection(newValue);
	}

	private void internalSetSelection(Object newValue) {
		_selectionModel.setSelection(addNodesForBusinessObjects(newValue, new HashSet<>()));
		Collection<?> newSelection;
		if (newValue instanceof Collection) {
			newSelection = (Collection<?>) newValue;
		} else {
			newSelection = CollectionUtil.singletonOrEmptyList(newValue);
		}
		_control.setCoordinateSystems(getGlobalCoordinateSystems(newSelection));
	}

	private <T extends Collection<? super SceneNode>> T addNodesForBusinessObjects(Object newValue, T out) {
		if (newValue instanceof Collection) {
			for (Object selected : ((Collection<?>) newValue)) {
				SceneNode node = _nodeByModel.get(selected);
				if (node != null) {
					out.add(node);
				}
			}
		} else {
			SceneNode node = _nodeByModel.get(newValue);
			if (node != null) {
				out.add(node);
			}
		}
		return out;
	}

	@Override
	public void notifySelectionChanged(SelectionModel model, Set<?> formerlySelectedObjects, Set<?> selectedObjects) {
		// Selection was changed in the UI.
		if (_selectionModel.isMultiSelectionSupported()) {
			Set<Object> newSelection = new HashSet<>();
			for (Object selectedNode : selectedObjects) {
				Object nodeModel = ((SceneNode) selectedNode).getUserData();
				newSelection.add(nodeModel);
			}
			selectionChannel().set(newSelection);
		} else {
			Object selectedNode = CollectionUtil.getSingleValueFromCollection(selectedObjects);
			if (selectedNode == null) {
				selectionChannel().set(null);
			} else {
				selectionChannel().set(((SceneNode) selectedNode).getUserData());
			}
		}
	}


	@Override
	public void handleComponentModeChange(boolean editMode) {
		getThreeJSControl().setIsInEditMode(editMode);
		if (!editMode) {
			if (!_transformedNodes.isEmpty()) {
				// Ensure UI is resetted
				_transformedNodes.clear();

				invalidateScene();
			}
		}
	}
	
	/**
	 * Implementation of {@link ChannelListener} for the {@link #selectionChannel()}.
	 *
	 * @param sender
	 *        See {@link ChannelListener#handleNewValue(ComponentChannel, Object, Object)}.
	 * @param oldValue
	 *        See {@link ChannelListener#handleNewValue(ComponentChannel, Object, Object)}.
	 * @param newValue
	 *        See {@link ChannelListener#handleNewValue(ComponentChannel, Object, Object)}.
	 */
	private void handleNewHiddenElementsChannelValue(ComponentChannel sender, Object oldValue, Object newValue) {
		Set<?> oldChannelSetValue = CollectionUtil.asSet(oldValue);
		Set<?> newChannelSetValue = CollectionUtil.asSet(newValue);
		for (Object formerHidden : oldChannelSetValue) {
			if (!newChannelSetValue.contains(formerHidden)) {
				setHiddenForNodeOfPath(formerHidden, false);
			}
		}
		for (Object formerVisible : newChannelSetValue) {
			if (!oldChannelSetValue.contains(formerVisible)) {
				setHiddenForNodeOfPath(formerVisible, true);
			}
		}
	}

	private void setHiddenForNodeOfPath(Object boPath, boolean newHidden) {
		SceneNode node;
		if (boPath instanceof Collection<?>) {
			Collection<?> path = (Collection<?>) boPath;
			if (path.isEmpty()) {
				node = null;
			} else {
				Object lastBO = CollectionUtil.getLast(path);
				node = _nodeByModel.get(lastBO);
			}
		} else {
			node = null;
		}
		if (node != null) {
			node.setHidden(newHidden);
		} else {
			InfoService.showError(I18NConstants.ERROR_NOT_VALID_HIDDEN_CHANNEL_VALUE__VALUE.fill(boPath));
		}
	}

	private List<CoordinateSystemProvider> getGlobalCoordinateSystems(Collection<?> selectedObjects) {
		if (_coordinateSystemsFunction == null) {
			return Collections.emptyList();
		}
		return SearchExpression.asCollection(_coordinateSystemsFunction.execute(selectedObjects, getModel()))
			.stream()
			.map(CoordinateSystem::asCoordinateSystem)
			.<CoordinateSystemProvider> map(x -> () -> x)
			.toList();
	}

	HandlerResult applyTransformation() {
		HandlerResult result = applyTransformation(_transformedNodes);
		if (result.isSuccess()) {
			// Reset changed nodes.
			_transformedNodes.clear();
		}
		return result;
	}

	/**
	 * Applies the transformation.
	 *
	 * @param transformedNodes
	 *        The actually transformed nodes. May be empty, when no changes happened.
	 */
	protected HandlerResult applyTransformation(Set<SceneNode> transformedNodes) {
		if (!transformedNodes.isEmpty()) {
			if (_applyScript != null) {
				for (SceneNode node : transformedNodes) {
					_applyScript.execute(node.getUserData(), SceneUtils.getTransform(node), getModel());
				}
			}
		}
		return HandlerResult.DEFAULT_RESULT;
	}



	/**
	 * Apply command for the {@link ThreeJsComponent}.
	 */
	public static class ApplyTransformCommand extends AbstractCommandHandler implements TransactionHandler {

		/**
		 * Configuration of the {@link ApplyTransformCommand}.
		 */
		public interface Config extends AbstractCommandHandler.Config {
			// No additional properties.
		}

		/**
		 * Default command id for {@link ApplyTransformCommand}.
		 */
        public static final String COMMAND_ID = "applyTransform";

		/**
		 * Creates a {@link ApplyTransformCommand}.
		 */
        public ApplyTransformCommand(InstantiationContext context, Config config) {
			super(context, config);
        }

		@Override
		public HandlerResult handleCommand(DisplayContext aContext, LayoutComponent aComponent,
				Object model, Map<String, Object> someArguments) {
			try (Transaction tx = beginTransaction(model)) {
				HandlerResult result = ((ThreeJsComponent) aComponent).applyTransformation();
				if (result.isSuccess()) {
					tx.commit();
				}
				return result;
			}

		}
    }

}
