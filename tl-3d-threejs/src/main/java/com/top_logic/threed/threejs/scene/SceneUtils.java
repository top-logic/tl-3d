/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.scene;

import java.util.Collections;
import java.util.List;

import com.top_logic.threed.core.math.Transformation;
import com.top_logic.threed.core.math.TransformationUtil;

/**
 * Service class to work with scene objects.
 * 
 * @author <a href="mailto:daniel.busche@top-logic.com">Daniel Busche</a>
 */
public class SceneUtils {

	/**
	 * Sets the given {@link Transformation} to the given node.
	 *
	 * @param node
	 *        {@link SceneNode} to set transformation to.
	 * @param tx
	 *        The {@link Transformation} to set. May be <code>null</code>.
	 */
	public static void setTransform(SceneNode node, Transformation tx) {
		if (tx == null) {
			node.setTransform(Collections.emptyList());
		} else {
			node.setTransform(TransformationUtil.toList(tx));
		}
	}

	/**
	 * Determines the {@link Transformation} for the given node.
	 *
	 * @param node
	 *        The {@link SceneNode} to get {@link Transformation} for.
	 */
	public static Transformation getTransform(SceneNode node) {
		List<Double> transform = node.getTransform();
		switch (transform.size()) {
			case 0:
				return null;
			case 12:
				return TransformationUtil.fromList(transform);
			default:
				throw new IllegalStateException(
					"SceneNode " + node + " must have a transform list with 12 entries: " + node.getTransform());
		}
	}

	/**
	 * Determines the absolute {@link Transformation} for the given {@link ScenePart}.
	 *
	 * @param part
	 *        The part to get {@link Transformation} for.
	 */
	public static Transformation getAbsoluteTransformation(ScenePart part) {
		Transformation tx = Transformation.identity();

		ScenePart current = part;
		while (current != null) {
			Transformation localTx;
			if (current instanceof SceneNode node) {
				localTx = getTransform(node);
			} else {
				localTx = null;
			}
			if (localTx != null) {
				tx = localTx.after(tx);
			}
			current = current.getParent();
		}

		return tx;
	}

	/**
	 * Sets the given {@link Transformation} as {@link SceneGraph#getCoordinateSystem()}.
	 *
	 * @param graph
	 *        {@link SceneGraph} to set coordinate system to.
	 * @param tx
	 *        The {@link Transformation} to set. May be <code>null</code>.
	 */
	public static void setCoordinateSystem(SceneGraph graph, Transformation tx) {
		if (tx == null) {
			graph.setCoordinateSystem(Collections.emptyList());
		} else {
			graph.setCoordinateSystem(TransformationUtil.toList(tx));
		}
	}
}
