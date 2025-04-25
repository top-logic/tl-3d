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
import com.top_logic.threed.core.model.TlThreedCoreFactory;

/**
 * {@link SearchExpression} creating an inverse of a given transformation.
 * 
 * @author <a href="mailto:sven.foerster@top-logic.com">Sven Förster</a>
 */
public class Inverse extends GenericMethod {

	/**
	 * Creates an {@link Inverse}.
	 */
	protected Inverse(String name, SearchExpression[] arguments) {
		super(name, arguments);
	}

	@Override
	public GenericMethod copy(SearchExpression[] arguments) {
		return new Inverse(getName(), arguments);
	}

	@Override
	public TLType getType(List<TLType> argumentTypes) {
		return TlThreedCoreFactory.getTransformationType();
	}

	@Override
	protected Object eval(Object[] arguments, EvalContext definitions) {
		Object input = arguments[0];
		if (input == null) {
			return null;
		}
		return Compose.asTransformation(this, input).inverse();
	}

	/**
	 * {@link MethodBuilder} creating {@link Inverse}.
	 */
	public static final class Builder extends AbstractSimpleMethodBuilder<Inverse> {

		/** Creates a {@link Builder}. */
		public Builder(InstantiationContext context, Config<?> config) {
			super(context, config);
		}

		@Override
		public Inverse build(Expr expr, SearchExpression[] args) throws ConfigurationException {
			checkSingleArg(expr, args);

			return new Inverse(getConfig().getName(), args);
		}

	}

}
