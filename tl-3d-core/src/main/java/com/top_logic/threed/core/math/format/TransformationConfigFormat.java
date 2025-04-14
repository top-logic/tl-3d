/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.core.math.format;

import java.text.Format;

import com.top_logic.basic.config.ConfigurationValueProvider;
import com.top_logic.basic.config.format.ConfigurationFormatAdapter;
import com.top_logic.basic.util.ResKey;
import com.top_logic.threed.core.math.Transformation;

/**
 * {@link ConfigurationValueProvider} adapting {@link TransformationFormat}.
 * 
 * @author <a href="mailto:sven.foerster@top-logic.com">Sven Förster</a>
 */
public class TransformationConfigFormat extends ConfigurationFormatAdapter<Transformation> {

	/**
	 * Singleton {@link TransformationConfigFormat} instance.
	 */
	public static final TransformationConfigFormat INSTANCE = new TransformationConfigFormat();

	private TransformationConfigFormat() {
		super(Transformation.class);
	}

	@Override
	protected Format format() {
		return TransformationFormat.INSTANCE;
	}

	@Override
	protected ResKey errorMessage(int errorIndex) {
		return ResKey.text("Is not a valid transformation format.");
	}

}
