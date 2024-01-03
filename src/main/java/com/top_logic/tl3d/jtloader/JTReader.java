/*
 * SPDX-FileCopyrightText: 2024 (c) Business Operation Systems GmbH <info@top-logic.com>
 * 
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-BOS-TopLogic-1.0
 */
package com.top_logic.tl3d.jtloader;

import java.io.EOFException;
import java.io.IOException;
import java.io.RandomAccessFile;

import com.top_logic.tl3d.jtloader.structure.ByteOrder;

/**
 * @author bhu
 *
 */
public class JTReader {
	
	public static final int I32_LENGTH = 4;

	public static final int U32_LENGTH = 4;

	public static final int U16_LENGTH = 2;

	public static final int U8_LENGTH = 1;
	
	private RandomAccessFile _in;
	
	private long _pos;

	private boolean _bigEndian;

	/** 
	 * Creates a {@link JTReader}.
	 */
	public JTReader(RandomAccessFile in) {
		_in = in;
	}

	/**
	 * An unsigned 8-bit byte.
	 */
	public char readUChar() throws IOException {
		return (char) readU8();
	}

	/**
	 * An unsigned 8-bit integer value.
	 */
	public int readU8() throws IOException {
		return read();
	}
	
	/**
	 * An unsigned 16-bit integer value.
	 */
	public int readU16() throws IOException {
		int msb, lsb;
		if (_bigEndian) {
			msb = read();
			lsb = read();
		} else {
			lsb = read();
			msb = read();
		}
		return (msb << 8) | lsb;
	}
	
	/**
	 * A signed two’s complement 16-bit integer value.
	 */
	public int readI16() throws IOException {
		int msb = readSigned();
		int lsb = read();
		return (msb << 8) | lsb;
	}

	/**
	 * An unsigned 32-bit integer value.
	 */
	public int readU32() throws IOException {
		int b3, b2, b1, b0;
		if (_bigEndian) {
			b3 = read();
			b2 = read();
			b1 = read();
			b0 = read();
		} else {
			b0 = read();
			b1 = read();
			b2 = read();
			b3 = read();
		}
		return (b3 << 24) | (b2 << 16) | (b1 << 8) | b0;
	}
	
	/**
	 * A signed two’s complement 32-bit integer value.
	 */
	public int readI32() throws IOException {
		int b3, b2, b1, b0;
		if (_bigEndian) {
			b3 = readSigned();
			b2 = read();
			b1 = read();
			b0 = read();
		} else {
			b0 = read();
			b1 = read();
			b2 = read();
			b3 = readSigned();
		}
		return (b3 << 24) | (b2 << 16) | (b1 << 8) | b0;
	}
	
	/**
	 * An IEEE 32-bit floating point number.
	 */
	public float readF32() throws IOException {
		return Float.intBitsToFloat(readU32());
	}
	
	/**
	 * An unsigned 64-bit integer value.
	 */
	public long readU64() throws IOException {
		long msb, lsb;
		if (_bigEndian) {
			msb = readU32() & 0xFFFFFF;
			lsb = readU32() & 0xFFFFFF;
		} else {
			lsb = readU32() & 0xFFFFFF;
			msb = readU32() & 0xFFFFFF;
		}
		return (msb << 32) | lsb;
	}
	
	/**
	 * A signed two's complement 64-bit integer value.
	 */
	public long readI64() throws IOException {
		long msb, lsb;
		if (_bigEndian) {
			msb = readU32();
			lsb = readU32() & 0xFFFFFF;
		} else {
			lsb = readU32() & 0xFFFFFF;
			msb = readU32();
		}
		return (msb << 32) | lsb;
	}

	/**
	 * An IEEE 64-bit double precision floating point number
	 */
	public double readF64() throws IOException {
		return Double.longBitsToDouble(readU64());
	}
	
	/**
	 * A string value.
	 */
	public String readMbString() throws IOException {
		StringBuilder result = new StringBuilder();
		
		int cnt = readI32();
		for (int n = 0; n < cnt; n++) {
			result.append((char) readU16());
		}
		return result.toString();
	}
	
	/**
	 * An ASCII string value.
	 */
	public String readString() throws IOException {
		return readString(readI32());
	}
	
	/**
	 * An fixed-length ASCII string value.
	 */
	public String readString(int length) throws IOException {
		StringBuilder result = new StringBuilder();
		for (int n = 0; n < length; n++) {
			result.append(readUChar());
		}
		return result.toString();
	}
	
	private byte readSigned() throws IOException, EOFException {
		return (byte) read();
	}
	
	private int read() throws IOException, EOFException {
		int data = _in.read();
		if (data < 0) {
			throw new EOFException();
		}
		_pos++;
		return data & 0xFF;
	}

	/** 
	 * Sets the byte order for reading.
	 */
	public void setByteOrder(ByteOrder byteOrder) {
		_bigEndian = byteOrder == ByteOrder.MsbFirst;
	}

	/** 
	 * Skips the given number of bytes. 
	 */
	public void skip(long skip) throws IOException {
		_pos += skip;
		_in.seek(_pos);
	}
	
	/**
	 * The current byte position in the stream.
	 */
	public long getPos() {
		return _pos;
	}

	/** 
	 * Positions the read pointer to the given position.
	 */
	public void seek(long pos) throws IOException {
		_pos = pos;
		_in.seek(_pos);
	}
	
}
