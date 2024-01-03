/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.threejs.script;

import java.util.Arrays;
import java.util.Collection;
import java.util.Iterator;
import java.util.List;

import com.top_logic.basic.config.ConfigurationException;
import com.top_logic.basic.config.InstantiationContext;
import com.top_logic.model.TLType;
import com.top_logic.model.search.expr.EvalContext;
import com.top_logic.model.search.expr.GenericMethod;
import com.top_logic.model.search.expr.SearchExpression;
import com.top_logic.model.search.expr.config.dom.Expr;
import com.top_logic.model.search.expr.config.operations.AbstractSimpleMethodBuilder;
import com.top_logic.model.search.expr.config.operations.ArgumentDescriptor;
import com.top_logic.tl3d.math.Transformation;
import com.top_logic.util.error.TopLogicException;

/**
 * TL-Script constuructor function for {@link Transformation}s.
 */
public class TransformationConstructor extends GenericMethod {

	/**
	 * Creates a {@link TransformationConstructor}.
	 */
	protected TransformationConstructor(String name, SearchExpression[] arguments) {
		super(name, arguments);
	}

	@Override
	public GenericMethod copy(SearchExpression[] arguments) {
		return new TransformationConstructor(getName(), arguments);
	}

	@Override
	public TLType getType(List<TLType> argumentTypes) {
		return null;
	}

	@Override
	protected Object eval(Object[] arguments, EvalContext definitions) {
		return asTx(this, Arrays.asList(arguments));
	}

	/**
	 * Converts the given object to a {@link Transformation}.
	 */
	public static Transformation asTx(SearchExpression self, Object object) {
		if (object == null) {
			return null;
		} else if (object instanceof Transformation) {
			return (Transformation) object;
		} else if (object instanceof Collection<?>) {
			return asTx(self, (Collection<?>) object);
		} else if (object instanceof CharSequence) {
			String str = object.toString().trim();
			if (str.isEmpty()) {
				return null;
			}
			return TxParser.parseTx(str);
		} else {
			throw new TopLogicException(I18NConstants.ERROR_TRANSFORMATION_EXPECTED__ACTUAL_EXPR
				.fill(object.getClass().getName(), self));
		}
	}

	private static Transformation asTx(SearchExpression self, Collection<?> coll) {
		Iterator<?> it = coll.iterator();

		switch (coll.size()) {
			case 3: {
				double x = asDouble(self, it.next());
				double y = asDouble(self, it.next());
				double z = asDouble(self, it.next());
				return Transformation.translate(x, y, z);
			}
			case 9: {
				double a = asDouble(self, it.next());
				double b = asDouble(self, it.next());
				double c = asDouble(self, it.next());
				double d = asDouble(self, it.next());
				double e = asDouble(self, it.next());
				double f = asDouble(self, it.next());
				double g = asDouble(self, it.next());
				double h = asDouble(self, it.next());
				double i = asDouble(self, it.next());
				return new Transformation(
					a, b, c,
					d, e, f,
					g, h, i,
					0, 0, 0);
			}
			case 12: {
				double a = asDouble(self, it.next());
				double b = asDouble(self, it.next());
				double c = asDouble(self, it.next());
				double d = asDouble(self, it.next());
				double e = asDouble(self, it.next());
				double f = asDouble(self, it.next());
				double g = asDouble(self, it.next());
				double h = asDouble(self, it.next());
				double i = asDouble(self, it.next());
				double x = asDouble(self, it.next());
				double y = asDouble(self, it.next());
				double z = asDouble(self, it.next());
				return new Transformation(
					a, b, c,
					d, e, f,
					g, h, i,
					x, y, z);
			}
		}

		throw new TopLogicException(
			I18NConstants.ERROR_INVALID_NUMBER_OF_TRANSFORMATION_ARGUMENTS__ACTUAL.fill(coll.size()));
	}

	/**
	 * Factory for {@link TransformationConstructor} methods.
	 */
	public static final class Builder extends AbstractSimpleMethodBuilder<TransformationConstructor> {

		private static final ArgumentDescriptor DESCRIPTOR = ArgumentDescriptor.builder()
			.optional("a", 1)
			.optional("b", 0)
			.optional("c", 0)

			.optional("d", 0)
			.optional("e", 1)
			.optional("f", 0)

			.optional("g", 0)
			.optional("h", 0)
			.optional("i", 1)

			.optional("x", 0)
			.optional("y", 0)
			.optional("z", 0)
			.build();

		/**
		 * Creates a {@link Builder}.
		 */
		public Builder(InstantiationContext context, Config<?> config) {
			super(context, config);
		}

		@Override
		public ArgumentDescriptor descriptor() {
			return TransformationConstructor.Builder.DESCRIPTOR;
		}

		@Override
		public TransformationConstructor build(Expr expr, SearchExpression[] args)
				throws ConfigurationException {
			return new TransformationConstructor(getConfig().getName(), args);
		}

	}

}
