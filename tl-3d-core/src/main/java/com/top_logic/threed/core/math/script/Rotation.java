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
import com.top_logic.threed.core.math.Transformation;
import com.top_logic.threed.core.model.TlThreedCoreFactory;

/**
 * {@link SearchExpression} creating a rotation transformation matrix around an given angle on the
 * x, y and z axis.
 * 
 * @author <a href="mailto:sven.foerster@top-logic.com">Sven Förster</a>
 */
public class Rotation extends GenericMethod {

	/**
	 * Creates an {@link Rotation}.
	 */
	protected Rotation(String name, SearchExpression[] arguments) {
		super(name, arguments);
	}

	@Override
	public GenericMethod copy(SearchExpression[] arguments) {
		return new Rotation(getName(), arguments);
	}

	@Override
	public TLType getType(List<TLType> argumentTypes) {
		return TlThreedCoreFactory.getTransformationType();
	}

	@Override
	protected Object eval(Object[] arguments, EvalContext definitions) {
		double xAngle = asDouble(arguments[0]);
		double yAngle = asDouble(arguments[1]);
		double zAngle = asDouble(arguments[2]);

		return Transformation.rotateX(xAngle)
			.after(Transformation.rotateY(yAngle))
			.after(Transformation.rotateZ(zAngle));
	}

	/**
	 * {@link MethodBuilder} creating {@link Rotation}.
	 */
	public static final class Builder extends AbstractSimpleMethodBuilder<Rotation> {

		/** Creates a {@link Builder}. */
		public Builder(InstantiationContext context, Config<?> config) {
			super(context, config);
		}

		@Override
		public Rotation build(Expr expr, SearchExpression[] args) throws ConfigurationException {
			checkThreeArgs(expr, args);

			return new Rotation(getConfig().getName(), args);
		}

	}

}