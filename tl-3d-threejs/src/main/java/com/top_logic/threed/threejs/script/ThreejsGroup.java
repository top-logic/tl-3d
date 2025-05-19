/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.script;

import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

import com.top_logic.basic.config.ConfigurationException;
import com.top_logic.basic.config.InstantiationContext;
import com.top_logic.model.search.expr.GenericMethod;
import com.top_logic.model.search.expr.SearchExpression;
import com.top_logic.model.search.expr.config.dom.Expr;
import com.top_logic.model.search.expr.config.operations.AbstractSimpleMethodBuilder;
import com.top_logic.model.search.expr.config.operations.ArgumentDescriptor;
import com.top_logic.threed.threejs.scene.GroupNode;
import com.top_logic.threed.threejs.scene.SceneNode;

/**
 * TL-Script constructor function for an {@link GroupNode}.
 */
public class ThreejsGroup extends ThreejsSceneNode<GroupNode> {

	/**
	 * Creates a {@link ThreejsGroup} method.
	 */
	protected ThreejsGroup(String name, SearchExpression[] arguments) {
		super(name, arguments);
	}

	@Override
	public GenericMethod copy(SearchExpression[] arguments) {
		return new ThreejsGroup(getName(), arguments);
	}

	@Override
	protected GroupNode createNode(Object[] arguments) {
		List<SceneNode> contents = asSceneNodes(arguments[5]);

		return super.createNode(arguments)
			.setContents(contents);
	}

	@Override
	protected GroupNode allocate() {
		return GroupNode.create();
	}

	private static List<SceneNode> asSceneNodes(Object object) {
		if (object == null) {
			return Collections.emptyList();
		}

		return asCollection(object).stream().map(x -> asSceneNode(x)).collect(Collectors.toList());
	}

	private static SceneNode asSceneNode(Object object) {
		return (SceneNode) object;
	}

	/**
	 * Factory for {@link ThreejsGroup} methods.
	 */
	public static final class Builder extends AbstractSimpleMethodBuilder<ThreejsGroup> {

		private static final ArgumentDescriptor DESCRIPTOR = ArgumentDescriptor.builder()
			.optional("name")
			.optional("tx")
			.optional("userData")
			.optional("hidden")
			.optional("color")
			.optional("components")
			.build();

		/**
		 * Creates a {@link Builder}.
		 */
		public Builder(InstantiationContext context, Config<?> config) {
			super(context, config);
		}

		@Override
		public ArgumentDescriptor descriptor() {
			return ThreejsGroup.Builder.DESCRIPTOR;
		}

		@Override
		public ThreejsGroup build(Expr expr, SearchExpression[] args)
				throws ConfigurationException {
			return new ThreejsGroup(getConfig().getName(), args);
		}

	}
}
