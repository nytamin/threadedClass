import {
	encodeArguments,
	decodeArguments,
	EncodingStrategy,
	ArgDefinition,
} from "../shared/sharedApi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round-trip a list of args through encode → decode and return the decoded values. */
function roundTrip(
	args: any[],
	strategy: EncodingStrategy,
	callbacks: { [key: string]: Function } = {},
	instance: any = {},
): any[] {
	const encoded = encodeArguments(instance, callbacks, args, strategy);
	return decodeArguments(
		() => instance,
		encoded,
		(a: ArgDefinition) => callbacks[a.value] as any,
	);
}

// A buffer whose bytes span the full 0x00–0xFF range to catch encoding bugs
// that only manifest with non-ASCII / non-printable bytes.
const BINARY_BYTES = Uint8Array.from({ length: 256 }, (_, i) => i);
const BINARY_BUF = Buffer.from(BINARY_BYTES);

// ---------------------------------------------------------------------------
// encodeArguments – structural shape tests
// ---------------------------------------------------------------------------

describe("encodeArguments – JSON strategy", () => {
	const S = EncodingStrategy.JSON;

	test("Buffer is base64-encoded to a string", () => {
		const [enc] = encodeArguments({}, {}, [BINARY_BUF], S);
		expect(enc.type).toBe("buffer");
		expect(typeof enc.value).toBe("string");
		expect(enc.value).toBe(BINARY_BUF.toString("base64"));
		expect(enc.original).toBeUndefined();
	});

	test("Buffer with only ASCII bytes round-trips correctly", () => {
		const buf = Buffer.from("hello world");
		const [decoded] = roundTrip([buf], S);
		expect(Buffer.isBuffer(decoded)).toBe(true);
		expect(decoded.equals(buf)).toBe(true);
	});

	test("Buffer with full binary range (0x00–0xFF) round-trips correctly", () => {
		const [decoded] = roundTrip([BINARY_BUF], S);
		expect(Buffer.isBuffer(decoded)).toBe(true);
		expect(decoded.equals(BINARY_BUF)).toBe(true);
	});

	test("empty Buffer round-trips correctly", () => {
		const buf = Buffer.alloc(0);
		const [decoded] = roundTrip([buf], S);
		expect(Buffer.isBuffer(decoded)).toBe(true);
		expect(decoded.length).toBe(0);
	});

	test("string", () => {
		const [decoded] = roundTrip(["hello"], S);
		expect(decoded).toBe("hello");
	});

	test("empty string", () => {
		const [decoded] = roundTrip([""], S);
		expect(decoded).toBe("");
	});

	test("number", () => {
		const [decoded] = roundTrip([42], S);
		expect(decoded).toBe(42);
	});

	test("zero", () => {
		const [decoded] = roundTrip([0], S);
		expect(decoded).toBe(0);
	});

	test("undefined", () => {
		const [decoded] = roundTrip([undefined], S);
		expect(decoded).toBeUndefined();
	});

	test("null", () => {
		const [decoded] = roundTrip([null], S);
		expect(decoded).toBeNull();
	});

	test("boolean true/false (OTHER type)", () => {
		const [t, f] = roundTrip([true, false], S);
		expect(t).toBe(true);
		expect(f).toBe(false);
	});

	test("plain object", () => {
		const obj = { a: 1, b: "two", c: null };
		const [decoded] = roundTrip([obj], S);
		expect(decoded).toEqual(obj);
	});

	test("nested object", () => {
		const obj = { outer: { inner: [1, 2, 3] } };
		const [decoded] = roundTrip([obj], S);
		expect(decoded).toEqual(obj);
	});

	test("array", () => {
		const arr = [1, "two", null, true];
		const [decoded] = roundTrip([arr], S);
		expect(decoded).toEqual(arr);
	});

	test("multiple heterogeneous args in one call", () => {
		const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
		const [a, b, c, d] = roundTrip([buf, "hello", 99, null], S);
		expect(Buffer.isBuffer(a) && a.equals(buf)).toBe(true);
		expect(b).toBe("hello");
		expect(c).toBe(99);
		expect(d).toBeNull();
	});

	test("function is registered in callbacks and returns the same fn on decode", () => {
		const callbacks: { [key: string]: Function } = {};
		const fn = (x: number) => x * 2;
		const [encoded] = encodeArguments({}, callbacks, [fn], S);
		expect(encoded.type).toBe("function");
		// callback should be registered
		expect(Object.values(callbacks)).toContain(fn);
		// decoding retrieves the same reference via getCallback
		const [decoded] = decodeArguments(
			() => ({}),
			[encoded],
			(a: ArgDefinition) => callbacks[a.value] as any,
		);
		expect(decoded).toBe(fn);
	});

	test("same function reference reuses existing callback id", () => {
		const callbacks: { [key: string]: Function } = {};
		const fn = () => "hi";
		const [enc1] = encodeArguments({}, callbacks, [fn], S);
		const [enc2] = encodeArguments({}, callbacks, [fn], S);
		expect(enc1.value).toBe(enc2.value);
		expect(Object.keys(callbacks).length).toBe(1);
	});

	test("different functions get different ids", () => {
		const callbacks: { [key: string]: Function } = {};
		const fn1 = () => 1;
		const fn2 = () => 2;
		const [enc1] = encodeArguments({}, callbacks, [fn1], S);
		const [enc2] = encodeArguments({}, callbacks, [fn2], S);
		expect(enc1.value).not.toBe(enc2.value);
	});

	test("circular object is encoded as OBJECT (throw happens later at JSON.stringify in send layer)", () => {
		const o: any = {};
		o.self = o;
		// encodeArguments itself does NOT throw – it stores the reference as-is.
		// The error is deferred to when the IPC send layer calls JSON.stringify on the message.
		const result = encodeArguments({}, {}, [o], S);
		expect(result[0].type).toBe("object");
		expect(result[0].value).toBe(o);
	});

	test("instance self-reference encodes as OBJECT/self", () => {
		const instance = { id: "me" };
		const [enc] = encodeArguments(instance, {}, [instance], S);
		expect(enc.type).toBe("object");
		expect(enc.value).toBe("self");
		const [decoded] = decodeArguments(() => instance, [enc], (() => {
			throw new Error();
		}) as any);
		expect(decoded).toBe(instance);
	});
});

// ---------------------------------------------------------------------------

describe("encodeArguments – StructuredClone strategy", () => {
	const S = EncodingStrategy.StructuredClone;

	test("Buffer is stored as-is (not base64)", () => {
		const [enc] = encodeArguments({}, {}, [BINARY_BUF], S);
		expect(enc.type).toBe("buffer");
		// value should NOT be a string — it is the Buffer/Uint8Array itself
		expect(typeof enc.value).not.toBe("string");
		expect(enc.original).toBeUndefined();
	});

	test("Buffer with full binary range (0x00–0xFF) round-trips correctly", () => {
		// Simulate what structured clone does: the Buffer arrives as a plain Uint8Array.
		// Use a view into the same ArrayBuffer to verify the decode path shares it (no extra copy).
		const callbacks = {};
		const [enc] = encodeArguments({}, callbacks, [BINARY_BUF], S);
		// structured clone would deliver a Uint8Array backed by a fresh ArrayBuffer.
		// We simulate a transferred ArrayBuffer by making a view into the encoded Buffer's own ArrayBuffer.
		const u = enc.value as Buffer;
		const asUint8Array = new Uint8Array(
			u.buffer,
			u.byteOffset,
			u.byteLength,
		);
		const syntheticEnc: ArgDefinition = { ...enc, value: asUint8Array };
		const [decoded] = decodeArguments(() => ({}), [syntheticEnc], (() => {
			throw new Error();
		}) as any);
		expect(Buffer.isBuffer(decoded)).toBe(true);
		expect(decoded.equals(BINARY_BUF)).toBe(true);
		// The decoded Buffer should share the same underlying ArrayBuffer (zero-copy)
		expect(decoded.buffer).toBe(asUint8Array.buffer);
	});

	test("empty Buffer round-trips correctly", () => {
		const buf = Buffer.alloc(0);
		const [enc] = encodeArguments({}, {}, [buf], S);
		const u = enc.value as Buffer;
		const asUint8Array = new Uint8Array(
			u.buffer,
			u.byteOffset,
			u.byteLength,
		);
		const syntheticEnc: ArgDefinition = { ...enc, value: asUint8Array };
		const [decoded] = decodeArguments(() => ({}), [syntheticEnc], (() => {
			throw new Error();
		}) as any);
		expect(Buffer.isBuffer(decoded)).toBe(true);
		expect(decoded.length).toBe(0);
	});

	test("non-Buffer args behave identically to JSON strategy", () => {
		const cases: any[] = ["str", 42, null, undefined, true, { x: 1 }];
		for (const val of cases) {
			const [decoded] = roundTrip([val], S);
			expect(decoded).toEqual(val);
		}
	});
});

// ---------------------------------------------------------------------------

describe("encodeArguments – InProcess strategy", () => {
	const S = EncodingStrategy.InProcess;

	test("Buffer original reference is preserved", () => {
		const buf = Buffer.from([1, 2, 3]);
		const [enc] = encodeArguments({}, {}, [buf], S);
		expect(enc.type).toBe("buffer");
		expect(enc.original).toBe(buf); // same reference
		expect(enc.value).toBeNull();
		const [decoded] = decodeArguments(() => ({}), [enc], (() => {
			throw new Error();
		}) as any);
		expect(decoded).toBe(buf); // still same reference
	});

	test("object original reference is preserved", () => {
		const obj = { nested: { deep: true } };
		const [enc] = encodeArguments({}, {}, [obj], S);
		expect(enc.type).toBe("object");
		expect(enc.original).toBe(obj);
		const [decoded] = decodeArguments(() => ({}), [enc], (() => {
			throw new Error();
		}) as any);
		expect(decoded).toBe(obj); // same reference, not a copy
	});

	test("null is NOT treated as a preserved object", () => {
		const [decoded] = roundTrip([null], S);
		expect(decoded).toBeNull();
	});

	test("scalar types pass through unchanged", () => {
		const [s, n, u] = roundTrip(["hi", 7, undefined], S);
		expect(s).toBe("hi");
		expect(n).toBe(7);
		expect(u).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// Cross-strategy: ensure JSON and StructuredClone are NOT interchangeable
// for Buffers (i.e. base64 string ≠ Uint8Array)
// ---------------------------------------------------------------------------

describe("strategy isolation", () => {
	test("JSON-encoded Buffer value is a string; StructuredClone value is not", () => {
		const buf = Buffer.from([0xff, 0x00, 0x80]);
		const [jsonEnc] = encodeArguments({}, {}, [buf], EncodingStrategy.JSON);
		const [scEnc] = encodeArguments(
			{},
			{},
			[buf],
			EncodingStrategy.StructuredClone,
		);
		expect(typeof jsonEnc.value).toBe("string");
		expect(typeof scEnc.value).not.toBe("string");
	});

	test("InProcess Buffer value is null with original set; others have no original", () => {
		const buf = Buffer.from([1]);
		const [ipEnc] = encodeArguments(
			{},
			{},
			[buf],
			EncodingStrategy.InProcess,
		);
		const [jsonEnc] = encodeArguments({}, {}, [buf], EncodingStrategy.JSON);
		const [scEnc] = encodeArguments(
			{},
			{},
			[buf],
			EncodingStrategy.StructuredClone,
		);
		expect(ipEnc.original).toBe(buf);
		expect(jsonEnc.original).toBeUndefined();
		expect(scEnc.original).toBeUndefined();
	});
});
