/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.core.math.script;

import com.top_logic.basic.util.ResKey1;
import com.top_logic.basic.util.ResKey2;
import com.top_logic.layout.I18NConstantsBase;

/**
 * Internationalizations of this package.
 */
public class I18NConstants extends I18NConstantsBase {

	/**
	 * @en Expected a transformation, received {0} in expression: {1}
	 */
	public static ResKey2 ERROR_TRANSFORMATION_EXPECTED__ACTUAL_EXPR;

	/**
	 * @en A transformation expects either 3, 9, or 12 numbers, actually received {0}.
	 */
	public static ResKey1 ERROR_INVALID_NUMBER_OF_TRANSFORMATION_ARGUMENTS__ACTUAL;

	static {
		initConstants(I18NConstants.class);
	}

}
