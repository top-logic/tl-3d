/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.util;

import java.util.AbstractMap;
import java.util.AbstractSet;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Iterator;
import java.util.List;
import java.util.Set;

import com.top_logic.model.search.expr.SearchExpression;

/**
 * Base class for map-like objects.
 * 
 * <p>
 * A map-like object can be seen as a JSON object with properties that are either primitives, lists,
 * or other map-like objects.
 * </p>
 */
public abstract class MapLike extends AbstractMap<String, Object> {

	/**
	 * All property names supported by this object.
	 */
	public abstract Collection<String> properties();

	/**
	 * Generically accesses the property with the given name.
	 */
	public abstract Object get(String name);

	/**
	 * Updates the property with the given name.
	 * 
	 * @param name
	 *        The name of the property to update.
	 * @param value
	 *        The new value of the property.
	 */
	public void set(String name, Object value) {
		throw new IllegalArgumentException("Cannot set property: " + name);
	}

	@Override
	public final Object get(Object key) {
		if (key instanceof String) {
			return get((String) key);
		} else {
			return null;
		}
	}

	@Override
	public Set<Entry<String, Object>> entrySet() {
		return new AbstractSet<>() {
			@Override
			public int size() {
				return properties().size();
			}

			@Override
			public Iterator<Entry<String, Object>> iterator() {
				return new Iterator<>() {
					Iterator<String> _base = properties().iterator();

					@Override
					public boolean hasNext() {
						return _base.hasNext();
					}

					@Override
					public Entry<String, Object> next() {
						String name = _base.next();

						return new Entry<>() {
							@Override
							public String getKey() {
								return name;
							}

							@Override
							public Object getValue() {
								return get(name);
							}

							@Override
							public Object setValue(Object value) {
								Object old = get(name);
								set(name, value);
								return old;
							}
						};
					}
				};
			}

			@Override
			public boolean add(Entry<String, Object> e) {
				throw new UnsupportedOperationException();
			}

			@Override
			public boolean addAll(Collection<? extends Entry<String, Object>> c) {
				throw new UnsupportedOperationException();
			}
		};
	}

	/**
	 * Helper to convert an arbitrary value to string.
	 */
	protected static String asString(Object value) {
		if (value == null) {
			return null;
		}
		return value.toString();
	}

	/**
	 * Helper to convert an arbitrary value to boolean.
	 */
	protected static boolean asBoolean(Object value) {
		return SearchExpression.isTrue(value);
	}

	/**
	 * Helper to convert an arbitrary value to int.
	 */
	protected static int asInt(Object value) {
		return SearchExpression.asInt(null, value);
	}

	/**
	 * Helper to convert an arbitrary value to double.
	 */
	protected static double asDouble(Object value) {
		return SearchExpression.asDouble(null, value);
	}

	/**
	 * Helper to convert an arbitrary value to double.
	 */
	protected static <T> List<T> asList(Class<? extends T> type, Object value) {
		List<?> input = SearchExpression.asList(value);
		ArrayList<T> result = new ArrayList<>(input.size());
		for (Object in : input) {
			result.add(type.cast(in));
		}
		return result;
	}

	/**
	 * Helper to convert an arbitrary value to double.
	 */
	protected static <T> T as(Class<? extends T> type, Object value) {
		return type.cast(value);
	}
}
