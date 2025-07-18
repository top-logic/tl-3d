/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.scene;

import java.awt.Color;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.function.Consumer;

import com.top_logic.basic.StringServices;
import com.top_logic.layout.form.format.ColorFormat;
import com.top_logic.threed.core.math.Transformation;
import com.top_logic.threed.core.math.TransformationUtil;

/**
 * Service class to work with scene objects.
 * 
 * @author <a href="mailto:daniel.busche@top-logic.com">Daniel Busche</a>
 */
public class SceneUtils {

	/**
	 * {@link SceneNode} visitor that applies a given consumer to each node in the subtree with the
	 * visited node as root node.
	 * 
	 * @author <a href="mailto:daniel.busche@top-logic.com">Daniel Busche</a>
	 */
	public static class ForAllNodes
			implements SceneNode.Visitor<Void, Consumer<? super SceneNode>, RuntimeException> {

		/** Singleton {@link SceneUtils.ForAllNodes} instance. */
		public static final SceneUtils.ForAllNodes INSTANCE = new SceneUtils.ForAllNodes();

		/**
		 * Creates a new {@link SceneUtils.ForAllNodes}.
		 */
		protected ForAllNodes() {
			// singleton instance
		}

		@Override
		public Void visit(GroupNode self, Consumer<? super SceneNode> arg) throws RuntimeException {
			arg.accept(self);
			self.getContents().forEach(content -> content.visit(this, arg));
			return null;
		}

		@Override
		public Void visit(PartNode self, Consumer<? super SceneNode> arg) throws RuntimeException {
			arg.accept(self);
			return null;
		}

	}

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

	/**
	 * Adds all nodes from the graph to the given collection.
	 */
	public static <T extends Collection<? super SceneNode>> T collectAllNodes(SceneGraph graph, T out) {
		SceneNode root = graph.getRoot();
		if (root != null) {
			root.visit(ForAllNodes.INSTANCE, out::add);
		}
		return out;
	}

	/**
	 * Sets the given {@link Color} to the given node.
	 *
	 * @param color
	 *        New color for the node. May be <code>null</code>.
	 */
	public static void setColor(SceneNode node, Color color) {
		String colorString = color == null ? StringServices.EMPTY_STRING : ColorFormat.formatColor(color);
		if (!colorString.equals(node.getColor())) {
			node.setColor(colorString);
		}
	}
}
