/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.component;

import java.util.Map;

import com.top_logic.basic.util.ResKey;
import com.top_logic.model.search.expr.SearchExpression;
import com.top_logic.threed.core.math.Transformation;
import com.top_logic.util.error.TopLogicException;

/**
 * Description of a coordinate system that can be selected for layouting objects.
 */
public final class CoordinateSystem {

	private final ResKey _label;

	private final Transformation _tx;

	/**
	 * Creates a {@link CoordinateSystem}.
	 */
	public CoordinateSystem(ResKey labelKey, Transformation tx) {
		_label = labelKey;
		_tx = tx;
	}

	/**
	 * The label to use for selecting this coordinate system.
	 */
	public ResKey getLabel() {
		return _label;
	}

	/**
	 * The transformation that maps coordinates of this coordinate system to world coordinates.
	 */
	public Transformation getTx() {
		return _tx;
	}

	/**
	 * Parses a {@link CoordinateSystem} from a JSON object.
	 */
	public static CoordinateSystem asCoordinateSystem(Object json) {
		if (json instanceof Map<?, ?> map) {
			Object label = map.get("label");
			Object tx = map.get("tx");

			if (label != null && tx != null) {
				ResKey resKey = SearchExpression.asResKey(label);
				if (resKey == null) {
					throw new TopLogicException(I18NConstants.ERROR_NOT_A_RES_KEY__VALUE.fill(label));
				}
				return new CoordinateSystem(resKey, Transformation.cast(tx));
			}
		}

		throw new TopLogicException(I18NConstants.ERROR_IS_NOT_A_RELATIVE_COORDINATE_SYSTEM__VALUE.fill(json));
	}

}
