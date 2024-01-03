/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.jtloader.structure;

import java.io.IOException;

import com.top_logic.tl3d.jtloader.JTReader;

/**
 * The TOC Segment contains information identifying and locating all
 * individually addressable Data Segments within the file. A TOC Segment is
 * always required to exist somewhere within a JT file. The actual location of
 * the TOC Segment within the file is specified by the File Header segment’s
 * “TOC Offset” field. The TOC Segment contains one TOC Entry for each
 * individually addressable Data Segment in the file.
 */
public class TOCSegment {

	public TOCEntry[] entries;
	
	/**
	 * Reads value from given reader.
	 */
	public static TOCSegment read(JTReader in) throws IOException {
		int length = in.readI32();
		TOCEntry[] array = new TOCEntry[length];
		for (int n = 0; n < length; n++) {
			array[n] = TOCEntry.read(in);
		}
		
		TOCSegment data = new TOCSegment();
		data.entries = array;
		return data;
	}

}
