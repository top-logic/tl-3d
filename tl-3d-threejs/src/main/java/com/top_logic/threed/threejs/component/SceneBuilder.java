/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.component;

import java.util.Collection;
import java.util.Set;

import com.top_logic.mig.html.ModelBuilder;
import com.top_logic.mig.html.layout.LayoutComponent;
import com.top_logic.model.TLStructuredType;
import com.top_logic.threed.threejs.scene.GroupNode;
import com.top_logic.threed.threejs.scene.SceneNode;

/**
 * {@link ModelBuilder} for {@link ThreeJsComponent}s.
 */
public interface SceneBuilder extends ModelBuilder {

	@Override
	SceneNode getModel(Object businessModel, LayoutComponent aComponent);

	/**
	 * Builds a {@link SceneNode} subtree for the given business object for supporting incremental
	 * updates of the scene graph.
	 *
	 * @param businessModel
	 *        The business model of the {@link SceneNode} to build.
	 * @param component
	 *        The viewer component.
	 * @return The {@link SceneNode} for the given business model filled with all potential
	 *         sub-nodes.
	 */
	SceneNode createSubtree(Object businessModel, LayoutComponent component);

	/**
	 * Creates a {@link SceneNode} for the given business object without creating potential
	 * sub-nodes.
	 */
	SceneNode createNode(Object businessModel, LayoutComponent component);

	/**
	 * Resolves parts of the given business object (in case
	 * {@link #createNode(Object, LayoutComponent)}) produced an {@link GroupNode} for that object.
	 */
	Collection<?> resolveParts(Object businessModel, LayoutComponent component);

	/**
	 * The {@link TLStructuredType}s for which the scene needs to update itself.
	 * 
	 * @see LayoutComponent#getTypesToObserve()
	 */
	Set<TLStructuredType> getTypesToObserve();

	/**
	 * Whether the given business object is part of this scene.
	 * 
	 * @param contextComponent
	 *        The context component.
	 * @param object
	 *        Potential {@link SceneNode} business object.
	 */
	boolean supportsObject(LayoutComponent contextComponent, Object object);

	/**
	 * Returns the nodes to update if a given object changes.
	 */
	Collection<?> getNodesToUpdate(LayoutComponent contextComponent, Object businessObject);

}
