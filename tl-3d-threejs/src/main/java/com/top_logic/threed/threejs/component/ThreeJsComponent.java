/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.component;

import java.lang.invoke.MethodHandles;
import java.lang.invoke.MethodHandles.Lookup;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.commons.lang3.mutable.MutableBoolean;

import com.top_logic.base.services.simpleajax.HTMLFragment;
import com.top_logic.basic.CollectionUtil;
import com.top_logic.basic.Log;
import com.top_logic.basic.config.ConfigurationException;
import com.top_logic.basic.config.InstantiationContext;
import com.top_logic.basic.config.PolymorphicConfiguration;
import com.top_logic.basic.config.annotation.Name;
import com.top_logic.basic.config.annotation.defaults.BooleanDefault;
import com.top_logic.basic.config.annotation.defaults.ItemDefault;
import com.top_logic.basic.config.annotation.defaults.StringDefault;
import com.top_logic.layout.DisplayContext;
import com.top_logic.layout.channel.ChannelSPI;
import com.top_logic.layout.channel.ComponentChannel;
import com.top_logic.layout.channel.ComponentChannel.ChannelListener;
import com.top_logic.layout.component.Selectable;
import com.top_logic.layout.component.SelectableWithSelectionModel;
import com.top_logic.layout.component.model.SelectionListener;
import com.top_logic.layout.form.component.AbstractApplyCommandHandler;
import com.top_logic.layout.form.component.Editor;
import com.top_logic.layout.form.component.edit.EditMode;
import com.top_logic.layout.structure.ContentLayoutControlProvider;
import com.top_logic.layout.structure.LayoutControlProvider;
import com.top_logic.layout.table.component.BuilderComponent;
import com.top_logic.mig.html.DefaultMultiSelectionModel;
import com.top_logic.mig.html.DefaultSingleSelectionModel;
import com.top_logic.mig.html.SelectionModel;
import com.top_logic.mig.html.layout.CommandRegistry;
import com.top_logic.mig.html.layout.LayoutComponent;
import com.top_logic.threed.threejs.control.ThreeJsControl;
import com.top_logic.threed.threejs.scene.GroupNode;
import com.top_logic.threed.threejs.scene.PartNode;
import com.top_logic.threed.threejs.scene.SceneGraph;
import com.top_logic.threed.threejs.scene.SceneNode;
import com.top_logic.tool.boundsec.HandlerResult;
import com.top_logic.tool.execution.ExecutabilityRule;
import com.top_logic.tool.execution.InEditModeExecutable;

import de.haumacher.msgbuf.observer.Listener;
import de.haumacher.msgbuf.observer.Observable;

/**
 * 3D-Viewer using the <code>Three.js</code> library.
 */
public class ThreeJsComponent extends BuilderComponent
		implements ChannelListener, SelectionListener, SelectableWithSelectionModel,
		SceneNode.Visitor<Void, Map<Object, SceneNode>, RuntimeException>, Editor {

	/**
	 * {@link ThreeJsComponent} configuration.
	 */
	public interface Config extends BuilderComponent.Config, Selectable.SelectableConfig, Editor.Config {

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

		@Name("canSelect")
		boolean canSelect();

		@Name("multiSelection")
		boolean hasMultiSelection();

		@Override
		@StringDefault(ApplyTransformCommand.COMMAND_ID)
		String getApplyCommand();

		@Override
		@StringDefault(SaveTransformCommand.COMMAND_ID)
		String getSaveCommand();

		@Override
		default void modifyIntrinsicCommands(CommandRegistry registry) {
			com.top_logic.layout.form.component.Editor.Config.super.modifyIntrinsicCommands(registry);
			BuilderComponent.Config.super.modifyIntrinsicCommands(registry);
		}
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
	 * @see #channels()
	 */
	protected static final Map<String, ChannelSPI> CHANNELS =
		channels(Selectable.MODEL_AND_SELECTION_CHANNEL, EditMode.EDIT_MODE_SPI);

	private final SceneGraph _scene;

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

		_scene = SceneGraph.create();

		connect(_scene, _selectionModel);
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
			_control = new ThreeJsControl(getScene());
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
			_scene.setSelection(addNodesForBusinessObjects(selectionChannel().get(), new ArrayList<>()));

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
		Editor.super.linkChannels(log);

		linkSelectionChannel(log);

		selectionChannel().addListener(this);
	}
	
	@Override
	protected Map<String, ChannelSPI> channels() {
		// TODO Auto-generated method stub
		return CHANNELS;
	}

	@Override
	public void handleNewValue(ComponentChannel sender, Object oldValue, Object newValue) {
		// Component received a new selection.
		_selectionModel.setSelection(addNodesForBusinessObjects(newValue, new HashSet<>()));
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

	@Override
	public void handleComponentModeChange(boolean editMode) {
		getThreeJSControl().setIsInEditMode(editMode);
	}


	public static class ApplyTransformCommand extends AbstractApplyCommandHandler {

		public interface Config extends AbstractApplyCommandHandler.Config {
			// No additional properties.
		}

		@Override
		@Deprecated
		public ExecutabilityRule createExecutabilityRule() {
			return InEditModeExecutable.INSTANCE;
		}

        public static final String COMMAND_ID = "applyTransform";

        public ApplyTransformCommand(InstantiationContext context, Config config) {
			super(context, config);
        }

		@Override
		public HandlerResult handleCommand(DisplayContext aContext, LayoutComponent aComponent,
				Object model, Map<String, Object> someArguments) {

			return HandlerResult.DEFAULT_RESULT;
		}
    }

	public static class SaveTransformCommand extends ApplyTransformCommand {

		// Constants

		/** ID of this handler. */
		public static final String COMMAND_ID = "saveTransform";

		public SaveTransformCommand(InstantiationContext context, Config config) {
	        	super(context, config);
	        }

		@Override
		public HandlerResult handleCommand(DisplayContext aContext, LayoutComponent aComponent, Object model,
				Map<String, Object> someArguments) {

			return HandlerResult.DEFAULT_RESULT;
		}
	}
}
