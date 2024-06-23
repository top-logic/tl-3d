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
import com.top_logic.model.search.expr.I18NConstants;
import com.top_logic.model.search.expr.SearchExpression;
import com.top_logic.model.search.expr.config.dom.Expr;
import com.top_logic.model.search.expr.config.operations.AbstractSimpleMethodBuilder;
import com.top_logic.model.search.expr.config.operations.MethodBuilder;
import com.top_logic.model.util.TLModelUtil;
import com.top_logic.threed.core.math.Transformation;
import com.top_logic.util.error.TopLogicException;

/**
 * {@link SearchExpression} creating a new transformation matrix by composing two given
 * transformation matrices.
 * 
 * @author <a href="mailto:sven.foerster@top-logic.com">Sven Förster</a>
 */
public class Compose extends GenericMethod {

	/**
	 * Creates an {@link Compose}.
	 */
	protected Compose(String name, SearchExpression[] arguments) {
		super(name, arguments);
	}

	@Override
	public GenericMethod copy(SearchExpression[] arguments) {
		return new Compose(getName(), arguments);
	}

	@Override
	public TLType getType(List<TLType> argumentTypes) {
		return TLModelUtil.findType("tl.uber3d:Transformation");
	}

	@Override
	protected Object eval(Object[] arguments, EvalContext definitions) {
		Object first = arguments[0];
		Object second = arguments[1];
		if (first == null) {
			return second;
		}
		if (second == null) {
			return first;
		}
		Transformation firstTransformation = asTransformation(first);
		Transformation secondTransformation = asTransformation(second);

		return firstTransformation.after(secondTransformation);
	}

	private Transformation asTransformation(Object value) {
		return asTransformation(this, value);
	}

	/**
	 * Converts the given value to an <code>Transformation</code> value.
	 */
	public static Transformation asTransformation(SearchExpression context, Object value) {
		value = asSingleElement(context, value);

		if (value instanceof Transformation) {
			return (Transformation) value;
		} else {
			throw new TopLogicException(I18NConstants.ERROR_NUMBER_REQUIRED__VALUE_EXPR.fill(value, context));
		}
	}

	/**
	 * {@link MethodBuilder} creating {@link Compose}.
	 */
	public static final class Builder extends AbstractSimpleMethodBuilder<Compose> {

		/** Creates a {@link Builder}. */
		public Builder(InstantiationContext context, Config<?> config) {
			super(context, config);
		}

		@Override
		public Compose build(Expr expr, SearchExpression[] args) throws ConfigurationException {
			checkTwoArgs(expr, args);

			return new Compose(getConfig().getName(), args);
		}

	}

}