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
 * Information that determines how the remainder of the Segment is interpreted
 * by the loader.
 */
public class SegmentHeader {

	public static final int LENGTH = GUID.LENGTH + JTReader.I32_LENGTH + JTReader.I32_LENGTH;

	/**
	 * Global Unique Identifier for the segment.
	 */
	public GUID segmentID;

	/**
	 * A broad classification of the segment contents.
	 */
	public SegmentType segmentType;

	/**
	 * Total size of the segment in bytes. This length value includes all
	 * segment Data bytes plus the {@link SegmentHeader} bytes (i.e. it is the size of
	 * the complete segment) and should be equal to the length value stored with
	 * this segment’s {@link TOCEntry}.
	 */
	public int segmentLength;

	/**
	 * Reads value from given reader.
	 */
	public static SegmentHeader read(JTReader in) throws IOException {
		SegmentHeader data = new SegmentHeader();
		data.segmentID = GUID.read(in);
		data.segmentType = SegmentType.fromId(in.readI32());
		data.segmentLength = in.readI32();
		return data;
	}
	
	@Override
	public String toString() {
		return segmentID + ": " + segmentType + " (" + segmentLength + " bytes)";
	}

}
