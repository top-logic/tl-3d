/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.component;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

import com.top_logic.mig.html.layout.LayoutComponent;
import com.top_logic.threed.threejs.scene.GroupNode;
import com.top_logic.threed.threejs.scene.SceneNode;

/**
 * Base class for {@link SceneBuilder}s.
 */
public abstract class AbstractSceneBuilder implements SceneBuilder {

	@Override
	public SceneNode createSubtree(Object businessModel, LayoutComponent component) {
		return new BatchProcessor(component).createSubtree(businessModel);
	}

	private class BatchProcessor implements Runnable {
		private final LayoutComponent _component;

		/**
		 * The list of pending nodes that must be initialized during the next batch.
		 */
		private List<GroupNode> _worklist = new ArrayList<>();

		/**
		 * The list of nodes currently being initialized.
		 */
		private List<GroupNode> _processing;

		/**
		 * The parts of the corresponding node in {@link #_processing} with the same index.
		 * 
		 * <p>
		 * Before scene nodes are created from those parts, a batch preload is performed on the list
		 * of all parts of the currently processed nodes.
		 * </p>
		 */
		private List<Collection<?>> _processingParts = new ArrayList<>();

		/**
		 * Creates a {@link BatchProcessor}.
		 */
		public BatchProcessor(LayoutComponent component) {
			_component = component;
		}

		public SceneNode createSubtree(Object businessModel) {
			// Startup, put root node into work list.
			SceneNode result = toNode(businessModel);

			// Second buffer for creating a new work list while nodes from the previous one are
			// processed.
			List<GroupNode> swap = new ArrayList<>();

			List<Object> batch = new ArrayList<>();

			// Process layers in bulk operation, could even be parallelized.
			while (!_worklist.isEmpty()) {
				_processing = _worklist;
				_worklist = swap;

				for (GroupNode node : _processing) {
					Object userData = node.getUserData();
					Collection<?> parts;
					if (userData == null) {
						parts = Collections.emptyList();
					} else {
						parts = resolveParts(userData, _component);
						batch.addAll(parts);
					}
					_processingParts.add(parts);
				}
				if (batch.size() > 4) {
					preload(batch, this);
				} else {
					run();
				}
				batch.clear();

				// Reuse memory for next batch.
				swap = _processing;
				swap.clear();

				_processingParts.clear();
			}

			return result;
		}

		@Override
		public void run() {
			int n = 0;
			for (GroupNode group : _processing) {
				Collection<?> parts = _processingParts.get(n++);
				if (parts.isEmpty()) {
					continue;
				}
				Collection<SceneNode> newChildren =
					parts.stream()
						.map(this::toNode)
						.filter(Objects::nonNull)
						.toList();
				group.getContents().addAll(newChildren);
			}
		}

		private SceneNode toNode(Object businessModel) {
			SceneNode result = createNode(businessModel, _component);

			if (result instanceof GroupNode) {
				GroupNode group = (GroupNode) result;

				_worklist.add(group);
			}

			return result;
		}
	}

	/**
	 * Fills caches for the given business objects so that a following
	 * {@link #createNode(Object, LayoutComponent)} and
	 * {@link #resolveParts(Object, LayoutComponent)} operation on those objects do not need further
	 * database access.
	 * 
	 * @param businessModels
	 *        The object to perform the preload on.
	 * @param job
	 *        The job to invoke while the caches are pinned.
	 */
	protected abstract void preload(List<Object> businessModels, Runnable job);

}
