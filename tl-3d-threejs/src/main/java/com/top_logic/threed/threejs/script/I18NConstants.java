/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.script;

import com.top_logic.basic.util.ResKey2;
import com.top_logic.layout.I18NConstantsBase;

/**
 * Internationalizations of this package.
 */
public class I18NConstants extends I18NConstantsBase {

	/**
	 * @en A connection point is expected. Received ''{0}'' in expression: {1}
	 */
	public static ResKey2 ERROR_CONNECTION_POINT_EXPECTED__ACTUAL_EXPR;

	/**
	 * @en A color is expected. Received ''{0}'' in expression: {1}
	 */
	public static ResKey2 ERROR_INVALID_COLOR__ACTUAL_EXPR;

	static {
		initConstants(I18NConstants.class);
	}

}
