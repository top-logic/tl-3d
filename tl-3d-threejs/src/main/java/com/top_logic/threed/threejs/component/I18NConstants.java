/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.component;

import com.top_logic.basic.util.ResKey;
import com.top_logic.basic.util.ResKey1;
import com.top_logic.layout.I18NConstantsBase;

/**
 * Messages for package.
 */
public class I18NConstants extends I18NConstantsBase {

	/**
	 * @en The operation argument function was not called from within the specified preload
	 *     operation.
	 */
	public static ResKey ERROR_OPERATION_ARGUMENT_NOT_CALLED;

	/**
	 * @en The value {0} is not a coordinate specification.
	 * 
	 *     <p>
	 *     A coordinate specification is a JSON object with keys <code>label</code> and
	 *     <code>tx</code>. The label is shown in the selector and the transformation specifies the
	 *     coordinate system relative to world coordinates.
	 *     </p>
	 */
	public static ResKey1 ERROR_IS_NOT_A_RELATIVE_COORDINATE_SYSTEM__VALUE;

	/**
	 * @en The value {0} is not an internationalizable value. Please enter a character string or a
	 *     resource key.
	 */
	public static ResKey1 ERROR_NOT_A_RES_KEY__VALUE;

	/**
	 * @en The value {0} is not a valid value for the "hiddenElements" channel of a 3D viewer. It is
	 *     expected that the values are paths of the business objects with the root as first element
	 *     and the hidden element as last element. It was not possible to find a node for the last
	 *     element in the specified value.
	 */
	public static ResKey1 ERROR_NOT_VALID_HIDDEN_CHANNEL_VALUE__VALUE;

	static {
		initConstants(I18NConstants.class);
	}

}
