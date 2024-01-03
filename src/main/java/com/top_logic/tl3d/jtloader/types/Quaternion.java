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
 * 3-dimensional orientation (no translation) in quaternion linear combination
 * form (a + bi + cj + dk) where the four scalar values (a, b, c, d) are
 * associated with the 4 dimensions of a quaternion (1 real dimension, and 3
 * imaginary dimensions). So the {@link Quaternion} type is made up of four F32 base
 * types.
 */
public class Quaternion {
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
	public static Quaternion readCoordF32(JTReader in) throws IOException {
		Quaternion data = new Quaternion();
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
		Quaternion other = (Quaternion) obj;
		return Float.floatToIntBits(a) == Float.floatToIntBits(other.a)
				&& Float.floatToIntBits(b) == Float.floatToIntBits(other.b)
				&& Float.floatToIntBits(c) == Float.floatToIntBits(other.c)
				&& Float.floatToIntBits(d) == Float.floatToIntBits(other.d);
	}
	
	
}
