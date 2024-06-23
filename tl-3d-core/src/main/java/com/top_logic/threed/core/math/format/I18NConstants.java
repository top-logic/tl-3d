/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.core.math.format;

import com.top_logic.basic.util.ResKey1;
import com.top_logic.layout.I18NConstantsBase;

/**
 * Messages for package.
 * 
 * @author <a href="mailto:sven.foerster@top-logic.com">Sven Förster</a>
 */
public class I18NConstants extends I18NConstantsBase {

	/**
	 * @en The value ''{0}'' is not an affine transformation.
	 */
	public static ResKey1 ERROR_IS_NOT_A_TRANSFORMATION__VALUE;

	static {
		initConstants(I18NConstants.class);
	}

}
