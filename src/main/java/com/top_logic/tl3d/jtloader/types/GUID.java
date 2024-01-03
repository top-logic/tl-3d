/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.jtloader.types;

import java.io.IOException;
import java.util.Objects;

import com.top_logic.tl3d.jtloader.JTReader;

/**
 * A 16 byte (128-bit) number.
 * 
 * <p>
 * GUID is stored/written to the JT file using a four-byte word (U32), 2
 * two-byte words (U16), and 8 one-byte words (U8) such as:U32
 * {3F2504E0-4F89-11D3-9A-0C-03-05-E8-2C-33-01} In the JT format GUIDs are used
 * as unique identifiers (e.g. Data Segment ID, Object Type ID, etc.)
 * </p>
 */
public class GUID {
	private static final char[] HEX = {'0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F' };

	public static final int LENGTH = JTReader.U32_LENGTH + 2*JTReader.U16_LENGTH + 8*JTReader.U8_LENGTH;

	/** U32 */
	public int d0;
	
	/** U16, U16 */
	public int d1;
	
	/** U8, U8, U8, U8 */
	public int d2;
	
	/** U8, U8, U8, U8 */
	public int d3;

	/**
	 * Reads value from given reader.
	 */
	public static GUID read(JTReader in) throws IOException {
		GUID data = new GUID();
		data.d0 = in.readU32();
		data.d1 = in.readU16() << 16 | in.readU16();
		data.d2 = in.readU8() << 24 | in.readU8() << 16 | in.readU8() << 8 | in.readU8();
		data.d3 = in.readU8() << 24 | in.readU8() << 16 | in.readU8() << 8 | in.readU8();
		return data;
	}
	
	@Override
	public String toString() {
		return "{" + 
			hex(d0) + "-" + 
			hex16(d1 >> 16) + "-" + 
			hex16(d1) + "-" + 
			hex8(d2 >>> 24) + "-" +
			hex8(d2 >>> 16) + "-" +
			hex8(d2 >>> 8) + "-" +
			hex8(d2) + "-" +
			hex8(d3 >>> 24) + "-" +
			hex8(d3 >>> 16) + "-" +
			hex8(d3 >>> 8) + "-" +
			hex8(d3) +
		"}";
	}

	private static String hex(int data) {
		return hex(28, data);
	}

	private static String hex16(int data) {
		return hex(12, data);
	}
	
	private static String hex8(int data) {
		return hex(4, data);
	}
	
	private static String hex(int msbShift, int data) {
		StringBuilder result = new StringBuilder();
		for (int shift = msbShift; shift >= 0; shift -= 4) {
			int index = (data >>> shift) & 0x0F;
			result.append(HEX[index]);
		}
		return result.toString();
	}

	@Override
	public int hashCode() {
		return Objects.hash(d0, d1, d2, d3);
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj)
			return true;
		if (obj == null)
			return false;
		if (getClass() != obj.getClass())
			return false;
		GUID other = (GUID) obj;
		return d0 == other.d0 && d1 == other.d1 && d2 == other.d2
				&& d3 == other.d3;
	}
	
}
