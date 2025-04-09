/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.threejs.component;

import java.util.Collection;
import java.util.List;
import java.util.Set;

import com.top_logic.basic.CalledByReflection;
import com.top_logic.basic.NamedConstant;
import com.top_logic.basic.col.factory.CollectionFactory;
import com.top_logic.basic.config.ConfigurationException;
import com.top_logic.basic.config.ConfiguredInstance;
import com.top_logic.basic.config.InstantiationContext;
import com.top_logic.basic.config.PolymorphicConfiguration;
import com.top_logic.basic.config.annotation.Format;
import com.top_logic.basic.config.annotation.Label;
import com.top_logic.basic.config.annotation.Mandatory;
import com.top_logic.basic.config.annotation.Name;
import com.top_logic.basic.config.annotation.NonNullable;
import com.top_logic.basic.config.annotation.Nullable;
import com.top_logic.basic.config.annotation.defaults.FormattedDefault;
import com.top_logic.basic.config.annotation.defaults.ItemDefault;
import com.top_logic.basic.config.order.DisplayOrder;
import com.top_logic.basic.util.Utils;
import com.top_logic.knowledge.service.KnowledgeBase;
import com.top_logic.knowledge.service.PersistencyLayer;
import com.top_logic.mig.html.ModelBuilder;
import com.top_logic.mig.html.layout.LayoutComponent;
import com.top_logic.model.TLClass;
import com.top_logic.model.TLModel;
import com.top_logic.model.TLStructuredType;
import com.top_logic.model.TLType;
import com.top_logic.model.search.expr.EvalContext;
import com.top_logic.model.search.expr.GenericMethod;
import com.top_logic.model.search.expr.SearchExpression;
import com.top_logic.model.search.expr.config.dom.Expr;
import com.top_logic.model.search.expr.query.QueryExecutor;
import com.top_logic.model.util.TLModelPartRef;
import com.top_logic.model.util.TLModelPartRefsFormat;
import com.top_logic.threed.threejs.scene.SceneNode;
import com.top_logic.util.error.TopLogicException;
import com.top_logic.util.model.ModelService;

/**
 * {@link SceneBuilder} that can be parameterized with TL-Script.
 */
@Label("TL-Script scene builder")
public class SceneBuilderByExpression extends AbstractSceneBuilder
		implements ConfiguredInstance<SceneBuilderByExpression.Config> {

	private SceneBuilderByExpression.Config _config;

	private QueryExecutor _supportsModel;

	private final QueryExecutor _rootNode;

	private QueryExecutor _createNode;

	private QueryExecutor _resolveParts;

	private final Set<TLStructuredType> _typesToObserve;

	private QueryExecutor _supportsObject;

	private QueryExecutor _preload;

	private final QueryExecutor _nodesToUpdate;

	/**
	 * Configuration options for {@link SceneBuilderByExpression}.
	 */
	@DisplayOrder({
		Config.CREATE_NODE,
		Config.RESOLVE_PARTS,
		Config.PRELOAD,
		Config.ROOT_NODE,
		Config.SUPPORTS_MODEL,
		Config.SUPPORTS_OBJECT,
		Config.TYPES_TO_OBSERVE,
		Config.NODES_TO_UPDATE
	})
	public interface Config extends PolymorphicConfiguration<SceneBuilderByExpression> {

		/**
		 * Property name of {@link #getSupportsModel()}.
		 */
		String SUPPORTS_MODEL = "supportsModel";

		/**
		 * Property name of {@link #getCreateNode()}.
		 */
		String CREATE_NODE = "createNode";

		/**
		 * Property name of {@link #getResolveParts()}.
		 */
		String RESOLVE_PARTS = "resolveParts";

		/**
		 * @see #getPreload()
		 */
		String PRELOAD = "preload";

		/**
		 * Property name of {@link #getTypesToObserve()}.
		 */
		String TYPES_TO_OBSERVE = "typesToObserve";

		/**
		 * Property name of {@link #supportsObject()}.
		 */
		String SUPPORTS_OBJECT = "supportsObject";

		/**
		 * Property name of {@link #getNodesToUpdate()}.
		 */
		String NODES_TO_UPDATE = "nodesToUpdate";

		/**
		 * Predicate that decides whether the component supports the given model.
		 * 
		 * <p>
		 * The function receives a the component model as single argument.
		 * </p>
		 * 
		 * @see ModelBuilder#supportsModel(Object, LayoutComponent)
		 */
		@NonNullable
		@Name(SUPPORTS_MODEL)
		@ItemDefault(Expr.True.class)
		Expr getSupportsModel();

		/**
		 * Configuration property label for {@link #getRootNode()}
		 */
		String ROOT_NODE = "rootNode";

		/**
		 * Mapping function that receives the component model and returns the root business object
		 * of the top-level node in the scene graph.
		 */
		@Name(ROOT_NODE)
		@FormattedDefault("model -> $model")
		@NonNullable
		Expr getRootNode();

		/**
		 * Function creating a {@link SceneNode} for a given scene object.
		 * 
		 * <p>
		 * The function receives a scene object as first argument and the component's model as
		 * second argument. As result, a {@link SceneNode} is expected. For the returned node the
		 * given object is set as the node's business object.
		 * </p>
		 * 
		 * <pre>
		 * <code>node -> model -> threejsGltf(...)</code>
		 * </pre>
		 */
		@Mandatory
		@Name(CREATE_NODE)
		Expr getCreateNode();

		/**
		 * Function decomposing a scene group object into parts.
		 * 
		 * <p>
		 * The function receives a scene object as first argument and the component's model as
		 * second argument. As result, a list of part nodes of the given scene group object is
		 * expected. A result of <code>null</code> or the empty list means that the given scene
		 * object has no parts and the recursion stops.
		 * </p>
		 * 
		 * <pre>
		 * <code>node -> model -> $node.get(`my.module:MyNodeType#children`)</code>
		 * </pre>
		 */
		@ItemDefault(Expr.Null.class)
		@NonNullable
		@Name(RESOLVE_PARTS)
		Expr getResolveParts();

		/**
		 * Function performing a preload operation.
		 * 
		 * <p>
		 * The function receives a list of scene objects as first argument and a function as second
		 * argument. The function is expected to perform a preload on the given objects in a way
		 * that prevents further database lookups during the invocation of {@link #getCreateNode()}
		 * and {@link #getResolveParts()} function on those objects. The preload function is
		 * expected to call the function given as second argument and return the result of this
		 * function call.
		 * </p>
		 * 
		 * <p>
		 * The minimum function (not actually performing a preload at all) would be:
		 * </p>
		 * 
		 * <pre>
		 * <code>objects -> operation -> $operation()</code>
		 * </pre>
		 * 
		 * <p>
		 * A preload operation loading some attribute on all of the given objects would look like:
		 * </p>
		 * 
		 * <pre>
		 * <code>objects -> operation -> $objects.preload([`my.module:MyClass#myProp`], $operation)</code>
		 * </pre>
		 * 
		 * <p>
		 * Note: When invoking the `preload()` built-in function, the operation argument must be
		 * passed not its result by without calling it as in the first example. This ensures, that
		 * the operation is only called after the preload is done and while the caches are pinned.
		 * </p>
		 */
		@Nullable
		@Name(PRELOAD)
		Expr getPreload();

		/**
		 * The types whose instances have to be observed to update the scene.
		 */
		@Name(TYPES_TO_OBSERVE)
		@Format(TLModelPartRefsFormat.class)
		List<TLModelPartRef> getTypesToObserve();

		/**
		 * Whether the given business object is part of this scene.
		 * 
		 * <p>
		 * The function receives the potential scene object as first argument and the component's
		 * model as second argument. The function is expected to return a boolean deciding, whether
		 * this (new) object should be part of the currently displayed scene.
		 * </p>
		 * 
		 * <p>
		 * When e.g. an model event (object creation, deletion or update) is observed, the scene has
		 * to be updated, if the following holds: The {@link #supportsObject()} returns
		 * <code>true</code> for the object of this event.
		 * </p>
		 * 
		 * @see SceneBuilder#supportsObject(LayoutComponent, Object)
		 */
		@Name(SUPPORTS_OBJECT)
		@ItemDefault(Expr.False.class)
		@NonNullable
		Expr supportsObject();

		/**
		 * Function computing the nodes to update if a given object changes.
		 * 
		 * <p>
		 * The function receives the changed business object as first argument and the current
		 * component's model as second argument. The function can return scene objects whose scene
		 * nodes must be updated in response of a change in the given objects.
		 * </p>
		 * 
		 * @see SceneBuilderByExpression#getNodesToUpdate(LayoutComponent, Object)
		 */
		@Name(NODES_TO_UPDATE)
		@FormattedDefault("object -> $object")
		Expr getNodesToUpdate();

	}

	/**
	 * Creates a {@link SceneBuilderByExpression} from configuration.
	 * 
	 * @param context
	 *        The context for instantiating sub configurations.
	 * @param config
	 *        The configuration.
	 */
	@CalledByReflection
	public SceneBuilderByExpression(InstantiationContext context, Config config) {
		_config = config;
		
		KnowledgeBase kb = PersistencyLayer.getKnowledgeBase();
		TLModel model = ModelService.getApplicationModel();

		_supportsModel = QueryExecutor.compile(kb, model, config.getSupportsModel());
		_rootNode = QueryExecutor.compile(kb, model, config.getRootNode());
		_createNode = QueryExecutor.compile(kb, model, config.getCreateNode());
		_resolveParts = QueryExecutor.compile(kb, model, config.getResolveParts());
		_typesToObserve = Set.copyOf(resolveTypes(context, config.getTypesToObserve()));
		_supportsObject = QueryExecutor.compile(kb, model, config.supportsObject());
		_preload = QueryExecutor.compileOptional(config.getPreload());
		_nodesToUpdate = QueryExecutor.compile(kb, model, config.getNodesToUpdate());
	}

	private Set<TLStructuredType> resolveTypes(InstantiationContext context, List<TLModelPartRef> typeRefs) {
		if (typeRefs == null) {
			return Set.of();
		}
		Set<TLStructuredType> types = CollectionFactory.set();
		for (TLModelPartRef ref : typeRefs) {
			types.add(resolve(context, ref));
		}
		return types;
	}

	private TLClass resolve(InstantiationContext context, TLModelPartRef typeReference) {
		try {
			return typeReference.resolveClass();
		} catch (ConfigurationException exception) {
			context.error("Failed to resolve " + Utils.debug(typeReference) + ".", exception);
			return null;
		}
	}

	@Override
	public Config getConfig() {
		return _config;
	}

	@Override
	public boolean supportsModel(Object aModel, LayoutComponent aComponent) {
		return SearchExpression.asBoolean(_supportsModel.execute(aModel));
	}

	@Override
	public SceneNode getModel(Object businessModel, LayoutComponent aComponent) {
		Object rootObj = _rootNode.execute(businessModel);
		SceneNode rootNode = createSubtree(rootObj, aComponent);

		return rootNode;
	}

	@Override
	public SceneNode createNode(Object businessModel, LayoutComponent component) {
		SceneNode node = (SceneNode) _createNode.execute(businessModel, component.getModel());

		if (node != null) {
			node.setUserData(businessModel);
		}

		return node;
	}

	@Override
	public Collection<?> resolveParts(Object businessModel, LayoutComponent component) {
		return SearchExpression.asCollection(_resolveParts.execute(businessModel, component.getModel()));
	}

	@Override
	protected void preload(List<Object> businessModels, Runnable job) {
		if (_preload == null) {
			job.run();
			return;
		}

		Object result = _preload.execute(businessModels, new WrappedRunnable(job));

		if (result != WrappedRunnable.MARKER) {
			throw new TopLogicException(I18NConstants.ERROR_OPERATION_ARGUMENT_NOT_CALLED);
		}
	}

	@Override
	public Set<TLStructuredType> getTypesToObserve() {
		return _typesToObserve;
	}

	@Override
	public boolean supportsObject(LayoutComponent component, Object object) {
		return asBoolean(_supportsObject.execute(object, component.getModel()));
	}

	private static boolean asBoolean(Object result) {
		if (result instanceof Boolean) {
			return ((Boolean) result).booleanValue();
		} else {
			return false;
		}
	}

	private static final class WrappedRunnable extends GenericMethod {
		private static final SearchExpression[] NO_ARGS = new SearchExpression[0];

		private static final NamedConstant MARKER = new NamedConstant("was-called");

		private final Runnable _job;

		/**
		 * Creates a {@link WrappedRunnable}.
		 */
		private WrappedRunnable(Runnable job) {
			super("<wrapped-runnable>", NO_ARGS);
			_job = job;
		}

		@Override
		public TLType getType(List<TLType> argumentTypes) {
			return null;
		}

		@Override
		protected Object eval(Object[] arguments, EvalContext definitions) {
			_job.run();
			return MARKER;
		}

		@Override
		public boolean isSideEffectFree() {
			return false;
		}

		@Override
		public boolean canEvaluateAtCompileTime(Object[] arguments) {
			return false;
		}

		@Override
		public GenericMethod copy(SearchExpression[] arguments) {
			return new WrappedRunnable(_job);
		}
	}

	@Override
	public Collection<?> getNodesToUpdate(LayoutComponent contextComponent, Object businessObject) {
		return SearchExpression.asCollection(_nodesToUpdate.execute(businessObject, contextComponent.getModel()));
	}

}
