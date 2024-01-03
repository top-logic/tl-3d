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
 * X, Y, Z, W homogeneous coordinate values.
 */
public class HCoordF32 {
	/** F32 */
	public float x;

	/** F32 */
	public float y;

	/** F32 */
	public float z;
	
	/** F32 */
	public float w;
	
	/**
	 * Reads value from given reader.
	 */
	public static HCoordF32 readCoordF32(JTReader in) throws IOException {
		HCoordF32 data = new HCoordF32();
		data.x = in.readF32();
		data.y = in.readF32();
		data.z = in.readF32();
		data.w = in.readF32();
		return data;
	}

	@Override
	public int hashCode() {
		return Objects.hash(w, x, y, z);
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj)
			return true;
		if (obj == null)
			return false;
		if (getClass() != obj.getClass())
			return false;
		HCoordF32 other = (HCoordF32) obj;
		return Float.floatToIntBits(w) == Float.floatToIntBits(other.w)
				&& Float.floatToIntBits(x) == Float.floatToIntBits(other.x)
				&& Float.floatToIntBits(y) == Float.floatToIntBits(other.y)
				&& Float.floatToIntBits(z) == Float.floatToIntBits(other.z);
	}
	
	
}
