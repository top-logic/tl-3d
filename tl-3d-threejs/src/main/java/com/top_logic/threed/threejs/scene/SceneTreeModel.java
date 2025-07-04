/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.scene;

import java.util.Collections;
import java.util.List;

import com.top_logic.layout.tree.model.AbstractTreeModel;

/**
 * {@link AbstractTreeModel} with the natural tree structure of {@link SceneNode}s.
 * 
 * @author <a href="mailto:daniel.busche@top-logic.com">Daniel Busche</a>
 */
public class SceneTreeModel extends AbstractTreeModel<SceneNode> {

	private final SceneNode _root;

	/**
	 * Creates a {@link SceneTreeModel}.
	 */
	public SceneTreeModel(SceneNode root) {
		_root = root;
	}

	@Override
	public Object getBusinessObject(SceneNode node) {
		return node.getUserData();
	}

	@Override
	public SceneNode getRoot() {
		return _root;
	}

	@Override
	public List<? extends SceneNode> getChildren(SceneNode parent) {
		if (parent instanceof GroupNode) {
			return ((GroupNode) parent).getContents();
		}
		return Collections.emptyList();
	}

	@Override
	public boolean childrenInitialized(SceneNode parent) {
		return true;
	}

	@Override
	public void resetChildren(SceneNode parent) {
		// nothing to do here
	}

	@Override
	public boolean isLeaf(SceneNode node) {
		return !(node instanceof GroupNode);
	}

	@Override
	public boolean isFinite() {
		return true;
	}

	@Override
	public SceneNode getParent(SceneNode node) {
		if (node == _root) {
			return null;
		}
		return (SceneNode) node.getParent();
	}

}
