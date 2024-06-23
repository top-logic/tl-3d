/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.core.math.ui;

import com.top_logic.element.meta.form.AbstractFieldProvider;
import com.top_logic.element.meta.form.EditContext;
import com.top_logic.element.meta.form.FieldProvider;
import com.top_logic.layout.form.FormMember;
import com.top_logic.layout.form.model.ComplexField;
import com.top_logic.layout.form.model.FormFactory;
import com.top_logic.layout.form.template.DefaultFormFieldControlProvider;
import com.top_logic.threed.core.math.Transformation;
import com.top_logic.threed.core.math.format.TransformationFormat;

/**
 * {@link FieldProvider} for {@link Transformation} fields.
 *
 * @author <a href="mailto:sven.foerster@top-logic.com">Sven Förster</a>
 */
public class TransformationFieldProvider extends AbstractFieldProvider {

	/**
	 * Singleton {@link TransformationFieldProvider} instance.
	 */
	public static final TransformationFieldProvider INSTANCE = new TransformationFieldProvider();

	private TransformationFieldProvider() {
		// Singleton constructor.
	}

	@Override
	public FormMember getFormField(EditContext editContext, String fieldName) {
		ComplexField result = FormFactory.newComplexField(fieldName, TransformationFormat.INSTANCE);
		result.setControlProvider(DefaultFormFieldControlProvider.INSTANCE);
		return result;
	}

}
