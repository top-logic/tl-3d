/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.script;

import java.util.Collections;
import java.util.List;

import com.top_logic.basic.ConfigurationError;
import com.top_logic.basic.config.ConfigurationException;
import com.top_logic.basic.config.InstantiationContext;
import com.top_logic.basic.io.BinaryContent;
import com.top_logic.model.search.expr.GenericMethod;
import com.top_logic.model.search.expr.SearchExpression;
import com.top_logic.model.search.expr.config.ExprFormat;
import com.top_logic.model.search.expr.config.dom.Expr;
import com.top_logic.model.search.expr.config.operations.AbstractSimpleMethodBuilder;
import com.top_logic.model.search.expr.config.operations.ArgumentDescriptor;
import com.top_logic.model.search.expr.query.QueryExecutor;
import com.top_logic.threed.core.math.Transformation;
import com.top_logic.threed.threejs.scene.ConnectionPoint;
import com.top_logic.threed.threejs.scene.GltfAsset;
import com.top_logic.threed.threejs.scene.ImageData;
import com.top_logic.threed.threejs.scene.PartNode;
import com.top_logic.util.error.TopLogicException;

/**
 * TL-Script constructor function for an {@link PartNode}.
 */
public class ThreejsGltf extends ThreejsSceneNode<PartNode> {

	private QueryExecutor _userObjectAsContent;

	/**
	 * Creates a {@link ThreejsGltf} method.
	 */
	protected ThreejsGltf(String name, SearchExpression[] arguments) throws ConfigurationException {
		super(name, arguments);
		_userObjectAsContent = QueryExecutor.compile(ExprFormat.INSTANCE.getValue("threejsGLTF", "x->$x"));
	}

	@Override
	public GenericMethod copy(SearchExpression[] arguments) {
		try {
			return new ThreejsGltf(getName(), arguments);
		} catch (ConfigurationException ex) {
			throw new ConfigurationError(ex);
		}
	}

	@Override
	protected PartNode allocate() {
		return PartNode.create();
	}

	@Override
	protected PartNode createNode(Object[] arguments) {
		GltfAsset asset = GltfAsset.create();

		ConnectionPoint layoutPoint = toConnectionPoint(getArguments()[4], arguments[4]);
		asset.setLayoutPoint(layoutPoint);

		List<ConnectionPoint> snappingPoints = toConnectionPointList(getArguments()[5], arguments[5]);
		asset.setSnappingPoints(snappingPoints);

		String url = (String) arguments[6];
		asset.setUrl(url);

		ImageData imageData = asImageData(arguments[7]);
		asset.setDynamicImage(imageData);

		return super.createNode(arguments).setAsset(asset);
	}

	private ImageData asImageData(Object data) {
		if (data == null) {
			return null;
		}
		if (data instanceof ImageData image) {
			return image;
		}
		if (data instanceof BinaryContent binary) {
			ImageData image = ImageData.create();
			image.setUserData(binary);
			image.setData(_userObjectAsContent);
			return image;
		}
		throw new TopLogicException(
			I18NConstants.ERROR_IMAGE_DATA_EXPECTED__ACTUAL_EXPR.fill(data.getClass().getName(), this));
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
			.optional("tx")
			.optional("userData")
			.optional("hidden")
			.optional("color")
			.optional("layoutPoint")
			.optional("snappingPoints")
			.optional("url")
			.optional("imageData")
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
