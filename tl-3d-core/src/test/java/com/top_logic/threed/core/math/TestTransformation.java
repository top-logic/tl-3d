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

	public void testExtractRotation() {
		assertRotation(0.5, 0, 0, rotateX(0.5));
		assertRotation(0, 0.45, 0, rotateY(0.45));
		assertRotation(0, 0, 0.3, rotateZ(0.3));

		assertRotation(-0.5, 0, 0, rotateX(-0.5));
		assertRotation(0, -0.45, 0, rotateY(-0.45));
		assertRotation(0, -PI / 2, 0, rotateY(-PI / 2));
		assertRotation(0, 0, -0.45, rotateZ(-0.45));

		assertRotation(0.3, 0.4, 0.5, rotateZ(.5).after(rotateY(.4).after(rotateX(0.3))));
		assertRotation(PI / 4, PI / 4, PI / 2, rotateZ(PI / 2).after(rotateY(PI / 4).after(rotateX(PI / 4))));
		assertRotation(PI / 4, -PI / 2, 0, rotateY(-PI / 2).after(rotateX(PI / 4)));

		assertRotation(-3 * PI / 4, -PI / 2, 0, rotateZ(-3 * PI / 4).after(rotateY(-PI / 2).after(rotateX(0))));
		assertRotation(-3 * PI / 4, -PI / 2, 0, rotateZ(0).after(rotateY(-PI / 2).after(rotateX(-3 * PI / 4))));

		assertRotation(3 * PI / 4, -PI / 2, 0, rotateZ(PI / 2).after(rotateY(-PI / 2).after(rotateX(PI / 4))));
		assertRotation(3 * PI / 4, -PI / 2, 0, rotateZ(0).after(rotateY(-PI / 2).after(rotateX(3 * PI / 4))));

		assertRotation(3 * PI / 4, -PI / 2, 0, rotateZ(PI / 2).after(rotateY(-PI / 2)).after(rotateX(PI / 4)));
		assertRotation(3 * PI / 4, -PI / 2, 0,
			new Transformation(0, -1 / sqrt(2), 1 / sqrt(2), 0, -1 / sqrt(2), -1 / sqrt(2), 1, 0, 0, 0, 0, 0));
	}

	private static void assertRotation(double expectedX, double expectedY, double expectedZ, Transformation tx) {
		assertEqualsEps(expectedX, tx.getRotationX());
		assertEqualsEps(expectedY, tx.getRotationY());
		assertEqualsEps(expectedZ, tx.getRotationZ());
	}

	private static void assertEqualsEps(double expected, double actual) {
		if (expected == actual) {
			return;
		}
		if (expected > actual) {
			if (expected - actual > EPSILON) {
				fail("Expected '" + expected + "' but got '" + actual + "'.");
			}
		} else {
			if (actual - expected > EPSILON) {
				fail("Expected '" + expected + "' but got '" + actual + "'.");
			}
		}

	}
}
