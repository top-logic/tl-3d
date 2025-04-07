/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.threed.core.math.format;

import java.text.ParseException;

import com.top_logic.threed.core.math.Transformation;

/**
 * Parser for {@link Transformation}s.
 */
public class TxParser {

	/**
	 * Parses a {@link Transformation} in scene file format.
	 */
	public static Transformation parseTx(String tx) throws ParseException {
		return parseTx(0, tx);
	}

	/**
	 * Parses a {@link Transformation} in scene file format.
	 */
	public static Transformation parseTx(int start, String tx) throws ParseException {
		return new TxParser(start, tx).parse();
	}

	private String _str;

	private int _idx = 0;
	private final int _len;

	private int _offset;

	/** 
	 * Creates a {@link TxParser}.
	 */
	TxParser(int offset, String str) {
		_offset = offset;
		_str = str;
		_len = str.length();
	}

	Transformation parse() throws ParseException {
		double a = 1, b = 0, c = 0;
		double d = 0, e = 1, f = 0;
		double g = 0, h = 0, i = 1;
		double x = 0, y = 0, z = 0;

		while (hasNext()) {
			char next = next();
			switch (next) {
				case 'M': {
					expect('('); ws();
					a = readNum(); comma();
					d = readNum(); comma();
					g = readNum(); comma();
					
					b = readNum(); comma();
					e = readNum(); comma();
					h = readNum(); comma();
					
					c = readNum(); comma();
					f = readNum(); comma();
					i = readNum(); ws();
					expect(')'); ws();
					break;
				}
				case 'T': {
					expect('('); ws();
					x = readNum(); comma();
					y = readNum(); comma();
					z = readNum(); ws();
					expect(')'); ws();
					break;
				}
				default: {
					throw new ParseException(
						"Unexpected token '" + next + "' at position " + _offset + " while parsing transformation: "
							+ _str,
						_offset);
				}
			}
		}
		
		return new Transformation(
			a, b, c,
			d, e, f,
			g, h, i,

			x, y, z);
	}

	private void comma() throws ParseException {
		ws(); expect(','); ws();
	}

	private void ws() {
		while (hasNext() && Character.isWhitespace(lookingAt())) {
			skip();
		}
	}

	private double readNum() throws ParseException {
		int start = _idx;
		while (hasNext()) {
			char ch = lookingAt();
			if (ch == ')' || ch == ',') {
				break;
			}
			skip();
		}

		String num = _str.substring(start, _idx);
		try {
			return Double.parseDouble(num);
		} catch (NumberFormatException ex) {
			int position = _idx - _offset;
			throw new ParseException(
				"Invalid number format in '" + num + "' at position " + position + ": " + ex.getMessage(),
				position);
		}
	}

	private void expect(char ch) throws ParseException {
		expectLookingAt(ch);
		skip();
	}

	private void expectLookingAt(char ch) throws ParseException {
		if (!hasNext()) {
			int position = _idx - _offset;
			throw new ParseException("Missing character in transformation at position " + position + ".", position);
		}
		if (lookingAt() != ch) {
			int position = _idx - _offset;
			throw new ParseException(
				"Expected character '" + ch + "' in transformation at position " + position + ".", position);
		}
	}

	private char next() {
		char result = lookingAt();
		skip();
		return result;
	}

	private void skip() {
		_idx++;
	}

	private char lookingAt() {
		return _str.charAt(_idx);
	}

	private boolean hasNext() {
		return _idx < _len;
	}
}