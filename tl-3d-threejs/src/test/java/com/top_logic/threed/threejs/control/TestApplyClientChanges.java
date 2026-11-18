/*
 * SPDX-FileCopyrightText: 2026 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.control;

import java.io.IOException;
import java.util.List;

import junit.framework.TestCase;

import com.top_logic.threed.threejs.scene.GroupNode;
import com.top_logic.threed.threejs.scene.PartNode;
import com.top_logic.threed.threejs.scene.SceneGraph;

import de.haumacher.msgbuf.graph.DefaultScope;
import de.haumacher.msgbuf.io.StringW;
import de.haumacher.msgbuf.json.JsonWriter;

/**
 * Test for {@link ThreeJsControl#applyClientChanges(DefaultScope, String)}.
 */
public class TestApplyClientChanges extends TestCase {

	private static final List<Double> TX_1 = List.of(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 10.0, 0.0, 0.0);

	private static final List<Double> TX_2 = List.of(1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 20.0, 0.0, 0.0);

	private DefaultScope _scope;

	private SceneGraph _graph;

	private PartNode _a;

	private PartNode _b;

	@Override
	protected void setUp() throws Exception {
		super.setUp();
		_a = PartNode.create();
		_b = PartNode.create();
		_graph = SceneGraph.create().setRoot(GroupNode.create().addContent(_a).addContent(_b));
		_scope = DefaultScope.newServerInstance();
		// Deliver the graph to the client.
		_scope.writeRefOrData(new JsonWriter(new StringW()), _graph);
		assertFalse(_scope.hasChanges());
	}

	/** Without pending changes on the server, the change of the client is applied. */
	public void testNoPendingChanges() {
		ThreeJsControl.applyClientChanges(_scope, setTransform(_a, TX_1) + "]");

		assertEquals(TX_1, _a.getTransform());
		assertFalse("Applied changes must not be sent back.", _scope.hasChanges());
	}

	/** A change of a node without pending changes is applied, pending changes stay. */
	public void testPendingChangeOfOtherNode() throws IOException {
		_b.setTransform(TX_2);

		ThreeJsControl.applyClientChanges(_scope, setTransform(_a, TX_1) + "]");

		assertEquals(TX_1, _a.getTransform());
		assertEquals(TX_2, _b.getTransform());
		String patch = patch();
		assertTrue(patch, patch.contains("20.0"));
		assertFalse(patch, patch.contains("10.0"));
	}

	/** A new value for a node with pending changes wins and is sent back to the client. */
	public void testPendingChangeOfSameNode() throws IOException {
		_a.setTransform(TX_2);

		ThreeJsControl.applyClientChanges(_scope, setTransform(_a, TX_1) + "]");

		assertEquals(TX_1, _a.getTransform());
		String patch = patch();
		assertTrue(patch, patch.contains("10.0"));
	}

	/**
	 * A list update of the client for a list that the server has changed is not applied, the
	 * client receives the complete list instead.
	 */
	public void testPendingListChange() throws IOException {
		_graph.addSelection(_b);

		// The client selects a in its (empty) selection.
		String insert = "[[[\"I\",{\"id\":" + _scope.id(_graph) + ",\"p\":\"selection\",\"i\":0}]," + _scope.id(_a)
			+ "]]";
		ThreeJsControl.applyClientChanges(_scope, insert);

		assertEquals(List.of(_b), _graph.getSelection());
		String patch = patch();
		assertTrue("Complete selection expected: " + patch, patch.contains("[\"S\""));
		assertFalse("No list update expected: " + patch, patch.contains("[\"I\""));
	}

	/** A change of a node that the server has already removed is ignored. */
	public void testUnknownNode() throws IOException {
		_b.setTransform(TX_2);

		ThreeJsControl.applyClientChanges(_scope, "[[[\"S\",{\"id\":4711,\"p\":\"transform\"}],[]]]");

		assertTrue(_scope.hasChanges());
	}

	private String setTransform(PartNode node, List<Double> tx) {
		StringBuilder result = new StringBuilder("[[[\"S\",{\"id\":" + _scope.id(node) + ",\"p\":\"transform\"}],[");
		for (int i = 0; i < tx.size(); i++) {
			if (i > 0) {
				result.append(',');
			}
			result.append(tx.get(i));
		}
		return result.append("]]").toString();
	}

	private String patch() throws IOException {
		StringW out = new StringW();
		_scope.createPatch(new JsonWriter(out));
		return out.toString();
	}

}
