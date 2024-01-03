/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.jtloader.types;

import java.io.IOException;

import com.top_logic.tl3d.jtloader.JTReader;

/**
 * A vector/array of U32 base type. The type starts with an I32 that defines the
 * count of following U32 base type data. So a VecU32 is made up of one I32
 * followed by that number of U32. Note that it is valid for the I32 count
 * number to be equal to “0”, indicating no following U32.
 */
public class VecU32 {
	/** U32 */
	public int[] data;

	/**
	 * Reads value from given reader.
	 */
	public static VecU32 readCoordF32(JTReader in) throws IOException {
		int length = in.readI32();
		int[] array = new int[length];
		for (int n = 0; n < length; n++) {
			array[n] = in.readI32();
		}

		VecU32 data = new VecU32();
		data.data = array;
		return data;
	}
}
