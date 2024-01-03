/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.math;

import static java.lang.Math.*;

import java.util.Arrays;
import java.util.Collection;

import com.top_logic.tl3d.util.MapLike;

/**
 * A linear transformation of Euclidean space R3.
 */
public class Transformation extends MapLike {

	private static final Transformation IDENTITY = new Transformation(
		1, 0, 0,
		0, 1, 0,
		0, 0, 1,
		0, 0, 0);

	// First row of the rotation matrix.
	private final double _a, _b, _c;

	// Second row of the rotation matrix.
	private final double _d, _e, _f;

	// Third row of the rotation matrix.
	private final double _g, _h, _i;

	// The translation vector.
	private final double _x, _y, _z;

	/**
	 * Creates a {@link Transformation} matrix.
	 * 
	 * <pre>
	 * [a b c x]
	 * [d e f y]
	 * [g h i z]
	 * [0 0 0 1]
	 * </pre>
	 * 
	 * <p>
	 * The values <code>a</code> to <code>i</code> represent the rotation, and <code>x</code> to
	 * <code>z</code> the translation.
	 * </p>
	 */
	public Transformation(
			double a, double b, double c,
			double d, double e, double f,
			double g, double h, double i,
			double x, double y, double z) {
		this._a = a;
		this._b = b;
		this._c = c;

		this._d = d;
		this._e = e;
		this._f = f;

		this._g = g;
		this._h = h;
		this._i = i;

		this._x = x;
		this._y = y;
		this._z = z;
	}

	/**
	 * Row 1, column 1 of the transformation matrix.
	 */
	public double a() {
		return _a;
	}

	/**
	 * Row 1, column 2 of the transformation matrix.
	 */
	public double b() {
		return _b;
	}

	/**
	 * Row 1, column 3 of the transformation matrix.
	 */
	public double c() {
		return _c;
	}

	/**
	 * Row 2, column 1 of the transformation matrix.
	 */
	public double d() {
		return _d;
	}

	/**
	 * Row 2, column 2 of the transformation matrix.
	 */
	public double e() {
		return _e;
	}

	/**
	 * Row 2, column 3 of the transformation matrix.
	 */
	public double f() {
		return _f;
	}

	/**
	 * Row 3, column 1 of the transformation matrix.
	 */
	public double g() {
		return _g;
	}

	/**
	 * Row 3, column 2 of the transformation matrix.
	 */
	public double h() {
		return _h;
	}

	/**
	 * Row 3, column 3 of the transformation matrix.
	 */
	public double i() {
		return _i;
	}

	/**
	 * Translation in X.
	 */
	public double x() {
		return _x;
	}

	/**
	 * Translation in Y.
	 */
	public double y() {
		return _y;
	}

	/**
	 * Translation in Z.
	 */
	public double z() {
		return _z;
	}

	/**
	 * The identity transformation.
	 */
	public static Transformation identity() {
		return IDENTITY;
	}

	/**
	 * A pure translation.
	 */
	public static Transformation translate(double x, double y, double z) {
		return new Transformation(
			1, 0, 0,
			0, 1, 0,
			0, 0, 1,
			x, y, z);
	}

	/**
	 * A rotation along the X axis.
	 */
	public static Transformation rotateX(double a) {
		double cosa = cos(a);
		double sina = sin(a);
		return new Transformation(
			1, 0, 0,
			0, cosa, -sina,
			0, sina, cosa,
			0, 0, 0);
	}

	/**
	 * A rotation along the Y axis.
	 */
	public static Transformation rotateY(double a) {
		double cosa = cos(a);
		double sina = sin(a);
		return new Transformation(
			cosa, 0, sina,
			0, 1, 0,
			-sina, 0, cosa,
			0, 0, 0);
	}

	/**
	 * A rotation along the Z axis.
	 */
	public static Transformation rotateZ(double a) {
		double cosa = cos(a);
		double sina = sin(a);
		return new Transformation(
			cosa, -sina, 0,
			sina, cosa, 0,
			0, 0, 1,
			0, 0, 0);
	}

	//
	// [a b c x]     [x]
	// [d e f y]  *  [y]
	// [g h i z]     [z]
	// [0 0 0 1]     [1]
	//
	
	/**
	 * Transforms the given vector.
	 */
	public Vec3d apply(Vec3d v) {
		return apply(v.x(), v.y(), v.z());
	}

	/**
	 * Transforms the given vector.
	 */
	public Vec3d apply(double x, double y, double z) {
		return Vec3d.vec(_a * x + _b * y + _c * z + _x, _d * x + _e * y + _f * z + _y, _g * x + _h * y + _i * z + _z);
	}

	//   this          other
	// [a b c x]     [a b c x]
	// [d e f y]  *  [d e f y]
	// [g h i z]     [g h i z]
	// [0 0 0 1]     [0 0 0 1]
	//

	/**
	 * Creates a transformation by first applying the given transformation and then applying this
	 * transformation.
	 */
	public Transformation after(Transformation other) {
		return new Transformation(
			_a * other._a + _b * other._d + _c * other._g,
			_a * other._b + _b * other._e + _c * other._h,
			_a * other._c + _b * other._f + _c * other._i,

			_d * other._a + _e * other._d + _f * other._g,
			_d * other._b + _e * other._e + _f * other._h,
			_d * other._c + _e * other._f + _f * other._i,

			_g * other._a + _h * other._d + _i * other._g,
			_g * other._b + _h * other._e + _i * other._h,
			_g * other._c + _h * other._f + _i * other._i,

			_a * other._x + _b * other._y + _c * other._z + _x,
			_d * other._x + _e * other._y + _f * other._z + _y,
			_g * other._x + _h * other._y + _i * other._z + _z
		);
	}
	
	@Override
	public String toString() {
		return "M(" +
			_a + ", " + _b + ", " + _c + ", " + 
			_d + ", " + _e + ", " + _f + ", " + 
			_g + ", " + _h + ", " + _i + ") " +
			"T(" + 
			_x + ", " + _y + ", " + _z + ")";
	}

	@Override
	public Collection<String> properties() {
		return Arrays.asList(
			"a", "a", "a",
			"b", "c", "d",
			"e", "f", "g",
			"x", "y", "z"
		);
	}

	@Override
	public Object get(String name) {
		switch (name) {
			case "a": return a();
			case "b": return b();
			case "c": return c();

			case "d": return d();
			case "e": return e();
			case "f": return f();
			
			case "g": return g();
			case "h": return h();
			case "i": return i();
			
			case "x": return x();
			case "y": return y();
			case "z": return z();
		}
		return null;
	}
}
