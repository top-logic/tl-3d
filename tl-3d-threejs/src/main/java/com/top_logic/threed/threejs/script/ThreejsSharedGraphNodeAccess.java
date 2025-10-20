/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
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

import de.haumacher.msgbuf.graph.AbstractSharedGraphNode;

/**
 * {@link GenericMethod} to access fields of a {@link ThreejsSharedGraphNodeAccess}.
 */
public class ThreejsSharedGraphNodeAccess extends GenericMethod {

	/**
	 * Creates a {@link ThreejsSharedGraphNodeAccess}.
	 */
	protected ThreejsSharedGraphNodeAccess(String name, SearchExpression[] arguments) {
		super(name, arguments);
	}

	@Override
	public TLType getType(List<TLType> argumentTypes) {
		return null;
	}

	@Override
	public GenericMethod copy(SearchExpression[] arguments) {
		return new ThreejsSharedGraphNodeAccess(getName(), arguments);
	}

	@Override
	protected Object eval(Object[] arguments, EvalContext definitions) {
		AbstractSharedGraphNode object = (AbstractSharedGraphNode) arguments[0];
		String property = asString(arguments[1]);
		return object.get(property);
	}

	@Override
	public boolean canEvaluateAtCompileTime(Object[] arguments) {
		return false;
	}

	/**
	 * Factory for {@link ThreejsSharedGraphNodeAccess} methods.
	 */
	public static final class Builder extends AbstractSimpleMethodBuilder<ThreejsSharedGraphNodeAccess> {

		private static final ArgumentDescriptor DESCRIPTOR = ArgumentDescriptor.builder()
			.mandatory("object")
			.mandatory("property")
			.build();

		/**
		 * Creates a {@link Builder}.
		 */
		public Builder(InstantiationContext context, Config<?> config) {
			super(context, config);
		}

		@Override
		public ArgumentDescriptor descriptor() {
			return DESCRIPTOR;
		}

		@Override
		public ThreejsSharedGraphNodeAccess build(Expr expr, SearchExpression[] args)
				throws ConfigurationException {
			return new ThreejsSharedGraphNodeAccess(getConfig().getName(), args);
		}

	}
}
