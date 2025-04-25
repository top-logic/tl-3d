/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.core.math;

import java.util.Arrays;
import java.util.List;

/**
 * Util class for {@link Transformation}.
 * 
 * @author <a href="mailto:daniel.busche@top-logic.com">Daniel Busche</a>
 */
public class TransformationUtil {

	/**
	 * Creates a list containing the entries of the {@link Transformation}.
	 * 
	 * @see #fromList(List)
	 */
	public static List<Double> toList(Transformation tx) {
		return Arrays.asList(
			tx.a(), tx.b(), tx.c(),
			tx.d(), tx.e(), tx.f(),
			tx.g(), tx.h(), tx.i(),
			tx.x(), tx.y(), tx.z());
	}

	/**
	 * Creates a {@link Transformation} with entries of the given list.
	 * 
	 * @see #toList(Transformation)
	 */
	public static Transformation fromList(List<? extends Number> tx) {
		if (tx.size() != 12) {
			throw new IllegalArgumentException("TX must contain exactly 12 entries.");
		}
		return new Transformation(
			tx.get(0).doubleValue(), tx.get(1).doubleValue(), tx.get(2).doubleValue(),
			tx.get(3).doubleValue(), tx.get(4).doubleValue(), tx.get(5).doubleValue(),
			tx.get(6).doubleValue(), tx.get(7).doubleValue(), tx.get(8).doubleValue(),
			tx.get(9).doubleValue(), tx.get(10).doubleValue(), tx.get(11).doubleValue());
	}

}
