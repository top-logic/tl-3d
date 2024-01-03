package com.top_logic.tl3d.threejs.control.model;

/**
 * Base class for objects that can be rendered in a 3D context.
 */
public abstract class Asset extends de.haumacher.msgbuf.graph.AbstractSharedGraphNode {

	/** Type codes for the {@link com.top_logic.tl3d.threejs.control.model.Asset} hierarchy. */
	public enum TypeKind {

		/** Type literal for {@link com.top_logic.tl3d.threejs.control.model.GltfAsset}. */
		GLTF_ASSET,

		/** Type literal for {@link com.top_logic.tl3d.threejs.control.model.Cube}. */
		CUBE,
		;

	}

	/** Visitor interface for the {@link com.top_logic.tl3d.threejs.control.model.Asset} hierarchy.*/
	public interface Visitor<R,A,E extends Throwable> {

		/** Visit case for {@link com.top_logic.tl3d.threejs.control.model.GltfAsset}.*/
		R visit(com.top_logic.tl3d.threejs.control.model.GltfAsset self, A arg) throws E;

		/** Visit case for {@link com.top_logic.tl3d.threejs.control.model.Cube}.*/
		R visit(com.top_logic.tl3d.threejs.control.model.Cube self, A arg) throws E;

	}

	/**
	 * Creates a {@link Asset} instance.
	 */
	protected Asset() {
		super();
	}

	/** The type code of this instance. */
	public abstract TypeKind kind();

	/** Reads a new instance from the given reader. */
	public static com.top_logic.tl3d.threejs.control.model.Asset readAsset(de.haumacher.msgbuf.graph.Scope scope, de.haumacher.msgbuf.json.JsonReader in) throws java.io.IOException {
		if (in.peek() == de.haumacher.msgbuf.json.JsonToken.NUMBER) {
			return (com.top_logic.tl3d.threejs.control.model.Asset) scope.resolveOrFail(in.nextInt());
		}
		com.top_logic.tl3d.threejs.control.model.Asset result;
		in.beginArray();
		String type = in.nextString();
		int id = in.nextInt();
		switch (type) {
			case GltfAsset.GLTF_ASSET__TYPE: result = com.top_logic.tl3d.threejs.control.model.GltfAsset.create(); break;
			case Cube.CUBE__TYPE: result = com.top_logic.tl3d.threejs.control.model.Cube.create(); break;
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
