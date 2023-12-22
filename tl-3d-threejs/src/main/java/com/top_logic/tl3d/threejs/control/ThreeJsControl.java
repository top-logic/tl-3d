/*
 * SPDX-FileCopyrightText: 2023 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.threejs.control;

import java.io.IOException;

import com.top_logic.basic.xml.TagWriter;
import com.top_logic.layout.DisplayContext;
import com.top_logic.layout.UpdateQueue;
import com.top_logic.layout.basic.AbstractControlBase;
import com.top_logic.mig.html.HTMLUtil;

/**
 * @author bhu
 *
 */
public class ThreeJsControl extends AbstractControlBase {

	@Override
	public Object getModel() {
		return null;
	}

	@Override
	public boolean isVisible() {
		return true;
	}

	@Override
	protected boolean hasUpdates() {
		return false;
	}

	@Override
	protected void internalRevalidate(DisplayContext context, UpdateQueue actions) {
		// Nothing yet.
	}

	@Override
	protected void internalWrite(DisplayContext context, TagWriter out) throws IOException {
		out.beginBeginTag(DIV);
		out.writeAttribute(ID_ATTR, getID());
		out.writeAttribute(STYLE_ATTR, "position: absolute; width: 100%; height: 100%; background-color: skyblue;");
		out.endBeginTag();

		HTMLUtil.beginScriptAfterRendering(out);
		out.append("window.services.threejs.init('" + getID() + "')");
		HTMLUtil.endScriptAfterRendering(out);

		out.endTag(DIV);
	}

}
