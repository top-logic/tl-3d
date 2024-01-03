/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.jtloader.structure;

import java.io.IOException;
import java.util.Arrays;
import java.util.stream.Collectors;

import com.top_logic.tl3d.jtloader.JTReader;
import com.top_logic.tl3d.jtloader.types.GUID;

/**
 * A JT file is structured as a sequence of blocks/segments. The File Header
 * block is always the first block of data in the file. The File Header is
 * followed (in no particular order) by a TOC Segment and a series of other Data
 * Segments. The one Data Segment which must always exist to have a reference
 * compliant JT file is the LSG Segment.
 */
public class JTFile {

	public FileHeader header;
	public TOCSegment toc;
	public DataSegment[] segments;
	

	/**
	 * Reads value from given reader.
	 */
	public static JTFile read(JTReader in) throws IOException {
		JTFile data = new JTFile();
		data.header = FileHeader.read(in);
		
		long skip = data.header.tocOffset - in.getPos();
		in.skip(skip);
		
		data.toc = TOCSegment.read(in);
		
		int cnt = data.toc.entries.length;
		DataSegment[] array = new DataSegment[cnt];
		for (int n = 0; n < cnt; n++) {
			TOCEntry tocEntry = data.toc.entries[n];
			in.seek(tocEntry.segmentOffset);
			
			array[n] = DataSegment.read(in);
		}
		
		data.segments = array;
		return data;
	}


	/** 
	 * Retrieves the segment with the given ID.
	 */
	public DataSegment getSegment(GUID segmentID) {
		return Arrays.stream(segments).filter(s -> s.header.segmentID.equals(segmentID)).findFirst().get();
	}
	
	@Override
	public String toString() {
		return header.toString() + "\n" + Arrays.stream(segments).map(Object::toString).collect(Collectors.joining("\n"));
	}

}
