/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.component;

import com.top_logic.basic.CalledByReflection;
import com.top_logic.basic.config.AbstractConfiguredInstance;
import com.top_logic.basic.config.InstantiationContext;
import com.top_logic.basic.config.PolymorphicConfiguration;
import com.top_logic.basic.config.annotation.Name;
import com.top_logic.mig.html.layout.LayoutComponent;
import com.top_logic.model.search.expr.config.dom.Expr;
import com.top_logic.model.search.expr.query.QueryExecutor;
import com.top_logic.threed.threejs.scene.SceneNode;

/**
 * {@link SceneBuilder} that can be parameterized with TL-Script.
 */
public class SceneBuilderByExpression extends AbstractConfiguredInstance<SceneBuilderByExpression.Config>
		implements SceneBuilder {

	/**
	 * Configuration options for {@link SceneBuilderByExpression}.
	 */
	public interface Config extends PolymorphicConfiguration<SceneBuilderByExpression> {

		/**
		 * Function taking the component's model and creating the top-level scene node.
		 */
		@Name("createScene")
		Expr getCreateScene();

	}

	private QueryExecutor _createScene;

	/**
	 * Creates a {@link SceneBuilderByExpression} from configuration.
	 * 
	 * @param context
	 *        The context for instantiating sub configurations.
	 * @param config
	 *        The configuration.
	 */
	@CalledByReflection
	public SceneBuilderByExpression(InstantiationContext context, Config config) {
		super(context, config);
		
		_createScene = QueryExecutor.compile(config.getCreateScene());
	}

	@Override
	public boolean supportsModel(Object aModel, LayoutComponent aComponent) {
		return true;
	}

	@Override
	public SceneNode getModel(Object businessModel, LayoutComponent aComponent) {
		SceneNode rootNode = (SceneNode) _createScene.execute(businessModel);
		
		return rootNode;
	}

}
