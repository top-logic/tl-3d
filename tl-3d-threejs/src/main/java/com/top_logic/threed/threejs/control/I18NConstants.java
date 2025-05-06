/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.control;

import com.top_logic.basic.util.ResKey;
import com.top_logic.layout.I18NConstantsBase;
import com.top_logic.layout.ResPrefix;
import com.top_logic.layout.form.model.FormContext;

/**
 * I18N of this package.
 */
public class I18NConstants extends I18NConstantsBase {

	/** @en Apply scene changes. */
	public static ResKey APPLY_SCENE_CHANGES;

	/** @en X */
	public static ResKey TRANSLATE_X_LABEL;

	/** @en Y */
	public static ResKey TRANSLATE_Y_LABEL;

	/** @en Z */
	public static ResKey TRANSLATE_Z_LABEL;

	/** @en X (°) */
	public static ResKey ROTATE_X_LABEL;

	/** @en Y (°) */
	public static ResKey ROTATE_Y_LABEL;

	/** @en Z (°) */
	public static ResKey ROTATE_Z_LABEL;

	/**
	 * Prefix for the {@link FormContext} used by the {@link GizmoControl}.
	 */
	public static ResPrefix GIZMO_FORM_CTX;

    static {
        initConstants(I18NConstants.class);
    }

}
