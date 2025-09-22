/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.script;

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
import com.top_logic.threed.core.math.Transformation;
import com.top_logic.threed.core.math.TransformationUtil;
import com.top_logic.threed.core.math.script.TransformationConstructor;
import com.top_logic.threed.threejs.scene.ConnectionPoint;
import com.top_logic.util.error.TopLogicException;

/**
 * Creates a {@link ConnectionPoint}.
 */
public class ThreejsCp extends GenericMethod {

	/**
	 * Synthetic classifier for {@link ConnectionPoint} which are created from a
	 * {@link Transformation}.
	 */
	public static final String EMPTY_CLASSIFIER = "__empty__";

	/**
	 * Creates a {@link ThreejsGltf} method.
	 */
	protected ThreejsCp(String name, SearchExpression[] arguments) {
		super(name, arguments);
	}

	@Override
	public GenericMethod copy(SearchExpression[] arguments) {
		return new ThreejsCp(getName(), arguments);
	}

	@Override
	public TLType getType(List<TLType> argumentTypes) {
		return null;
	}

	@Override
	protected Object eval(Object[] arguments, EvalContext definitions) {
		Transformation tx = TransformationConstructor.asTx(getArguments()[0], arguments[0]);
		return newConnectionPoint(tx, getArguments()[1], arguments[1]);
	}

	/**
	 * Creates a {@link ConnectionPoint} from the given {@link Transformation} and classifiers.
	 */
	public static ConnectionPoint newConnectionPoint(Transformation tx, SearchExpression classifiersExpr,
			Object classifiers) {
		ConnectionPoint cp = ConnectionPoint.create();
		cp.setTransform(TransformationUtil.toList(tx));
		List<?> classifiersList = asList(classifiers);
		if (classifiersList.isEmpty()) {
			cp.addClassifier(EMPTY_CLASSIFIER);
		} else {
			for (Object classifier : classifiersList) {
				cp.addClassifier(classifiersExpr.asString(classifier));
			}
		}
		return cp;
	}

	/**
	 * Transforms the given object to a {@link ConnectionPoint} if possible.
	 */
	public static ConnectionPoint asConnectionPoint(SearchExpression self, Object object) {
		if (object == null) {
			return null;
		}
		if (object instanceof ConnectionPoint) {
			return (ConnectionPoint) object;
		}
		throw new TopLogicException(I18NConstants.ERROR_CONNECTION_POINT_EXPECTED__ACTUAL_EXPR
			.fill(object.getClass().getName(), self));
	}

	/**
	 * Factory for {@link ThreejsGltf} methods.
	 */
	public static final class Builder extends AbstractSimpleMethodBuilder<ThreejsCp> {

		private static final ArgumentDescriptor DESCRIPTOR = ArgumentDescriptor.builder()
			.mandatory("tx")
			.optional("classifiers")
			.build();

		/**
		 * Creates a {@link Builder}.
		 */
		public Builder(InstantiationContext context, Config<?> config) {
			super(context, config);
		}

		@Override
		public ArgumentDescriptor descriptor() {
			return Builder.DESCRIPTOR;
		}

		@Override
		public ThreejsCp build(Expr expr, SearchExpression[] args)
				throws ConfigurationException {
			return new ThreejsCp(getConfig().getName(), args);
		}

	}

}
