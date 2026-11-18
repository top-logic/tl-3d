/*
 * SPDX-FileCopyrightText: 2026 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.script;

import java.util.List;

import junit.framework.TestCase;

import com.top_logic.threed.threejs.scene.ConnectionPoint;
import com.top_logic.threed.threejs.scene.GltfAsset;

/**
 * Test for {@link ThreejsGltf#unowned(ConnectionPoint)}.
 */
public class TestThreejsGltf extends TestCase {

	private static final List<Double> TX = List.of(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 5.0, 6.0, 7.0);

	/** A point that belongs to no asset is used as it is. */
	public void testUnownedPoint() {
		ConnectionPoint point = ConnectionPoint.create().setTransform(TX);
		assertSame(point, ThreejsGltf.unowned(point));
	}

	/** A point used for a second asset is copied, so that both assets have their own point. */
	public void testSharedPoint() {
		ConnectionPoint point = ConnectionPoint.create().setTransform(TX).setClassifiers(List.of("a", "b"));
		GltfAsset first = GltfAsset.create();
		first.setLayoutPoint(ThreejsGltf.unowned(point));

		ConnectionPoint second = ThreejsGltf.unowned(point);
		assertNotSame(point, second);
		assertEquals(TX, second.getTransform());
		assertEquals(List.of("a", "b"), second.getClassifiers());

		GltfAsset other = GltfAsset.create();
		other.setLayoutPoint(second);
		other.setSnappingPoints(List.of(ThreejsGltf.unowned(point)));
		assertSame(first, point.getOwner());
		assertSame(other, second.getOwner());
	}

	/** Without the copy, the second asset rejects the point. */
	public void testSharingFailsWithoutCopy() {
		ConnectionPoint point = ConnectionPoint.create().setTransform(TX);
		GltfAsset.create().setLayoutPoint(point);
		try {
			GltfAsset.create().setLayoutPoint(point);
			fail("A point must not belong to two assets.");
		} catch (IllegalStateException ex) {
			// expected
		}
	}

}
