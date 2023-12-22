/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.threejs.component;

import com.top_logic.mig.html.layout.LayoutComponent;
import com.top_logic.tl3d.threejs.scene.SceneGraph;

/**
 * {@link SceneBuilder} that can be parameterized with TL-Script.
 */
public class SceneBuilderByExpression implements SceneBuilder {

	@Override
	public boolean supportsModel(Object aModel, LayoutComponent aComponent) {
		return true;
	}

	@Override
	public SceneGraph getModel(Object businessModel, LayoutComponent aComponent) {
		return null;
	}

}
