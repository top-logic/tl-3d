/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package test.com.top_logic.tl3d.jtloader.structure;

import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;

import com.top_logic.tl3d.jtloader.JTReader;
import com.top_logic.tl3d.jtloader.structure.DataSegment;
import com.top_logic.tl3d.jtloader.structure.JTFile;
import com.top_logic.tl3d.jtloader.structure.TOCEntry;

import junit.framework.TestCase;

/**
 * Test for loading {@link JTFile}s.
 */
public class TestJTFile extends TestCase {
	
	public void testLoad() throws IOException {
		JTReader in = new JTReader(new RandomAccessFile(new File("./src/test/fixtures/Schlepper_gross.jt"), "r"));
		JTFile jt = JTFile.read(in);
		
		for (TOCEntry entry : jt.toc.entries) {
			DataSegment segment = jt.getSegment(entry.segmentID);
			assertEquals(entry.segmentLength, segment.header.segmentLength);
			
			// Seems to be broken in test file.
			// assertEquals(entry.segmentType, segment.header.segmentType);
		}
		
		System.out.println(jt);
	}

}
