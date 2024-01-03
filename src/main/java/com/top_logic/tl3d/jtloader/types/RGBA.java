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
 * A color composed of Red, Green, Blue, Alpha components, each of which is a
 * F32. So a RGBA type is made up of four F32 base types. The Red, Green, Blue
 * color values typically range from 0.0 to 1.0. The Alpha value ranges from 0.0
 * to 1.0 where 1.0 indicates completely opaque.
 */
public class RGBA {
	/** F32 */
	public float red;

	/** F32 */
	public float green;

	/** F32 */
	public float blue;

	/** F32 */
	public float alpha;
	
	/**
	 * Reads value from given reader.
	 */
	public static RGBA readCoordF32(JTReader in) throws IOException {
		RGBA data = new RGBA();
		data.red = in.readF32();
		data.green = in.readF32();
		data.blue = in.readF32();
		data.alpha = in.readF32();
		return data;
	}

	@Override
	public int hashCode() {
		return Objects.hash(alpha, blue, green, red);
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj)
			return true;
		if (obj == null)
			return false;
		if (getClass() != obj.getClass())
			return false;
		RGBA other = (RGBA) obj;
		return Float.floatToIntBits(alpha) == Float.floatToIntBits(other.alpha)
				&& Float.floatToIntBits(blue) == Float
						.floatToIntBits(other.blue)
				&& Float.floatToIntBits(green) == Float
						.floatToIntBits(other.green)
				&& Float.floatToIntBits(red) == Float.floatToIntBits(other.red);
	}
	
	
}
