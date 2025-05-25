/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.component;

import com.top_logic.basic.config.InstantiationContext;
import com.top_logic.basic.config.annotation.defaults.ClassDefault;
import com.top_logic.basic.config.annotation.defaults.NullDefault;
import com.top_logic.basic.config.order.DisplayOrder;
import com.top_logic.layout.DisplayContext;
import com.top_logic.layout.basic.ThemeImage;
import com.top_logic.mig.html.layout.LayoutComponent;
import com.top_logic.tool.boundsec.CommandHandler;
import com.top_logic.tool.boundsec.commandhandlers.ToggleCommandHandler;

public class ToggleObjectVisibleCommand extends ToggleCommandHandler {
	@DisplayOrder({
		Config.RESOURCE_KEY_PROPERTY_NAME,
		Config.IMAGE_PROPERTY,
		Config.DISABLED_IMAGE_PROPERTY,
		Config.ACTIVE_IMAGE,
		Config.ACTIVE_CSS_CLASSES,
		Config.ACTIVE_RESOURCE_KEY,
		Config.CLIQUE_PROPERTY,
		Config.GROUP_PROPERTY,
		Config.TARGET,
		Config.EXECUTABILITY_PROPERTY,
		Config.CONFIRM_PROPERTY,
		Config.CONFIRM_MESSAGE,
		Config.SECURITY_OBJECT,
	})
	public interface Config extends ToggleCommandHandler.Config {
		@Override
		@ClassDefault(ToggleObjectVisibleCommand.class)
		Class<? extends CommandHandler> getImplementationClass();
	
		@NullDefault
		@Override
		public ThemeImage getDisabledImage();
	}

	/**
	 * Creates a {@link ToggleObjectVisibleCommand}.
	 */
	public ToggleObjectVisibleCommand(InstantiationContext context, Config config) {
		super(context, config);  
	}

    @Override
	protected boolean getState(LayoutComponent component) {
        // return true;
        return ((ThreeJsComponent) component).getIsObjectVisible();
	}

	@Override
	protected void setState(DisplayContext context, LayoutComponent component, boolean newValue) {
        ((ThreeJsComponent) component).toggleObjectVisibility(newValue);
	}
}
