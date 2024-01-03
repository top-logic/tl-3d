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
 * The File Header is always the first block of data in a JT file. The File
 * Header contains information about the JT file version and TOC location, which
 * Loaders use to determine how to read the file.
 */
public class FileHeader {

	String version;

	ByteOrder byteOrder;

	/**
	 * Must have the value 0.
	 */
	int reserved;

	/**
	 * Defines the byte offset from the top of the file to the start of the TOC
	 * Segment.
	 */
	int tocOffset;

	/**
	 * The globally unique identifier for the Logical Scene Graph Data Segment
	 * in the file. This ID along with the information in the TOC Segment can be
	 * used to locate the start of LSG Data Segment in the file. This ID is
	 * needed because without it a loader would have no way of knowing the
	 * location of the root LSG Data Segment. All other Data Segments must be
	 * accessible from the root LSG Data Segment.
	 */
	GUID lsgSegmentID;

	/**
	 * A data field reserved for future JT format expansion.
	 */
	GUID reservedField;

	/**
	 * Reads value from given reader.
	 */
	public static FileHeader read(JTReader in) throws IOException {
		FileHeader data = new FileHeader();
		data.version = in.readString(80);
		data.byteOrder = ByteOrder.read(in);

		in.setByteOrder(data.byteOrder);

		data.reserved = in.readI32();
		data.tocOffset = in.readI32();
		if (data.reserved != 0) {
			data.reservedField = GUID.read(in);
		} else {
			data.lsgSegmentID = GUID.read(in);
		}
		return data;
	}
	
	@Override
	public String toString() {
		return version.trim() + " (" + byteOrder + ")";
	}

}
