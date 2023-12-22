/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.threejs.component;

import com.top_logic.mig.html.ModelBuilder;
import com.top_logic.mig.html.layout.LayoutComponent;
import com.top_logic.tl3d.threejs.scene.SceneGraph;

/**
 * {@link ModelBuilder} for {@link ThreeJsComponent}s.
 */
public interface SceneBuilder extends ModelBuilder {

	@Override
	SceneGraph getModel(Object businessModel, LayoutComponent aComponent);

}
