/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.core.math;

import static java.lang.Math.*;

import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Objects;

import org.apache.commons.math3.linear.LUDecomposition;
import org.apache.commons.math3.linear.MatrixUtils;
import org.apache.commons.math3.linear.RealMatrix;

import com.top_logic.threed.core.math.format.I18NConstants;
import com.top_logic.threed.core.util.MapLike;
import com.top_logic.util.error.TopLogicException;

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
	 * @see #Transformation(double, double, double, double, double, double, double, double, double,
	 *      double, double, double)
	 */
	public Transformation(List<Double> rotation, List<Double> translation) {
		this(rotation.get(0), rotation.get(1), rotation.get(2), rotation.get(3), rotation.get(4), rotation.get(5),
			rotation.get(6), rotation.get(7), rotation.get(8), translation.get(0), translation.get(1),
			translation.get(2));
	}

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
	 * A pure translation.
	 */
	public static Transformation rotate(double a, double b, double c, double d, double e, double f, double g, double h,
			double i) {
		return new Transformation(
			a, b, c,
			d, e, f,
			g, h, i,
			0, 0, 0);
	}

	/**
	 * A rotation along the X axis.
	 */
	public static Transformation rotateX(double a) {
		double cosa = cos(a);
		double sina = sin(a);
		return new Transformation(
			1,    0,     0,
			0, cosa, -sina,
			0, sina,  cosa,
			0,    0,     0);
	}

	/**
	 * A rotation along the Y axis.
	 */
	public static Transformation rotateY(double a) {
		double cosa = cos(a);
		double sina = sin(a);
		return new Transformation(
			 cosa, 0, sina,
			    0, 1,    0,
			-sina, 0, cosa,
			    0, 0,    0);
	}

	/**
	 * A rotation along the Z axis.
	 */
	public static Transformation rotateZ(double a) {
		double cosa = cos(a);
		double sina = sin(a);
		return new Transformation(
			cosa, -sina, 0,
			sina,  cosa, 0,
			   0,     0, 1,
			   0,     0, 0);
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
		if (IDENTITY.equals(other)) {
			return this;
		} else if (IDENTITY.equals(this)) {
			return other;
		} else {
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
				_g * other._x + _h * other._y + _i * other._z + _z);
		}
	}
	
	/**
	 * The inverse of this transformation.
	 */
	public Transformation inverse() {
		if (IDENTITY.equals(this)) {
			return IDENTITY;
		}

		return toTransformation(new LUDecomposition(toRealMatrix(this)).getSolver().getInverse());
	}

	private RealMatrix toRealMatrix(Transformation matrix) {
		return MatrixUtils.createRealMatrix(new double[][] {
			{ matrix._a, matrix._b, matrix._c, matrix._x },
			{ matrix._d, matrix._e, matrix._f, matrix._y },
			{ matrix._g, matrix._h, matrix._i, matrix._z },
			{ 0, 0, 0, 1 }
		});
	}

	private Transformation toTransformation(RealMatrix matrix) {
		double[][] data = matrix.getData();

		return new Transformation(
			data[0][0], data[0][1], data[0][2],
			data[1][0], data[1][1], data[1][2],
			data[2][0], data[2][1], data[2][2],
			data[0][3], data[1][3], data[2][3]
		);
	}

	@Override
	public String toString() {
		return "M(" +
			_a + ", " + _d + ", " + _g + ", " +
			_b + ", " + _e + ", " + _h + ", " +
			_c + ", " + _f + ", " + _i + ") " +
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

	/**
	 * Cast to {@link Transformation}.
	 */
	public static Transformation cast(Object object) {
		if (object instanceof Transformation) {
			return (Transformation) object;
		} else {
			throw new TopLogicException(I18NConstants.ERROR_IS_NOT_A_TRANSFORMATION__VALUE.fill(object));
		}
	}

	/**
	 * Creates a {@link Transformation} matrix.
	 *
	 * @param rotation
	 *        Column major ordered rotation matrix values.
	 * @param translation
	 *        Translation vector values.
	 */
	public static Transformation createColumnMajorTransformation(List<Double> rotation, List<Double> translation) {
		return new Transformation(
			rotation.get(0), rotation.get(3), rotation.get(6), 
			rotation.get(1), rotation.get(4), rotation.get(7),
			rotation.get(2), rotation.get(5), rotation.get(8), 
			translation.get(0), translation.get(1), translation.get(2)
		);
	}

	@Override
	public int hashCode() {
		final int prime = 31;
		int result = prime + Objects.hash(_a, _b, _c, _d, _e, _f, _g, _h, _i, _x, _y, _z);
		return result;
	}

	@Override
	public boolean equals(Object obj) {
		if (this == obj)
			return true;
		if (!super.equals(obj))
			return false;
		if (getClass() != obj.getClass())
			return false;
		Transformation other = (Transformation) obj;
		return Double.doubleToLongBits(_a) == Double.doubleToLongBits(other._a)
			&& Double.doubleToLongBits(_b) == Double.doubleToLongBits(other._b)
			&& Double.doubleToLongBits(_c) == Double.doubleToLongBits(other._c)
			&& Double.doubleToLongBits(_d) == Double.doubleToLongBits(other._d)
			&& Double.doubleToLongBits(_e) == Double.doubleToLongBits(other._e)
			&& Double.doubleToLongBits(_f) == Double.doubleToLongBits(other._f)
			&& Double.doubleToLongBits(_g) == Double.doubleToLongBits(other._g)
			&& Double.doubleToLongBits(_h) == Double.doubleToLongBits(other._h)
			&& Double.doubleToLongBits(_i) == Double.doubleToLongBits(other._i)
			&& Double.doubleToLongBits(_x) == Double.doubleToLongBits(other._x)
			&& Double.doubleToLongBits(_y) == Double.doubleToLongBits(other._y)
			&& Double.doubleToLongBits(_z) == Double.doubleToLongBits(other._z);
	}

}
