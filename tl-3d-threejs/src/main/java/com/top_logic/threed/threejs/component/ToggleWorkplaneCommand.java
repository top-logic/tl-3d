/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.component;

import com.top_logic.basic.config.InstantiationContext;
import com.top_logic.basic.config.annotation.defaults.ClassDefault;
import com.top_logic.basic.config.annotation.defaults.NullDefault;
import com.top_logic.layout.DisplayContext;
import com.top_logic.layout.basic.ThemeImage;
import com.top_logic.mig.html.layout.LayoutComponent;
import com.top_logic.tool.boundsec.CommandHandler;
import com.top_logic.tool.boundsec.commandhandlers.ToggleCommandHandler;

/**
 * Command to toggle visibility of workplane.
 */
public class ToggleWorkplaneCommand extends ToggleCommandHandler {

	/**
	 * Configuration of a {@link ToggleWorkplaneCommand}.
	 */
	public interface Config extends ToggleCommandHandler.Config {
		@Override
		@ClassDefault(ToggleWorkplaneCommand.class)
		Class<? extends CommandHandler> getImplementationClass();
	
		@NullDefault
		@Override
		public ThemeImage getDisabledImage();
	}

	/**
	 * Creates a {@link ToggleWorkplaneCommand}.
	 */
	public ToggleWorkplaneCommand(InstantiationContext context, Config config) {
		super(context, config);  
	}

    @Override
	protected boolean getState(LayoutComponent component) {
        return ((ThreeJsComponent) component).getIsWorkplaneVisible();
	}

	@Override
	protected void setState(DisplayContext context, LayoutComponent component, boolean newValue) {
        ((ThreeJsComponent) component).setIsWorkplaneVisible(newValue);
	}
}
