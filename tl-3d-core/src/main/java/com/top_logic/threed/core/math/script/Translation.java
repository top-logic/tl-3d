/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.core.math.script;

import java.util.List;

import com.top_logic.basic.config.ConfigurationException;
import com.top_logic.basic.config.InstantiationContext;
import com.top_logic.model.TLType;
import com.top_logic.model.search.expr.EvalContext;
import com.top_logic.model.search.expr.GenericMethod;
import com.top_logic.model.search.expr.SearchExpression;
import com.top_logic.model.search.expr.config.dom.Expr;
import com.top_logic.model.search.expr.config.operations.AbstractSimpleMethodBuilder;
import com.top_logic.model.search.expr.config.operations.MethodBuilder;
import com.top_logic.model.util.TLModelUtil;
import com.top_logic.threed.core.math.Transformation;

/**
 * {@link SearchExpression} creating a translate transformation matrix.
 * 
 * @author <a href="mailto:sven.foerster@top-logic.com">Sven Förster</a>
 */
public class Translation extends GenericMethod {

	/**
	 * Creates an {@link Translation}.
	 */
	protected Translation(String name, SearchExpression[] arguments) {
		super(name, arguments);
	}

	@Override
	public GenericMethod copy(SearchExpression[] arguments) {
		return new Translation(getName(), arguments);
	}

	@Override
	public TLType getType(List<TLType> argumentTypes) {
		return TLModelUtil.findType("tl.uber3d:Transformation");
	}

	@Override
	protected Object eval(Object[] arguments, EvalContext definitions) {
		double x = asDouble(arguments[0]);
		double y = asDouble(arguments[1]);
		double z = asDouble(arguments[2]);

		return Transformation.translate(x, y, z);
	}

	/**
	 * {@link MethodBuilder} creating {@link Translation}.
	 */
	public static final class Builder extends AbstractSimpleMethodBuilder<Translation> {

		/** Creates a {@link Builder}. */
		public Builder(InstantiationContext context, Config<?> config) {
			super(context, config);
		}

		@Override
		public Translation build(Expr expr, SearchExpression[] args) throws ConfigurationException {
			checkThreeArgs(expr, args);

			return new Translation(getConfig().getName(), args);
		}

	}

}
