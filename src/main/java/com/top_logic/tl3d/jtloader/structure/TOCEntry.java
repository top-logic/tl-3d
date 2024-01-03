/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.jtloader.structure;

import java.io.IOException;

import com.top_logic.tl3d.jtloader.JTReader;
import com.top_logic.tl3d.jtloader.types.GUID;

/**
 * Each TOC Entry represents a Data Segment within the JT File. The essential
 * function of a TOC Entry is to map a Segment ID to an absolute byte offset
 * within the file.
 */
public class TOCEntry {

	/** 
	 * Globally unique identifier for the segment.
	 */
	public GUID segmentID;
	
	/**
	 * Byte offset from the top of the file to start of the segment.
	 */
	public int segmentOffset;
	
	/**
	 * The total size of the segment in bytes.
	 */
	public int segmentLength;
	
	public SegmentType segmentType;
	
	/**
	 * Reserved for future use.
	 */
	public int reserved;
	
	/**
	 * Reads value from given reader.
	 */
	public static TOCEntry read(JTReader in) throws IOException {
		TOCEntry data = new TOCEntry();
		data.segmentID = GUID.read(in);
		data.segmentOffset = in.readI32();
		data.segmentLength = in.readI32();
		int segmentAttributes = in.readU32();
		data.reserved = segmentAttributes & 0b00_0000000111_1111111111_1111111111;
		int type___Id = segmentAttributes & 0b11_1111111000_0000000000_0000000000;
		data.segmentType = SegmentType.fromId(type___Id >>> 23);
		return data;
	}

}
