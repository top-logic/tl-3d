/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.component;

import com.top_logic.basic.util.ResKey;
import com.top_logic.layout.I18NConstantsBase;

/**
 * Messages for package.
 * 
 * @author <a href="mailto:sven.foerster@top-logic.com">Sven Förster</a>
 */
public class I18NConstants extends I18NConstantsBase {

	/**
	 * @en The operation argument function was not called from within the specified preload
	 *     operation.
	 */
	public static ResKey ERROR_OPERATION_ARGUMENT_NOT_CALLED;

	static {
		initConstants(I18NConstants.class);
	}

}
