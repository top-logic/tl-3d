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
 * A bounding box using two CoordF32 types to store the XYZ coordinates for the
 * bounding box minimum and maximum corner points.
 */
public class BBoxF32 {
	/**
	 * Bounding box minimum corner point.
	 */
	public CoordF32 minCorner;
	
	/**
	 * Bounding box maximum corner point.
	 */
	public CoordF32 maxCorner;
	
	/**
	 * Reads value from given reader.
	 */
	public static BBoxF32 readCoordF32(JTReader in) throws IOException {
		BBoxF32 data = new BBoxF32();
		data.minCorner = CoordF32.readCoordF32(in);
		data.maxCorner = CoordF32.readCoordF32(in);
		return data;
	}

	@Override
	public int hashCode() {
		return Objects.hash(maxCorner, minCorner);
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj)
			return true;
		if (obj == null)
			return false;
		if (getClass() != obj.getClass())
			return false;
		BBoxF32 other = (BBoxF32) obj;
		return Objects.equals(maxCorner, other.maxCorner)
				&& Objects.equals(minCorner, other.minCorner);
	}
	
	
}
