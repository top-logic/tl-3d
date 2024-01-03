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
 * A geometric Plane using the general form of the plane equation (Ax + By + Cz
 * + D = 0). The PlaneF32 type is made up of four F32 base types where the first
 * three F32 define the plane unit normal vector (A, B, C) and the last F32
 * defines the negated perpendicular distance (D), along normal vector, from the
 * origin to the plane.
 */
public class PlaneF32 {
	/** F32 */
	public float a;

	/** F32 */
	public float b;

	/** F32 */
	public float c;

	/** F32 */
	public float d;

	/**
	 * Reads value from given reader.
	 */
	public static PlaneF32 readCoordF32(JTReader in) throws IOException {
		PlaneF32 data = new PlaneF32();
		data.a = in.readF32();
		data.b = in.readF32();
		data.c = in.readF32();
		data.d = in.readF32();
		return data;
	}

	@Override
	public int hashCode() {
		return Objects.hash(a, b, c, d);
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj)
			return true;
		if (obj == null)
			return false;
		if (getClass() != obj.getClass())
			return false;
		PlaneF32 other = (PlaneF32) obj;
		return Float.floatToIntBits(a) == Float.floatToIntBits(other.a)
				&& Float.floatToIntBits(b) == Float.floatToIntBits(other.b)
				&& Float.floatToIntBits(c) == Float.floatToIntBits(other.c)
				&& Float.floatToIntBits(d) == Float.floatToIntBits(other.d);
	}
	
	
}
