/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.core.math.format;

import com.top_logic.basic.config.ConfigurationValueProvider;
import com.top_logic.element.meta.ComplexValueProvider;
import com.top_logic.element.meta.OptionProvider;
import com.top_logic.threed.core.math.Transformation;

/**
 * {@link ConfigurationValueProvider} allowing to store {@link Transformation} values in
 * configurations.
 */
public class TransformationValueProvider implements ComplexValueProvider<Transformation> {

	/**
	 * Singleton {@link TransformationValueProvider} instance.
	 */
	public static final TransformationValueProvider INSTANCE = new TransformationValueProvider();

	private TransformationValueProvider() {
		super();
	}

	@Override
	public Class<? extends Transformation> getApplicationType() {
		return Transformation.class;
	}

	@Override
	public Transformation getBusinessObject(Object storageObject) {
		String sourceValue = (String) storageObject;
		if (storageObject == null || sourceValue.isEmpty()) {
			return Transformation.identity();
		}

		return parse(sourceValue);
	}

	private Transformation parse(String storageObject) {
		String[] values = storageObject.split(",");

		if (values.length == 16) {
			return new Transformation(
				Double.parseDouble(values[0]), Double.parseDouble(values[4]), Double.parseDouble(values[8]),
				Double.parseDouble(values[1]), Double.parseDouble(values[5]), Double.parseDouble(values[9]),
				Double.parseDouble(values[2]), Double.parseDouble(values[6]), Double.parseDouble(values[10]),
				Double.parseDouble(values[12]), Double.parseDouble(values[13]), Double.parseDouble(values[14]));
		} else {
			throw new IllegalArgumentException(
				"Not a transformation specification, not 16 values (rotation and translation): " + storageObject);
		}
	}

	@Override
	public Object getStorageObject(Object businessObject) {
		if (businessObject == null) {
			return null;
		}

		return format((Transformation) businessObject);
	}

	private Object format(Transformation transformation) {
		StringBuilder builder = new StringBuilder();

		builder.append(transformation.a());
		builder.append(",");
		builder.append(transformation.d());
		builder.append(",");
		builder.append(transformation.g());
		builder.append(",");
		builder.append(0);
		builder.append(",");
		builder.append(transformation.b());
		builder.append(",");
		builder.append(transformation.e());
		builder.append(",");
		builder.append(transformation.h());
		builder.append(",");
		builder.append(0);
		builder.append(",");
		builder.append(transformation.c());
		builder.append(",");
		builder.append(transformation.f());
		builder.append(",");
		builder.append(transformation.i());
		builder.append(",");
		builder.append(0);
		builder.append(",");
		builder.append(transformation.x());
		builder.append(",");
		builder.append(transformation.y());
		builder.append(",");
		builder.append(transformation.z());
		builder.append(",");
		builder.append(1);

		return builder.toString();
	}

	@Override
	public boolean isCompatible(Object businessObject) {
		return businessObject == null || businessObject instanceof Transformation;
	}

	@Override
	public OptionProvider getOptionProvider() {
		return null;
	}

}
