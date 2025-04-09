/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.core.math.format;

import java.text.FieldPosition;
import java.text.Format;
import java.text.ParseException;
import java.text.ParsePosition;

import com.top_logic.basic.config.ConfigurationException;
import com.top_logic.element.meta.form.fieldprovider.format.FormatProvider;
import com.top_logic.threed.core.math.Transformation;

/**
 * {@link Format} parsing a transformation string into the corresponding {@link Transformation}
 * object.
 * 
 * @author <a href="mailto:sven.foerster@top-logic.com">Sven Förster</a>
 */
public class TransformationFormat extends Format implements FormatProvider {

	/**
	 * Singleton {@link TransformationFormat} instance.
	 */
	public static final TransformationFormat INSTANCE = new TransformationFormat();

	@Override
	public StringBuffer format(Object object, StringBuffer buffer, FieldPosition position) {
		if (object instanceof Transformation) {
			return buffer.append(((Transformation) object).toString());
		} else {
			throw new IllegalArgumentException("The object has to be a Transformation object");
		}
	}

	@Override
	public Object parseObject(String source, ParsePosition position) {
		Transformation transformation;
		try {
			transformation = TxParser.parseTx(source);
			position.setIndex(source.length());
		} catch (ParseException ex) {
			transformation = null;
			position.setErrorIndex(ex.getErrorOffset());
		}

		return transformation;
	}

	@Override
	public Format createFormat() throws ConfigurationException {
		return this;
	}

}
