/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.script;

import java.util.List;

import com.top_logic.model.TLType;
import com.top_logic.model.search.expr.EvalContext;
import com.top_logic.model.search.expr.GenericMethod;
import com.top_logic.model.search.expr.SearchExpression;
import com.top_logic.threed.core.math.Transformation;
import com.top_logic.threed.core.math.TransformationUtil;
import com.top_logic.threed.core.math.script.TransformationConstructor;
import com.top_logic.threed.threejs.scene.SceneNode;

/**
 * Base class for TL-Script {@link SceneNode} constructor functions.
 */
public abstract class ThreejsSceneNode<T extends SceneNode> extends GenericMethod {

	/**
	 * Creates a {@link ThreejsSceneNode}.
	 */
	protected ThreejsSceneNode(String name, SearchExpression[] arguments) {
		super(name, arguments);
	}

	@Override
	public TLType getType(List<TLType> argumentTypes) {
		return null;
	}

	@Override
	protected Object eval(Object[] arguments, EvalContext definitions) {
		return createNode(arguments);
	}

	/**
	 * Allocates the nodes and fills its properties.
	 */
	protected T createNode(Object[] arguments) {
		T node = allocate();

		Transformation transform = asTransformation(getArguments()[1], arguments[1]);
		if (transform != null) {
			node.setTransform(TransformationUtil.toList(transform));
		}

		Object userData = arguments[2];
		node.setUserData(userData);
		return node;
	}

	protected Transformation asTransformation(SearchExpression expr, Object value) {
		Transformation tx;
		if (value == null) {
			tx = null;
		} else {
			tx = TransformationConstructor.asTx(expr, value);
		}
		return tx;
	}

	/**
	 * Just calls the node constructor.
	 */
	protected abstract T allocate();

	@Override
	public boolean canEvaluateAtCompileTime(Object[] arguments) {
		return false;
	}

}
