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
 * Matrix of F32 values for a total of 16 F32 values.
 * 
 * <p>
 * The values are stored in row major order (right most subscript, column varies
 * fastest), that is, the first 4 elements form the first row of the matrix.
 * </p>
 */
public class Mx4F32 {
	public float a;
	public float b;
	public float c;
	public float d;

	public float e;
	public float f;
	public float g;
	public float h;

	public float i;
	public float j;
	public float k;
	public float l;
	
	public float m;
	public float n;
	public float o;
	public float p;
	
	/**
	 * Reads value from given reader.
	 */
	public static Mx4F32 readCoordF32(JTReader in) throws IOException {
		Mx4F32 data = new Mx4F32();
		data.a = in.readF32();
		data.b = in.readF32();
		data.c = in.readF32();
		data.d = in.readF32();

		data.e = in.readF32();
		data.f = in.readF32();
		data.g = in.readF32();
		data.h = in.readF32();
		
		data.i = in.readF32();
		data.j = in.readF32();
		data.k = in.readF32();
		data.l = in.readF32();
		
		data.m = in.readF32();
		data.n = in.readF32();
		data.o = in.readF32();
		data.p = in.readF32();
		return data;
	}

	@Override
	public int hashCode() {
		return Objects.hash(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p);
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj)
			return true;
		if (obj == null)
			return false;
		if (getClass() != obj.getClass())
			return false;
		Mx4F32 other = (Mx4F32) obj;
		return Float.floatToIntBits(a) == Float.floatToIntBits(other.a)
				&& Float.floatToIntBits(b) == Float.floatToIntBits(other.b)
				&& Float.floatToIntBits(c) == Float.floatToIntBits(other.c)
				&& Float.floatToIntBits(d) == Float.floatToIntBits(other.d)
				&& Float.floatToIntBits(e) == Float.floatToIntBits(other.e)
				&& Float.floatToIntBits(f) == Float.floatToIntBits(other.f)
				&& Float.floatToIntBits(g) == Float.floatToIntBits(other.g)
				&& Float.floatToIntBits(h) == Float.floatToIntBits(other.h)
				&& Float.floatToIntBits(i) == Float.floatToIntBits(other.i)
				&& Float.floatToIntBits(j) == Float.floatToIntBits(other.j)
				&& Float.floatToIntBits(k) == Float.floatToIntBits(other.k)
				&& Float.floatToIntBits(l) == Float.floatToIntBits(other.l)
				&& Float.floatToIntBits(m) == Float.floatToIntBits(other.m)
				&& Float.floatToIntBits(n) == Float.floatToIntBits(other.n)
				&& Float.floatToIntBits(o) == Float.floatToIntBits(other.o)
				&& Float.floatToIntBits(p) == Float.floatToIntBits(other.p);
	}
	
	
}
