/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.script;

import java.util.List;

import com.top_logic.basic.StringServices;
import com.top_logic.basic.config.ConfigurationException;
import com.top_logic.basic.config.InstantiationContext;
import com.top_logic.model.TLType;
import com.top_logic.model.search.expr.EvalContext;
import com.top_logic.model.search.expr.GenericMethod;
import com.top_logic.model.search.expr.SearchExpression;
import com.top_logic.model.search.expr.config.dom.Expr;
import com.top_logic.model.search.expr.config.operations.AbstractSimpleMethodBuilder;
import com.top_logic.model.search.expr.config.operations.ArgumentDescriptor;
import com.top_logic.model.search.expr.query.QueryExecutor;
import com.top_logic.threed.threejs.scene.ImageData;

/**
 * TL-Script constructor function for an {@link ImageData}.
 */
public class ThreejsImage extends GenericMethod {

	/**
	 * Creates a {@link ThreejsImage} method.
	 */
	protected ThreejsImage(String name, SearchExpression[] arguments) {
		super(name, arguments);
	}

	@Override
	public GenericMethod copy(SearchExpression[] arguments) {
		return new ThreejsImage(getName(), arguments);
	}

	@Override
	public TLType getType(List<TLType> argumentTypes) {
		return null;
	}

	@Override
	protected Object eval(Object[] arguments, EvalContext definitions) {
		ImageData imageData = ImageData.create();
		imageData.setUserData(arguments[0]);
		imageData.setData(QueryExecutor.compile((SearchExpression) arguments[1]));
		imageData.setImageID(asString(arguments[2]));
		return imageData;
	}

	/**
	 * Factory for {@link ThreejsImage} methods.
	 */
	public static final class Builder extends AbstractSimpleMethodBuilder<ThreejsImage> {

		private static final ArgumentDescriptor DESCRIPTOR = ArgumentDescriptor.builder()
			.mandatory("userData")
			.mandatory("data")
			.optional("imageID", StringServices.EMPTY_STRING)
			.build();

		/**
		 * Creates a {@link Builder}.
		 */
		public Builder(InstantiationContext context, Config<?> config) {
			super(context, config);
		}

		@Override
		public ArgumentDescriptor descriptor() {
			return ThreejsImage.Builder.DESCRIPTOR;
		}

		@Override
		public ThreejsImage build(Expr expr, SearchExpression[] args)
				throws ConfigurationException {
			return new ThreejsImage(getConfig().getName(), args);
		}

	}
}
