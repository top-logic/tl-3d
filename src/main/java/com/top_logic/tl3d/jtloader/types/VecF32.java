/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.jtloader.types;

import java.io.IOException;

import com.top_logic.tl3d.jtloader.JTReader;

/**
 * A vector/array of F32 base type. The type starts with an I32 that defines the
 * count of following F32 base type data. So a VecF32 is made up of one I32
 * followed by that number of F32. Note that it is valid for the I32 count
 * number to be equal to “0”, indicating no following F32.
 */
public class VecF32 {
	/** F32 */
	public float[] data;

	/**
	 * Reads value from given reader.
	 */
	public static VecF32 readCoordF32(JTReader in) throws IOException {
		int length = in.readI32();
		float[] array = new float[length];
		for (int n = 0; n < length; n++) {
			array[n] = in.readF32();
		}

		VecF32 data = new VecF32();
		data.data = array;
		return data;
	}
	
}
