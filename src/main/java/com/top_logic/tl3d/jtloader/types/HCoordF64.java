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
public class HCoordF64 {
	/**
	 * F64
	 */
	public double x;

	/**
	 * F64
	 */
	public double y;

	/**
	 * F64
	 */
	public double z;

	/**
	 * F64
	 */
	public double w;
	
	/**
	 * Reads value from given reader.
	 */
	public static HCoordF64 readCoordF32(JTReader in) throws IOException {
		HCoordF64 data = new HCoordF64();
		data.x = in.readF64();
		data.y = in.readF64();
		data.z = in.readF64();
		data.w = in.readF64();
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
		HCoordF64 other = (HCoordF64) obj;
		return Double.doubleToLongBits(w) == Double.doubleToLongBits(other.w)
				&& Double.doubleToLongBits(x) == Double
						.doubleToLongBits(other.x)
				&& Double.doubleToLongBits(y) == Double
						.doubleToLongBits(other.y)
				&& Double.doubleToLongBits(z) == Double
						.doubleToLongBits(other.z);
	}
	
	
}
