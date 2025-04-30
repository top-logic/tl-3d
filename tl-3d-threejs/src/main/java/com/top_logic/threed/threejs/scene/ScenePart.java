package com.top_logic.threed.threejs.scene;

/**
 * Base class for a part in a {@link SceneGraph}
 */
public abstract class ScenePart extends de.haumacher.msgbuf.graph.AbstractSharedGraphNode {

	/** Type codes for the {@link com.top_logic.threed.threejs.scene.ScenePart} hierarchy. */
	public enum TypeKind {

		/** Type literal for {@link com.top_logic.threed.threejs.scene.GroupNode}. */
		GROUP_NODE,

		/** Type literal for {@link com.top_logic.threed.threejs.scene.PartNode}. */
		PART_NODE,

		/** Type literal for {@link com.top_logic.threed.threejs.scene.SceneGraph}. */
		SCENE_GRAPH,
		;

	}

	/** Visitor interface for the {@link com.top_logic.threed.threejs.scene.ScenePart} hierarchy.*/
	public interface Visitor<R,A,E extends Throwable> extends com.top_logic.threed.threejs.scene.SceneNode.Visitor<R,A,E> {

		/** Visit case for {@link com.top_logic.threed.threejs.scene.SceneGraph}.*/
		R visit(com.top_logic.threed.threejs.scene.SceneGraph self, A arg) throws E;

	}

	/**
	 * Creates a {@link ScenePart} instance.
	 */
	protected ScenePart() {
		super();
	}

	/** The type code of this instance. */
	public abstract TypeKind kind();

	/** Reads a new instance from the given reader. */
	public static com.top_logic.threed.threejs.scene.ScenePart readScenePart(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in) throws java.io.IOException {
		if (in.peek() == de.haumacher.msgbuf.json.JsonToken.NUMBER) {
			return (com.top_logic.threed.threejs.scene.ScenePart) scope.resolveOrFail(in.nextInt());
		}
		com.top_logic.threed.threejs.scene.ScenePart result;
		in.beginArray();
		String type = in.nextString();
		int id = in.nextInt();
		switch (type) {
			case SceneGraph.SCENE_GRAPH__TYPE: result = com.top_logic.threed.threejs.scene.SceneGraph.create(); break;
			case GroupNode.GROUP_NODE__TYPE: result = com.top_logic.threed.threejs.scene.GroupNode.create(); break;
			case PartNode.PART_NODE__TYPE: result = com.top_logic.threed.threejs.scene.PartNode.create(); break;
			default: in.skipValue(); result = null; break;
		}
		if (result != null) {
			scope.readData(result, id, in);
		}
		in.endArray();
		return result;
	}

	/** Accepts the given visitor. */
	public abstract <R,A,E extends Throwable> R visit(Visitor<R,A,E> v, A arg) throws E;

}
