/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.threejs.component;

import com.top_logic.base.services.simpleajax.HTMLFragment;
import com.top_logic.basic.config.ConfigurationException;
import com.top_logic.basic.config.InstantiationContext;
import com.top_logic.basic.config.PolymorphicConfiguration;
import com.top_logic.basic.config.annotation.defaults.BooleanDefault;
import com.top_logic.basic.config.annotation.defaults.ItemDefault;
import com.top_logic.layout.DisplayContext;
import com.top_logic.layout.structure.ContentLayoutControlProvider;
import com.top_logic.layout.structure.LayoutControlProvider;
import com.top_logic.layout.table.component.BuilderComponent;
import com.top_logic.mig.html.layout.LayoutComponent;
import com.top_logic.tl3d.threejs.control.ThreeJsControl;
import com.top_logic.tl3d.threejs.scene.SceneGraph;

/**
 * 3D-Viewer using the <code>Three.js</code> library.
 */
public class ThreeJsComponent extends BuilderComponent {

	/**
	 * {@link ThreeJsComponent} configuration.
	 */
	public interface Config extends BuilderComponent.Config {

		@Override
		PolymorphicConfiguration<? extends SceneBuilder> getModelBuilder();

		@Override
		@ItemDefault(CP.class)
		PolymorphicConfiguration<LayoutControlProvider> getComponentControlProvider();

		@Override
		@BooleanDefault(true)
		boolean hasToolbar();

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
			return new ThreeJsControl(((ThreeJsComponent) component).getScene());
		}

	}

	private SceneGraph _scene = SceneGraph.create();

	private boolean _sceneValid;

	/**
	 * Creates a {@link ThreeJsComponent}.
	 */
	public ThreeJsComponent(InstantiationContext context, Config config) throws ConfigurationException {
		super(context, config);
	}

	@Override
	protected void afterModelSet(Object oldModel, Object newModel) {
		super.afterModelSet(oldModel, newModel);

		_sceneValid = false;
	}

	@Override
	protected boolean doValidateModel(DisplayContext context) {
		boolean result = super.doValidateModel(context);

		if (!_sceneValid) {
			_scene.setRoot(builder().getModel(getModel(), this));
			_sceneValid = true;
		}

		return result;
	}

	private SceneBuilder builder() {
		return (SceneBuilder) getBuilder();
	}

	/**
	 * The currently displayed {@link SceneGraph}.
	 */
	public SceneGraph getScene() {
		return _scene;
	}

}
