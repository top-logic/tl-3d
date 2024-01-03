/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.jtloader.structure;

import java.io.IOException;

import com.top_logic.tl3d.jtloader.JTReader;

/**
 * All data stored in a JT file must be defined within a Data Segment. Data
 * Segments are “typed” based on the general classification of data they
 * contain.
 */
public class DataSegment {

	public SegmentHeader header;
	
	/**
	 * Reads value from given reader.
	 */
	public static DataSegment read(JTReader in) throws IOException {
		DataSegment data = new DataSegment();
		data.header = SegmentHeader.read(in);
		int dataLength = data.header.segmentLength - SegmentHeader.LENGTH;
		in.skip(dataLength);
		return data;
	}

	@Override
	public String toString() {
		return header.toString();
	}
}
