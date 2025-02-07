/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.component;

import java.util.Map;

import com.top_logic.basic.config.InstantiationContext;
import com.top_logic.layout.DisplayContext;
import com.top_logic.mig.html.layout.LayoutComponent;
import com.top_logic.tool.boundsec.AbstractCommandHandler;
import com.top_logic.tool.boundsec.HandlerResult;

/**
 * Command that zooms to the current selection in the 3D viewer.
 */
public class ZoomOutFromSelectionCommand extends AbstractCommandHandler {

	/**
	 * Creates a {@link ZoomToSelectionCommand}.
	 */
	public ZoomOutFromSelectionCommand(InstantiationContext context, Config config) {
		super(context, config);
	}

	@Override
	public HandlerResult handleCommand(DisplayContext aContext, LayoutComponent aComponent, Object model,
			Map<String, Object> someArguments) {

		((ThreeJsComponent) aComponent).zoomOutFromSelection();

		return HandlerResult.DEFAULT_RESULT;
	}

}
