import { describe, expect, it } from "vitest";
import { canonicalJson, jsonCopy } from "./json";

describe("canonicalJson", () => {
  it("ignores the order of object keys, at any depth", () => {
    expect(canonicalJson({ b: { y: 1, x: 2 }, a: [1, { d: 4, c: 3 }] })).toBe(
      canonicalJson({ a: [1, { c: 3, d: 4 }], b: { x: 2, y: 1 } }),
    );
  });

  it("keeps array order, because it carries meaning", () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });

  it("tells different values apart", () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: "1" }));
    expect(canonicalJson(null)).toBe("null");
  });
});

describe("jsonCopy", () => {
  it("drops undefined fields like a json column does", () => {
    expect(jsonCopy({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it("returns a copy that does not share nested objects", () => {
    const original = { nested: { value: 1 } };
    const copy = jsonCopy(original);
    original.nested.value = 2;
    expect(copy.nested.value).toBe(1);
  });
});
