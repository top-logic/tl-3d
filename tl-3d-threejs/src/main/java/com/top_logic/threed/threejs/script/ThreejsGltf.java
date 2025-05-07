/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.script;

import java.util.Collections;
import java.util.List;

import com.top_logic.basic.config.ConfigurationException;
import com.top_logic.basic.config.InstantiationContext;
import com.top_logic.model.search.expr.GenericMethod;
import com.top_logic.model.search.expr.SearchExpression;
import com.top_logic.model.search.expr.config.dom.Expr;
import com.top_logic.model.search.expr.config.operations.AbstractSimpleMethodBuilder;
import com.top_logic.model.search.expr.config.operations.ArgumentDescriptor;
import com.top_logic.threed.core.math.Transformation;
import com.top_logic.threed.threejs.scene.ConnectionPoint;
import com.top_logic.threed.threejs.scene.GltfAsset;
import com.top_logic.threed.threejs.scene.PartNode;

/**
 * TL-Script constructor function for an {@link PartNode}.
 */
public class ThreejsGltf extends ThreejsSceneNode<PartNode> {

	/**
	 * Creates a {@link ThreejsGltf} method.
	 */
	protected ThreejsGltf(String name, SearchExpression[] arguments) {
		super(name, arguments);
	}

	@Override
	public GenericMethod copy(SearchExpression[] arguments) {
		return new ThreejsGltf(getName(), arguments);
	}

	@Override
	protected PartNode allocate() {
		return PartNode.create();
	}

	@Override
	protected PartNode createNode(Object[] arguments) {
		GltfAsset asset = GltfAsset.create();

		ConnectionPoint layoutPoint = toConnectionPoint(getArguments()[3], arguments[3]);
		asset.setLayoutPoint(layoutPoint);

		List<ConnectionPoint> snappingPoints = toConnectionPointList(getArguments()[4], arguments[4]);
		asset.setSnappingPoints(snappingPoints);

		String url = (String) arguments[5];
		asset.setUrl(url);

		return super.createNode(arguments).setAsset(asset);
	}

	private List<ConnectionPoint> toConnectionPointList(SearchExpression expr, Object value) {
		List<?> valueList = asList(value);
		return valueList.stream().map(v -> toConnectionPointNonNull(expr, v)).toList();
	}

	private ConnectionPoint toConnectionPointNonNull(SearchExpression expr, Object value) {
		return notNull(expr, toConnectionPoint(expr, value));
	}

	private ConnectionPoint toConnectionPoint(SearchExpression expr, Object value) {
		if (value instanceof ConnectionPoint) {
			return (ConnectionPoint) value;
		}
		Transformation tx = asTransformation(expr, value);
		if (tx == null) {
			return null;
		}
		return ThreejsCp.newConnectionPoint(tx, this, Collections.emptyList());
	}

	/**
	 * Factory for {@link ThreejsGltf} methods.
	 */
	public static final class Builder extends AbstractSimpleMethodBuilder<ThreejsGltf> {

		private static final ArgumentDescriptor DESCRIPTOR = ArgumentDescriptor.builder()
			.optional("name")
			.optional("tx")
			.optional("userData")
			.optional("layoutPoint")
			.optional("snappingPoints")
			.optional("url")
			.build();

		/**
		 * Creates a {@link Builder}.
		 */
		public Builder(InstantiationContext context, Config<?> config) {
			super(context, config);
		}

		@Override
		public ArgumentDescriptor descriptor() {
			return ThreejsGltf.Builder.DESCRIPTOR;
		}

		@Override
		public ThreejsGltf build(Expr expr, SearchExpression[] args)
				throws ConfigurationException {
			return new ThreejsGltf(getConfig().getName(), args);
		}

	}
}
