/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: LicenseRef-BOS-TopLogic-1.0
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
 * {@link SearchExpression} creating an identity transformation matrix.
 * 
 * @author <a href="mailto:sven.foerster@top-logic.com">Sven Förster</a>
 */
public class Identity extends GenericMethod {

	/**
	 * Creates an {@link Identity}.
	 */
	protected Identity(String name, SearchExpression[] arguments) {
		super(name, arguments);
	}

	@Override
	public GenericMethod copy(SearchExpression[] arguments) {
		return new Identity(getName(), arguments);
	}

	@Override
	public TLType getType(List<TLType> argumentTypes) {
		return TLModelUtil.findType("tl.uber3d:Transformation");
	}

	@Override
	protected Object eval(Object[] arguments, EvalContext definitions) {
		return Transformation.identity();
	}

	/**
	 * {@link MethodBuilder} creating {@link Identity}.
	 */
	public static final class Builder extends AbstractSimpleMethodBuilder<Identity> {

		/** Creates a {@link Builder}. */
		public Builder(InstantiationContext context, Config<?> config) {
			super(context, config);
		}

		@Override
		public Identity build(Expr expr, SearchExpression[] args) throws ConfigurationException {
			checkNoArguments(expr, args);

			return new Identity(getConfig().getName(), args);
		}

	}

}
