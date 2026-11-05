// These tests call the four text helpers on their own and pin what each returns today, edge cases included.
// If a test here fails, a helper changed. Change a helper only on purpose, and change its test with it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { formatList, capitalize, narrationNumber, escapeHtml } = require("./load.cjs").text;

test("narrationNumber speaks every whole number from 0 to 9 as a word", () => {
  const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  words.forEach((word, number) => assert.equal(narrationNumber(number), word));
});

test("narrationNumber speaks 10 and above as digits", () => {
  assert.equal(narrationNumber(10), "10");
  assert.equal(narrationNumber(11), "11");
  assert.equal(narrationNumber(100), "100");
});

test("narrationNumber speaks a negative number as digits", () => {
  assert.equal(narrationNumber(-1), "-1");
  assert.equal(narrationNumber(-0.5), "-0.5");
});

test("narrationNumber treats negative zero as zero", () => {
  assert.equal(narrationNumber(-0), "zero");
});

test("narrationNumber speaks a fraction above 9 as digits", () => {
  assert.equal(narrationNumber(9.5), "9.5");
});

test("narrationNumber returns undefined for a fraction between 0 and 9", () => {
  assert.equal(narrationNumber(2.5), undefined);
  assert.equal(narrationNumber(0.5), undefined);
});

test("narrationNumber reads a numeric string as its number", () => {
  assert.equal(narrationNumber("3"), "three");
  assert.equal(narrationNumber("10"), "10");
});

test("narrationNumber returns a string that is not a number unchanged", () => {
  assert.equal(narrationNumber("abc"), "abc");
});

test("narrationNumber gives odd inputs these results", () => {
  assert.equal(narrationNumber(null), undefined);
  assert.equal(narrationNumber(true), undefined);
  assert.equal(narrationNumber(undefined), "undefined");
  assert.equal(narrationNumber(NaN), "NaN");
  assert.equal(narrationNumber(Infinity), "Infinity");
});

test("formatList returns an empty string for no items", () => {
  assert.equal(formatList([]), "");
  assert.equal(formatList(null), "");
  assert.equal(formatList(undefined), "");
  assert.equal(formatList(""), "");
});

test("formatList returns one item as it is", () => {
  assert.equal(formatList(["a"]), "a");
});

test("formatList joins two items with and, and no comma", () => {
  assert.equal(formatList(["a", "b"]), "a and b");
});

test("formatList joins three items with an Oxford comma", () => {
  assert.equal(formatList(["a", "b", "c"]), "a, b, and c");
});

test("formatList joins four items with an Oxford comma", () => {
  assert.equal(formatList(["a", "b", "c", "d"]), "a, b, c, and d");
});

test("formatList keeps an empty item in place", () => {
  assert.equal(formatList(["a", ""]), "a and ");
});

test("capitalize returns an empty string for an empty or missing value", () => {
  assert.equal(capitalize(""), "");
  assert.equal(capitalize(null), "");
  assert.equal(capitalize(undefined), "");
  assert.equal(capitalize(0), "");
});

test("capitalize raises the first letter and leaves the rest alone", () => {
  assert.equal(capitalize("a"), "A");
  assert.equal(capitalize("ab"), "Ab");
  assert.equal(capitalize("a b"), "A b");
  assert.equal(capitalize("aBC"), "ABC");
});

test("capitalize leaves a string that already starts with a capital as it is", () => {
  assert.equal(capitalize("A"), "A");
  assert.equal(capitalize("Ab"), "Ab");
});

test("capitalize leaves a string that starts with a non-letter as it is", () => {
  assert.equal(capitalize("1a"), "1a");
  assert.equal(capitalize(" a"), " a");
  assert.equal(capitalize("-x"), "-x");
});

test("capitalize handles letters outside plain English", () => {
  assert.equal(capitalize("éa"), "Éa");
  assert.equal(capitalize("ß"), "SS");
});

test("escapeHtml replaces each of the five characters", () => {
  assert.equal(escapeHtml("&"), "&amp;");
  assert.equal(escapeHtml("<"), "&lt;");
  assert.equal(escapeHtml(">"), "&gt;");
  assert.equal(escapeHtml('"'), "&quot;");
  assert.equal(escapeHtml("'"), "&#39;");
});

test("escapeHtml replaces the ampersand first, so an entity it adds is not escaped again", () => {
  assert.equal(escapeHtml("<"), "&lt;");
  assert.notEqual(escapeHtml("<"), "&amp;lt;");
  assert.equal(escapeHtml(">"), "&gt;");
  assert.equal(escapeHtml('"'), "&quot;");
  assert.equal(escapeHtml("'"), "&#39;");
});

test("escapeHtml escapes the ampersand of text that already looks like an entity", () => {
  assert.equal(escapeHtml("&lt;"), "&amp;lt;");
});

test("escapeHtml replaces every occurrence in a longer string", () => {
  assert.equal(escapeHtml("a&b<c>"), "a&amp;b&lt;c&gt;");
  assert.equal(escapeHtml("<<"), "&lt;&lt;");
});

test("escapeHtml returns an empty string for an empty string", () => {
  assert.equal(escapeHtml(""), "");
});

test("escapeHtml turns a value that is not a string into a string first", () => {
  assert.equal(escapeHtml(5), "5");
  assert.equal(escapeHtml(0), "0");
  assert.equal(escapeHtml(null), "null");
  assert.equal(escapeHtml(undefined), "undefined");
  assert.equal(escapeHtml(["a", "b"]), "a,b");
  assert.equal(escapeHtml({}), "[object Object]");
});
