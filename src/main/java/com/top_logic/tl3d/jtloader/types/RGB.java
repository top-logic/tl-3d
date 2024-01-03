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
 * A color composed of Red, Green, Blue components, each of which is a F32. So a
 * RGB type is made up of three F32 base types. The Red, Green, Blue color
 * values typically range from 0.0 to 1.0.
 */
public class RGB {
	/** F32 */
	public float red;

	/** F32 */
	public float green;

	/** F32 */
	public float blue;

	/**
	 * Reads value from given reader.
	 */
	public static RGB readCoordF32(JTReader in) throws IOException {
		RGB data = new RGB();
		data.red = in.readF32();
		data.green = in.readF32();
		data.blue = in.readF32();
		return data;
	}

	@Override
	public int hashCode() {
		return Objects.hash(blue, green, red);
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj)
			return true;
		if (obj == null)
			return false;
		if (getClass() != obj.getClass())
			return false;
		RGB other = (RGB) obj;
		return Float.floatToIntBits(blue) == Float.floatToIntBits(other.blue)
				&& Float.floatToIntBits(green) == Float
						.floatToIntBits(other.green)
				&& Float.floatToIntBits(red) == Float.floatToIntBits(other.red);
	}
	
	
}
