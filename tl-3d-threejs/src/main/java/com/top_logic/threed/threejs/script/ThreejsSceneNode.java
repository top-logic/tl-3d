/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.script;

import java.util.Collections;
import java.util.List;

import com.top_logic.model.TLType;
import com.top_logic.model.search.expr.EvalContext;
import com.top_logic.model.search.expr.GenericMethod;
import com.top_logic.model.search.expr.SearchExpression;
import com.top_logic.threed.core.math.Transformation;
import com.top_logic.threed.core.math.script.TransformationConstructor;
import com.top_logic.threed.threejs.scene.ConnectionPoint;
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

		ConnectionPoint layoutPoint = toConnectionPoint(getArguments()[1], arguments[1]);
		node.setLayoutPoint(layoutPoint);

		List<ConnectionPoint> snappingPoints = toConnectionPointList(getArguments()[2], arguments[2]);
		node.setSnappingPoints(snappingPoints);

		Object userData = arguments[3];
		node.setUserData(userData);
		return node;
	}

	private List<ConnectionPoint> toConnectionPointList(SearchExpression expr, Object value) {
		List<?> valueList = asList(value);
		return valueList.stream().map(v -> toConnectionPointNonNull(expr, v)).toList();
	}

	private ConnectionPoint toConnectionPointNonNull(SearchExpression expr, Object value) {
		return notNull(expr, toConnectionPoint(expr, value));
	}

	private ConnectionPoint toConnectionPoint(SearchExpression expr, Object value) {
		if (value instanceof ConnectionPoint) {
			return (ConnectionPoint) value;
		}
		if (value == null) {
			return null;
		}
		Transformation tx = TransformationConstructor.asTx(expr, value);
		return ThreejsCp.newConnectionPoint(tx, this, Collections.emptyList());
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
