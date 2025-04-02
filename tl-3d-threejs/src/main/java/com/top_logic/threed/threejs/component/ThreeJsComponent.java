/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.component;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

import com.top_logic.base.services.simpleajax.HTMLFragment;
import com.top_logic.basic.CollectionUtil;
import com.top_logic.basic.Log;
import com.top_logic.basic.config.ConfigurationException;
import com.top_logic.basic.config.InstantiationContext;
import com.top_logic.basic.config.PolymorphicConfiguration;
import com.top_logic.basic.config.annotation.Name;
import com.top_logic.basic.config.annotation.defaults.BooleanDefault;
import com.top_logic.basic.config.annotation.defaults.ItemDefault;
import com.top_logic.layout.DisplayContext;
import com.top_logic.layout.channel.ComponentChannel;
import com.top_logic.layout.channel.ComponentChannel.ChannelListener;
import com.top_logic.layout.component.Selectable;
import com.top_logic.layout.component.SelectableWithSelectionModel;
import com.top_logic.layout.component.model.SelectionListener;
import com.top_logic.layout.structure.ContentLayoutControlProvider;
import com.top_logic.layout.structure.LayoutControlProvider;
import com.top_logic.layout.table.component.BuilderComponent;
import com.top_logic.mig.html.DefaultMultiSelectionModel;
import com.top_logic.mig.html.DefaultSingleSelectionModel;
import com.top_logic.mig.html.SelectionModel;
import com.top_logic.mig.html.layout.LayoutComponent;
import com.top_logic.threed.threejs.control.ThreeJsControl;
import com.top_logic.threed.threejs.scene.GroupNode;
import com.top_logic.threed.threejs.scene.PartNode;
import com.top_logic.threed.threejs.scene.SceneGraph;
import com.top_logic.threed.threejs.scene.SceneNode;


/**
 * 3D-Viewer using the <code>Three.js</code> library.
 */
public class ThreeJsComponent extends BuilderComponent
		implements ChannelListener, SelectionListener, SelectableWithSelectionModel,
		SceneNode.Visitor<Void, Map<Object, SceneNode>, RuntimeException> {

	/**
	 * {@link ThreeJsComponent} configuration.
	 */
	public interface Config extends BuilderComponent.Config, Selectable.SelectableConfig {

		@Override
		PolymorphicConfiguration<? extends SceneBuilder> getModelBuilder();

		@Override
		@ItemDefault(CP.class)
		PolymorphicConfiguration<LayoutControlProvider> getComponentControlProvider();

		@Override
		@BooleanDefault(true)
		boolean hasToolbar();

		@Name("canSelect")
		boolean canSelect();

		@Name("multiSelection")
		boolean hasMultiSelection();

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

	private SceneGraph _scene = SceneGraph.create();

	private final SelectionModel _selectionModel;

	private final Map<Object, SceneNode> _nodeByModel = new HashMap<>();

	private boolean _sceneValid;

	private boolean _multiSelect;

	private ThreeJsControl _control;

	/**
	 * Creates a {@link ThreeJsComponent}.
	 */
	public ThreeJsComponent(InstantiationContext context, Config config) throws ConfigurationException {
		super(context, config);

		_multiSelect = config.hasMultiSelection();
		_selectionModel = _multiSelect ? new DefaultMultiSelectionModel(this) : new DefaultSingleSelectionModel(this);

		_selectionModel.addSelectionListener(this);
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

		_sceneValid = false;
	}

	ThreeJsControl getThreeJSControl() {
		if (_control == null) {
			_control = new ThreeJsControl(getScene(), getSelectionModel());
		}

		return _control;
	}

	@Override
	protected boolean doValidateModel(DisplayContext context) {
		boolean result = super.doValidateModel(context);

		if (!_sceneValid) {
			_nodeByModel.clear();
			SceneNode root = builder().getModel(getModel(), this);
			root.visit(this, _nodeByModel);
			_scene.setRoot(root);
			_selectionModel.setSelection(nodesForBusinessObjects(selectionChannel().get()));
			_sceneValid = true;
		}

		return result;
	}

	private SceneBuilder builder() {
		return (SceneBuilder) getBuilder();
	}

	@Override
	public void invalidate() {
		super.invalidate();
		_sceneValid = false;
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

		linkSelectionChannel(log);

		selectionChannel().addListener(this);
	}

	@Override
	public void handleNewValue(ComponentChannel sender, Object oldValue, Object newValue) {
		_selectionModel.setSelection(nodesForBusinessObjects(newValue));
	}

	private Set<SceneNode> nodesForBusinessObjects(Object newValue) {
		// Component received a new selection.
		Set<SceneNode> newSelection = new HashSet<>();

		if (newValue instanceof Collection) {
			for (Object selected : ((Collection<?>) newValue)) {
				SceneNode node = _nodeByModel.get(selected);
				if (node != null) {
					newSelection.add(node);
				}
			}
		} else {
			SceneNode node = _nodeByModel.get(newValue);
			if (node != null) {
				newSelection.add(node);
			}
		}
		return newSelection;
	}

	@Override
	public void notifySelectionChanged(SelectionModel model, Set<?> formerlySelectedObjects, Set<?> selectedObjects) {
		// Selection was changed in the UI.
		if (_multiSelect) {
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
	public Void visit(GroupNode self, Map<Object, SceneNode> arg) {
		index(self, arg);
		for (SceneNode child : self.getContents()) {
			child.visit(this, arg);
		}
		return null;
	}

	@Override
	public Void visit(PartNode self, Map<Object, SceneNode> arg) {
		index(self, arg);
		return null;
	}

	private void index(SceneNode self, Map<Object, SceneNode> arg) {
		Object userData = self.getUserData();
		if (userData != null) {
			arg.put(userData, self);
		}
	}
}
