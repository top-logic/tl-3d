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
 * X, Y, Z coordinate values. So a CoordF32 is made up of three F32 base types.
 */
public class CoordF32 {
	/** F32 */
	public float x;

	/** F32 */
	public float y;

	/** F32 */
	public float z;
	
	/**
	 * Reads value from given reader.
	 */
	public static CoordF32 readCoordF32(JTReader in) throws IOException {
		CoordF32 data = new CoordF32();
		data.x = in.readF32();
		data.y = in.readF32();
		data.z = in.readF32();
		return data;
	}

	@Override
	public int hashCode() {
		return Objects.hash(x, y, z);
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj)
			return true;
		if (obj == null)
			return false;
		if (getClass() != obj.getClass())
			return false;
		CoordF32 other = (CoordF32) obj;
		return Float.floatToIntBits(x) == Float.floatToIntBits(other.x)
				&& Float.floatToIntBits(y) == Float.floatToIntBits(other.y)
				&& Float.floatToIntBits(z) == Float.floatToIntBits(other.z);
	}
	
	
}
