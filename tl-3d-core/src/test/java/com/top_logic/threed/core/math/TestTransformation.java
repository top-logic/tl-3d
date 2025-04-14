/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.core.math;

import static com.top_logic.threed.core.math.Transformation.*;
import static com.top_logic.threed.core.math.Vec3d.*;
import static java.lang.Math.*;

import junit.framework.TestCase;

/**
 * Test case for {@link Transformation} and {@link Vec3d}
 */
@SuppressWarnings("javadoc")
public class TestTransformation extends TestCase {

	private static final double EPSILON = 0.00000001;

	public void testTranslate() {
		assertTrue(translate(1, 2, 3).apply(vec(5, 6, 7)).sub(vec(6, 8, 10)).length() < EPSILON);
	}

	public void testRotateX() {
		assertTrue(rotateX(PI / 2).apply(vec(0, 1, 0)).sub(vec(0, 0, 1)).length() < EPSILON);
	}

	public void testRotateY() {
		assertTrue(rotateY(PI / 2).apply(vec(0, 0, 1)).sub(vec(1, 0, 0)).length() < EPSILON);
	}

	public void testRotateZ() {
		assertTrue(rotateZ(PI / 2).apply(vec(1, 0, 0)).sub(vec(0, 1, 0)).length() < EPSILON);
	}

	public void testAfter() {
		assertTrue(rotateX(PI / 2).after(translate(-1, 0, 0)).apply(vec(1, 1, 0)).sub(vec(0, 0, 1)).length() < EPSILON);
	}
}
