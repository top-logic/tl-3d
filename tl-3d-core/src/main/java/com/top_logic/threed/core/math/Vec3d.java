/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.core.math;

import static java.lang.Math.*;

import java.util.Arrays;
import java.util.Collection;

import com.top_logic.threed.core.util.MapLike;

/**
 * A vector in 3D Euclidean space.
 */
public class Vec3d extends MapLike {

	/**
	 * Creates a {@link Vec3d}.
	 * 
	 * @param x
	 *        The X coordinate.
	 * @param y
	 *        The Y coordinate.
	 * @param z
	 *        The Z coordinate.
	 */
	public static Vec3d vec(double x, double y, double z) {
		return new Vec3d(x, y, z);
	}

	private final double _x, _y, _z;

	private Vec3d(double x, double y, double z) {
		_x = x;
		_y = y;
		_z = z;
	}

	/**
	 * The X coordinate.
	 */
	public double x() {
		return _x;
	}

	/**
	 * The Y coordinate.
	 */
	public double y() {
		return _y;
	}

	/**
	 * The Z coordinate.
	 */
	public double z() {
		return _z;
	}

	/**
	 * Addition of this and the other vector.
	 */
	public Vec3d add(Vec3d other) {
		return add(other.x(), other.y(), other.z());
	}

	/**
	 * Addition of this and the given vector.
	 */
	public Vec3d add(double x, double y, double z) {
		return vec(_x + x, _y + y, _z + z);
	}

	/**
	 * Substraction of the other vector from this one.
	 */
	public Vec3d sub(Vec3d other) {
		return sub(other.x(), other.y(), other.z());
	}

	/**
	 * Substraction of the given vector from this one.
	 */
	public Vec3d sub(double x, double y, double z) {
		return vec(_x - x, _y - y, _z - z);
	}

	/**
	 * The scalar product of this and the other vector.
	 */
	public double mul(Vec3d other) {
		return mul(other.x(), other.y(), other.z());
	}

	/**
	 * The scalar product of this and the given vector.
	 */
	public double mul(double x, double y, double z) {
		return _x * x + _y * y + _z * z;
	}

	/**
	 * The length of this vector.
	 */
	public double length() {
		return sqrt(_x * _x + _y * _y + _z * _z);
	}

	@Override
	public String toString() {
		return "(" + _x + ", " + _y + ", " + _z + ")";
	}

	@Override
	public Collection<String> properties() {
		return Arrays.asList("x", "y", "z");
	}

	@Override
	public Object get(String name) {
		switch (name) {
			case "x": return x();
			case "y": return y();
			case "z": return z();
		}
		return null;
	}
}
