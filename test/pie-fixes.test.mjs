// These tests pin four wording rules of the pie chart describer.
// 1. "Every value is zero" is said only when every value is zero.
// 2. A pie with a negative value gives no shares, no "largest" and no pattern section.
// 3. The total keeps its fraction when its whole part is twelve digits or more.
// 4. A share that prints as half, a third or a quarter without being it reads "about".
// 5. The bottom-half sentence counts the smaller half, and is left out when all values are equal.
// 6. An empty pie says it has no categories.
// 7. The average segment size is not stated.
// 8. A title of only spaces is left out; a title of 0 is kept.
// 9. Values never print in exponent form.
// 10. One segment reads as the only segment.
// 11. Blank segment names read "unlabelled segment N", and repeated names read "North (segment N)",
//     with names compared after trimming white space and format characters at either end.
// Each test builds a chart and checks the exact sentence.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const lib = require("./load.cjs");

const NEGATIVE = "Some values are negative, so shares are not given.";
const ZERO = "Every value is zero, so no segment is larger than another.";

// Builds the chart and returns the short sentence and the lines of the detailed text.
function describe(title, pairs) {
  const segments = pairs.map(([name, value]) => ({ name, value }));
  const built = lib.charts.buildPieModel(title, segments);
  const detailed = lib.render.renderText(built).detailed;
  return {
    short: lib.model.flatten(built.short),
    lines: detailed.split("\n"),
    detailed,
  };
}

const insights = (lines) => {
  const start = lines.indexOf("Key Insights") + 2;
  const end = lines.indexOf("Complete Data Points") - 1;
  return lines.slice(start, end);
};

// ---- Rule 1: "Every value is zero" needs every value to be zero ----

test("5 and -5 do not read as all zero", () => {
  const { short, lines } = describe("Net zero", [["Gain", 5], ["Loss", -5]]);
  assert.equal(
    short,
    `A pie chart titled "Net zero" showing the distribution of two categories. ${NEGATIVE}`,
  );
  assert.deepEqual(insights(lines), [`• ${NEGATIVE}`, "• Total: 0"]);
});

test("a pie where every value is zero still says so", () => {
  const { short, lines } = describe("Nothing", [["A", 0], ["B", 0], ["C", 0]]);
  assert.equal(
    short,
    `A pie chart titled "Nothing" showing the distribution of three categories. ${ZERO}`,
  );
  assert.deepEqual(insights(lines), [`• ${ZERO}`, "• Total: 0"]);
});

// ---- Rule 2: a negative value means no shares ----

test("all negative values give no largest segment", () => {
  const { short, lines } = describe("All negative", [["A", -1], ["B", -2]]);
  assert.equal(
    short,
    `A pie chart titled "All negative" showing the distribution of two categories. ${NEGATIVE}`,
  );
  assert.deepEqual(insights(lines), [`• ${NEGATIVE}`, "• Total: -3"]);
  assert.deepEqual(lines.slice(lines.indexOf("Complete Data Points") + 2), ["• A: -1", "• B: -2"]);
});

test("one negative value among positive ones gives no shares and no pattern section", () => {
  const { short, lines, detailed } = describe("Profit and loss", [
    ["Sales", 60],
    ["Refunds", -20],
    ["Other", 10],
  ]);
  assert.equal(
    short,
    `A pie chart titled "Profit and loss" showing the distribution of three categories. ${NEGATIVE}`,
  );
  assert.deepEqual(insights(lines), [`• ${NEGATIVE}`, "• Total: 50"]);
  assert.deepEqual(lines.slice(lines.indexOf("Complete Data Points") + 2), [
    "• Sales: 60",
    "• Other: 10",
    "• Refunds: -20",
  ]);
  assert.ok(!detailed.includes("%"));
  assert.ok(!detailed.includes("Distribution Pattern"));
});

test("a share over a hundred percent is never printed", () => {
  const { short, detailed } = describe("", [["A", 100], ["B", -99]]);
  assert.equal(
    short,
    `A pie chart showing the distribution of two categories. ${NEGATIVE}`,
  );
  assert.ok(!detailed.includes("%"));
});

test("five segments with one negative skip the pattern section", () => {
  const { detailed } = describe("Five", [["A", 50], ["B", 20], ["C", 10], ["D", 5], ["E", -5]]);
  assert.ok(!detailed.includes("Distribution Pattern"));
  assert.ok(!detailed.includes("The bottom"));
});

test("a pie with only non-negative values keeps its shares", () => {
  const { short, lines } = describe("", [["A", 10], ["B", 0]]);
  assert.equal(
    short,
    "A pie chart showing the distribution of two categories. A is the largest segment at 100.0%, representing over half of the total.",
  );
  assert.deepEqual(lines.slice(lines.indexOf("Complete Data Points") + 2), [
    "• A: 10 (100.0%)",
    "• B: 0 (0.0%)",
  ]);
});

// ---- Rule 3: the total keeps its fraction ----

test("a twelve-digit total keeps its decimals", () => {
  const { lines } = describe("", [["A", 123456789012.34], ["B", 0.01]]);
  assert.ok(lines.includes("• Total: 123456789012.35"));
});

test("float noise on a twelve-digit total is still removed", () => {
  const { lines } = describe("", [["A", 123456789012.1], ["B", 0.2]]);
  assert.ok(lines.includes("• Total: 123456789012.3"));
});

test("a total under twelve whole digits is rounded as before", () => {
  const { lines } = describe("", [["A", 0.1], ["B", 0.2], ["C", 0.3]]);
  assert.ok(lines.includes("• Total: 0.6"));
  const eleven = describe("", [["A", 12345678901.5], ["B", 0.1]]);
  assert.ok(eleven.lines.includes("• Total: 12345678901.6"));
});

// ---- Rule 4: a share that prints as a simple fraction is not called "exactly" or "over" it ----

const ZW = "​"; // zero-width space, a Unicode format character
const ZJ = "‍"; // zero-width joiner, a Unicode format character

const sentence = (name, percent, phrase) =>
  `${name} is the largest segment at ${percent}%, representing ${phrase} of the total.`;

test("a difference of 1 in a billion is not exactly half", () => {
  const { short } = describe("Tolerance", [["A", 1000000001], ["B", 1000000000]]);
  assert.equal(
    short,
    `A pie chart titled "Tolerance" showing the distribution of two categories. ${sentence("A", "50.0", "about half")}`,
  );
});

test("exactly half is still exactly half", () => {
  const { short } = describe("Half", [["Half", 50], ["Q1", 25], ["Q2", 25]]);
  assert.equal(
    short,
    `A pie chart titled "Half" showing the distribution of three categories. ${sentence("Half", "50.0", "exactly half")}`,
  );
});

test("a share that prints as 50.0% but is not half reads about half", () => {
  const over = describe("Just over half", [["Yes", 5004], ["No", 4996]]);
  assert.equal(
    over.short,
    `A pie chart titled "Just over half" showing the distribution of two categories. ${sentence("Yes", "50.0", "about half")}`,
  );
  assert.ok(over.lines.includes(`• ${sentence("Yes", "50.0", "about half")}`));
  const under = describe("Under half", [["A", 49.97], ["B", 25], ["C", 25.03]]);
  assert.equal(
    under.short,
    `A pie chart titled "Under half" showing the distribution of three categories. ${sentence("A", "50.0", "about half")}`,
  );
});

test("a share that prints as a third or a quarter reads about a third or a quarter", () => {
  const third = describe("Near third", [["A", 33.34], ["B", 33.33], ["C", 33.33]]);
  assert.ok(third.short.endsWith(sentence("A", "33.3", "about a third")));
  const quarter = describe("Near quarter", [["A", 25.01], ["B", 24.99], ["C", 25], ["D", 25]]);
  assert.ok(quarter.short.endsWith(sentence("A", "25.0", "about a quarter")));
});

test("a share well away from a simple fraction keeps its wording", () => {
  const { short } = describe("Fruit sold", [["Apples", 50], ["Pears", 30], ["Plums", 20]]);
  assert.equal(
    short,
    `A pie chart titled "Fruit sold" showing the distribution of three categories. ${sentence("Apples", "50.0", "exactly half")}`,
  );
  const narrow = describe("Narrow", [["A", 51], ["B", 49]]);
  assert.ok(narrow.short.endsWith(sentence("A", "51.0", "over half")));
});

// ---- Rule 5: the bottom-half sentence counts the smaller half ----

test("five segments: the bottom two, not the bottom three", () => {
  const { lines } = describe("Five", [["A", 40], ["B", 25], ["C", 15], ["D", 12], ["E", 8]]);
  assert.deepEqual(lines.slice(lines.indexOf("Distribution Pattern") + 2), [
    "The bottom two segments collectively represent 20.0% of the total.",
  ]);
});

test("seven segments: the bottom three", () => {
  const { lines } = describe("Seven", [["A", 30], ["B", 20], ["C", 15], ["D", 12], ["E", 10], ["F", 8], ["G", 5]]);
  assert.deepEqual(lines.slice(lines.indexOf("Distribution Pattern") + 2), [
    "The bottom three segments collectively represent 23.0% of the total.",
  ]);
});

test("seven equal segments have no bottom-half sentence and no pattern section", () => {
  const { detailed } = describe("Sum", ["A", "B", "C", "D", "E", "F", "G"].map((name) => [name, 1]));
  assert.ok(!detailed.includes("The bottom"));
  assert.ok(!detailed.includes("Distribution Pattern"));
});

test("four segments have no bottom-half sentence", () => {
  const { detailed } = describe("Four", [["A", 40], ["B", 30], ["C", 20], ["D", 10]]);
  assert.ok(!detailed.includes("The bottom"));
});

test("a tie across the middle of five segments does not move the count", () => {
  const { lines } = describe("Tied bottom 3", [["A", 50], ["B", 1], ["C", 1], ["D", 1], ["E", 47]]);
  assert.deepEqual(lines.slice(lines.indexOf("Distribution Pattern") + 2), [
    "The bottom two segments collectively represent 2.0% of the total.",
  ]);
});

// ---- Rule 6: an empty pie says it has no categories ----

test("a pie with no segments says it has no categories", () => {
  assert.equal(describe("Nothing", []).short, 'A pie chart titled "Nothing" with no categories.');
  assert.equal(describe("", []).short, "A pie chart with no categories.");
});

test("a pie with segments still says how many categories", () => {
  const { short } = describe("Fruit sold", [["Apples", 50], ["Pears", 30], ["Plums", 20]]);
  assert.ok(short.startsWith('A pie chart titled "Fruit sold" showing the distribution of three categories.'));
});

// ---- Rule 7: no average segment size ----

test("the average segment size is not stated", () => {
  const four = describe("Four equal", [["A", 5], ["B", 5], ["C", 5], ["D", 5]]);
  assert.ok(!four.detailed.includes("average"));
  assert.ok(!four.detailed.includes("Distribution Pattern"));
  const base = describe("Fruit sold", [["Apples", 50], ["Pears", 30], ["Plums", 20]]);
  assert.ok(!base.detailed.includes("Distribution Pattern"));
  const five = describe("Five", [["A", 40], ["B", 25], ["C", 15], ["D", 12], ["E", 8]]);
  assert.ok(!five.detailed.includes("average"));
  assert.ok(five.detailed.includes("Distribution Pattern"));
});

// ---- Rule 8: a title of only spaces is no title; a title of 0 is a title ----

test("a title of only spaces is left out", () => {
  const { short, lines } = describe(" ", [["A", 60], ["B", 40]]);
  assert.equal(
    short,
    `A pie chart showing the distribution of two categories. ${sentence("A", "60.0", "over half")}`,
  );
  assert.ok(lines.includes("This pie chart shows the distribution of categories."));
});

test("a title of 0 is kept", () => {
  const { short, lines } = describe(0, [["A", 60], ["B", 40]]);
  assert.equal(
    short,
    `A pie chart titled "0" showing the distribution of two categories. ${sentence("A", "60.0", "over half")}`,
  );
  assert.ok(lines.includes('This pie chart titled "0" shows the distribution of categories.'));
});

test("a numeric title other than 0 is unchanged", () => {
  const { short } = describe(2026, [["A", 60], ["B", 40]]);
  assert.ok(short.startsWith('A pie chart titled "2026" showing the distribution of two categories.'));
});

// ---- Rule 9: values never print in exponent form ----

test("very large values print in full", () => {
  const { lines } = describe("Huge numbers", [["A", 1e21], ["B", 2e21]]);
  assert.ok(lines.includes("• Total: 3000000000000000000000"));
  assert.ok(lines.includes("• Largest segment: B (2000000000000000000000, 66.7%)"));
  assert.ok(lines.includes("• Smallest segment: A (1000000000000000000000, 33.3%)"));
  assert.ok(lines.includes("• B: 2000000000000000000000 (66.7%)"));
  assert.ok(lines.includes("• A: 1000000000000000000000 (33.3%)"));
});

test("very small values print in full", () => {
  const { lines } = describe("Tiny numbers", [["A", 1e-7], ["B", 3e-7]]);
  assert.ok(lines.includes("• Total: 0.0000004"));
  assert.ok(lines.includes("• Largest segment: B (0.0000003, 75.0%)"));
  assert.ok(lines.includes("• Smallest segment: A (0.0000001, 25.0%)"));
  assert.ok(lines.includes("• B: 0.0000003 (75.0%)"));
  assert.ok(lines.includes("• A: 0.0000001 (25.0%)"));
});

test("a value with many decimals is not rewritten", () => {
  const { detailed } = describe("Precision", [["A", 3.14159265358979], ["B", 2.718281828459045]]);
  assert.ok(detailed.includes("• A: 3.14159265358979 ("));
  assert.ok(detailed.includes("• B: 2.718281828459045 ("));
});

// ---- Rule 10: one segment is the whole pie ----

test("one segment reads as the only segment", () => {
  const { short, lines } = describe("One slice", [["Only", 100]]);
  assert.equal(
    short,
    'A pie chart titled "One slice" showing the distribution of one category. Only is the only segment, at 100.0% of the total.',
  );
  assert.deepEqual(insights(lines), ["• Only is the only segment, at 100.0% of the total.", "• Total: 100"]);
});

test("two equal segments keep their tie wording", () => {
  const { lines } = describe("Even split", [["Left", 10], ["Right", 10]]);
  assert.deepEqual(insights(lines), ["• Both segments are equal, at 50.0% each.", "• Total: 20"]);
});

// ---- Rule 11: blank and repeated segment names ----

// The category list: the lines between "The chart shows ..." and "Key Insights".
const categoryList = (lines) => {
  const start = lines.findIndex((line) => line.startsWith("The chart shows")) + 2;
  return lines.slice(start, lines.indexOf("Key Insights") - 1);
};

test("a repeated name carries its declaration position everywhere", () => {
  const { lines } = describe("Duplicates", [["North", 30], ["North", 20], ["South", 50]]);
  assert.deepEqual(categoryList(lines), ["• South", "• North (segment 1)", "• North (segment 2)"]);
  assert.ok(lines.includes("• Smallest segment: North (segment 2) (20, 20.0%)"));
  assert.ok(lines.includes("• North (segment 1): 30 (30.0%)"));
  assert.ok(lines.includes("• North (segment 2): 20 (20.0%)"));
});

test("tied repeated names read as one form, tied", () => {
  const { lines } = describe("Tied smallest", [["North", 30], ["North", 30], ["South", 40]]);
  assert.ok(
    lines.includes("• Smallest segments: North (segment 1) and North (segment 2) (30 each, 30.0% each)"),
  );
  const largest = describe("Tied largest", [["North", 40], ["North", 40], ["South", 20]]);
  assert.equal(
    largest.short,
    'A pie chart titled "Tied largest" showing the distribution of three categories. North (segment 1) and North (segment 2) are the joint largest segments, at 40.0% each.',
  );
});

test("three repeated names are numbered by declaration position", () => {
  const { short } = describe("Three", [["North", 30], ["North", 30], ["North", 40]]);
  assert.ok(short.endsWith(sentence("North (segment 3)", "40.0", "over a third")));
});

test("a trailing space still makes a repeat, and the name is narrated as written", () => {
  const { lines } = describe("Trailing", [["North ", 30], ["North", 20], ["South", 50]]);
  assert.deepEqual(categoryList(lines), ["• South", "• North  (segment 1)", "• North (segment 2)"]);
});

test("a trailing zero-width space still makes a repeat", () => {
  const { lines } = describe("Format", [[`North${ZW}`, 30], ["North", 20], ["South", 50]]);
  assert.deepEqual(categoryList(lines), ["• South", `• North${ZW} (segment 1)`, "• North (segment 2)"]);
});

test("a leading space with a trailing joiner still makes a repeat", () => {
  const { lines } = describe("Both edges", [[" North", 30], [`North${ZJ}`, 20], ["South", 50]]);
  assert.deepEqual(categoryList(lines), ["• South", "•  North (segment 1)", `• North${ZJ} (segment 2)`]);
});

test("names that differ by case or by interior spaces are not repeats", () => {
  const upper = describe("Case", [["north", 30], ["North", 70]]);
  assert.deepEqual(categoryList(upper.lines), ["• North", "• north"]);
  const interior = describe("Interior", [["North  End", 30], ["North End", 70]]);
  assert.deepEqual(categoryList(interior.lines), ["• North End", "• North  End"]);
});

test("blank names read unlabelled segment N, from their declaration position", () => {
  const last = describe("Blank names", [["", 30], [" ", 20], ["Real", 50]]);
  assert.deepEqual(categoryList(last.lines), ["• Real", "• Unlabelled segment 1", "• Unlabelled segment 2"]);
  assert.ok(last.lines.includes("• Smallest segment: unlabelled segment 2 (20, 20.0%)"));
  // N counts every segment, not only the blank ones: Real is declared first.
  const first = describe("Position", [["Real", 50], ["", 30], [" ", 20]]);
  assert.deepEqual(categoryList(first.lines), ["• Real", "• Unlabelled segment 2", "• Unlabelled segment 3"]);
});

test("names of only zero-width characters are blank", () => {
  const { lines } = describe("Format blank", [[ZW, 30], ["Real", 50], [ZJ, 20]]);
  assert.deepEqual(categoryList(lines), ["• Real", "• Unlabelled segment 1", "• Unlabelled segment 3"]);
});

test("a blank name that repeats reads unlabelled, not as a repeat", () => {
  const { lines } = describe("Blank twice", [[ZW, 30], [ZW, 20], ["Real", 50]]);
  assert.deepEqual(categoryList(lines), ["• Real", "• Unlabelled segment 1", "• Unlabelled segment 2"]);
  assert.ok(!lines.some((line) => line.includes("(segment")));
});

test("a blank name that is the largest segment opens its sentence in capitals", () => {
  const { short } = describe("Two blank", [["", 60], ["", 40]]);
  assert.ok(short.endsWith(sentence("Unlabelled segment 1", "60.0", "over half")));
});
