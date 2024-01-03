/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.jtloader.types;

import java.io.IOException;

import com.top_logic.tl3d.jtloader.JTReader;

/**
 * A vector/array of F64 base type. The type starts with an I32 that defines the
 * count of following F64 base type data. So a VecF64 is made up of one I32
 * followed by that number of F64. Note that it is valid for the I32 count
 * number to be equal to “0”, indicating no following F64.
 */
public class VecF64 {
	/** F64 */
	public double[] data;

	/**
	 * Reads value from given reader.
	 */
	public static VecF64 readCoordF32(JTReader in) throws IOException {
		int length = in.readI32();
		double[] array = new double[length];
		for (int n = 0; n < length; n++) {
			array[n] = in.readF64();
		}

		VecF64 data = new VecF64();
		data.data = array;
		return data;
	}
}
