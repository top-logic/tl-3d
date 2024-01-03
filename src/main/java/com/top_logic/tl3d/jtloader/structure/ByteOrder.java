/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.jtloader.structure;

import java.io.IOException;

import com.top_logic.tl3d.jtloader.JTReader;

/**
 * File byte order and thus can be used by the loader to determine if there is a
 * mismatch (thus byte swapping required) between the file byte order and the
 * machine (on which the loader is being run) byte order.
 */
public enum ByteOrder {
	
	/**
	 * Least Significant byte first.
	 */
	LsbFirst,
	
	/**
	 * Most Significant byte first
	 */
	MsbFirst,
	
	;
	
	/**
	 * Reads value from given reader.
	 */
	public static ByteOrder read(JTReader in) throws IOException {
		return values()[in.readUChar()];
	}

}
