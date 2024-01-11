/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.threejs.script;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import com.top_logic.model.TLType;
import com.top_logic.model.search.expr.EvalContext;
import com.top_logic.model.search.expr.GenericMethod;
import com.top_logic.model.search.expr.SearchExpression;
import com.top_logic.tl3d.math.Transformation;
import com.top_logic.tl3d.threejs.scene.SceneNode;

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
		Transformation tx = TransformationConstructor.asTx(getArguments()[1], arguments[1]);
		Object userData = arguments[2];

		T node = allocate();
		node.setTransform(asTx(tx));
		node.setUserData(userData);
		return node;
	}

	private static List<Float> asTx(Transformation tx) {
		if (tx == null) {
			return Collections.emptyList();
		}
		return Arrays.asList(
			(float) tx.a(), (float) tx.b(), (float) tx.c(),
			(float) tx.d(), (float) tx.e(), (float) tx.f(),
			(float) tx.g(), (float) tx.h(), (float) tx.i(),
			(float) tx.x(), (float) tx.y(), (float) tx.z());
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
