/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.jtloader.structure;

import static com.top_logic.tl3d.jtloader.types.YesNo.*;

/**
 * A broad classification of segment contents.
 */
public enum SegmentType {

	LogicalSceneGraph       (1 ,   Yes),
	JTBRep                  (2 ,   Yes),
	PMIData                 (3 ,   Yes),
	MetaData                (4 ,   Yes),
	Shape                   (6 ,   No ),
	ShapeLOD0               (7 ,   No ),
	ShapeLOD1               (8 ,   No ),
	ShapeLOD2               (9 ,   No ),
	ShapeLOD3               (10,   No ),
	ShapeLOD4               (11,   No ),
	ShapeLOD5               (12,   No ),
	ShapeLOD6               (13,   No ),
	ShapeLOD7               (14,   No ),
	ShapeLOD8               (15,   No ),
	ShapeLOD9               (16,   No ),
	XTBRep                  (17,   Yes),
	WireframeRepresentation (18,   Yes),
	ULP                     (20,   Yes),
	LWPA                    (24,   Yes),
	
	;

	private int _id;
	private boolean _zlib;

	/** 
	 * Creates a {@link SegmentType}.
	 */
	SegmentType(int id, boolean zlib) {
		_id = id;
		_zlib = zlib;
	}
	
	/**
	 * The type ID.
	 */
	public int getId() {
		return _id;
	}
	
	/**
	 * Whether ZLIB compression is conditionally applied to the entirety of the
	 * segment's Data payload.
	 */
	public boolean isZlibApplied() {
		return _zlib;
	}

	/** 
	 * The {@link SegmentType} with the given ID.
	 */
	public static SegmentType fromId(int typeId) {
		for (SegmentType type : values()) {
			if (type.getId() == typeId) {
				return type;
			}
		}
		throw new IllegalArgumentException("No such segment type: " + typeId);
	}
}
