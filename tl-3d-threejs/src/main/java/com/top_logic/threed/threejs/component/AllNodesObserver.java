/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.component;

import java.util.List;

import com.top_logic.threed.threejs.scene.GroupNode;
import com.top_logic.threed.threejs.scene.SceneNode;

import de.haumacher.msgbuf.observer.Listener;
import de.haumacher.msgbuf.observer.Observable;

/**
 * Listener that registers itself recursively at all {@link SceneNode}s the subtree it is added to.
 */
public class AllNodesObserver implements Listener {

	@SuppressWarnings("unchecked")
	@Override
	public void beforeSet(Observable obj, String property, Object value) {
		if (obj instanceof GroupNode) {
			switch (property) {
				case GroupNode.CONTENTS__PROP: {
					GroupNode group = (GroupNode) obj;
					group.getContents().forEach(this::unregisterRecursive);
					((List<? extends SceneNode>) value).forEach(this::registerRecursive);
				}
			}
		}
	}

	@Override
	public void beforeAdd(Observable obj, String property, int index, Object element) {
		if (obj instanceof GroupNode) {
			switch (property) {
				case GroupNode.CONTENTS__PROP: {
					registerRecursive((SceneNode) element);
				}
			}
		}
	}

	@Override
	public void beforeAdd(Observable obj, String property, Object index, Object element) {
		if (obj instanceof GroupNode) {
			switch (property) {
				case GroupNode.CONTENTS__PROP: {
					registerRecursive((SceneNode) element);
				}
			}
		}
	}

	/**
	 * Registers this listener at all nodes in the subtree started with the given node.
	 * 
	 * @see #unregisterRecursive(SceneNode)
	 */
	public void registerRecursive(SceneNode node) {
		node.registerListener(this);
		if (node instanceof GroupNode) {
			((GroupNode) node).getContents().forEach(this::registerRecursive);
		}
	}

	@Override
	public void afterRemove(Observable obj, String property, int index, Object element) {
		if (obj instanceof GroupNode) {
			switch (property) {
				case GroupNode.CONTENTS__PROP: {
					unregisterRecursive((SceneNode) element);
				}
			}
		}
	}

	@Override
	public void afterRemove(Observable obj, String property, Object index, Object element) {
		if (obj instanceof GroupNode) {
			switch (property) {
				case GroupNode.CONTENTS__PROP: {
					unregisterRecursive((SceneNode) element);
				}
			}
		}
	}

	/**
	 * unregisters this listener from all nodes in the subtree started with the given node.
	 * 
	 * @see #registerRecursive(SceneNode)
	 */
	public void unregisterRecursive(SceneNode node) {
		if (node instanceof GroupNode) {
			((GroupNode) node).getContents().forEach(this::unregisterRecursive);
		}
		node.unregisterListener(this);
	}

}
