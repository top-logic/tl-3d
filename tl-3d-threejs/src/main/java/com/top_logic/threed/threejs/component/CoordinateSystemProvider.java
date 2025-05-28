/*
 * SPDX-FileCopyrightText: 2025 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.component;

/**
 * Indirection for creating a {@link CoordinateSystem} for each update of the viewer.
 */
public interface CoordinateSystemProvider {

	/**
	 * The coordinate system to offer for layouting.
	 */
	CoordinateSystem getCoordinateSystem();

}
