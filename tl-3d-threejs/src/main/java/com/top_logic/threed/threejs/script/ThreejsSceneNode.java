/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.script;

import java.awt.Color;
import java.util.List;

import com.top_logic.layout.form.format.ColorFormat;
import com.top_logic.model.TLType;
import com.top_logic.model.search.expr.EvalContext;
import com.top_logic.model.search.expr.GenericMethod;
import com.top_logic.model.search.expr.SearchExpression;
import com.top_logic.threed.core.math.Transformation;
import com.top_logic.threed.core.math.TransformationUtil;
import com.top_logic.threed.core.math.script.TransformationConstructor;
import com.top_logic.threed.threejs.scene.SceneNode;
import com.top_logic.util.error.TopLogicException;

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

		Transformation transform = asTransformation(getArguments()[0], arguments[0]);
		if (transform != null) {
			node.setTransform(TransformationUtil.toList(transform));
		}

		Object userData = arguments[1];
		node.setUserData(userData);

		Boolean isHidden = asBoolean(arguments[2]);
		node.setHidden(isHidden.booleanValue());

		Color color = asColor(getArguments()[3], arguments[3]);
		if (color != null) {
			node.setColor(ColorFormat.formatColor(color));
		}
		return node;
	}

	/**
	 * Transforms the given script value as {@link Color}.
	 * 
	 * @see SceneNode#getColor()
	 */
	protected Color asColor(SearchExpression expr, Object value) {
		Color color;
		if (value == null) {
			color = null;
		} else if (value instanceof Color) {
			color = (Color) value;
		} else if (value instanceof String) {
			String colorString = (String) value;
			if (colorString.isBlank()) {
				color = null;
			} else {
				try {
					// Check whether string has correct format.
					color = ColorFormat.parseColor(colorString);
				} catch (RuntimeException ex) {
					throw new TopLogicException(
						I18NConstants.ERROR_INVALID_COLOR__ACTUAL_EXPR.fill(colorString, expr),
						ex);
				}
			}
		} else {
			throw new TopLogicException(I18NConstants.ERROR_INVALID_COLOR__ACTUAL_EXPR.fill(value, expr));
		}
		return color;
	}

	/**
	 * Transforms the given script value as {@link Transformation}.
	 * 
	 * @see SceneNode#getTransform()
	 */
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
