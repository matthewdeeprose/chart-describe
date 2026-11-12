// These tests pin the wording rules of the radar chart describer.
// 1. The average of a series is never outside the series' own values. It is the mean rounded to a whole
//    number, unless that lies below the lowest value or above the highest; then one decimal place, then
//    two, and so on, and the first result inside the values is used. Equal values follow the same rule.
//    Each of these tests builds a one-series chart and checks the exact series line.
// 2. An axis whose label is shared with another axis is named with its position, "(axis 2)", in the
//    sentences and in the data table. Labels are compared in composed form (NFC), with a no-break space
//    read as a space, white space and invisible characters stripped from both ends, and invisible
//    characters other than white space removed from inside; case and visible characters still count.
// 3. An axis label with nothing visible in it (empty, white space, or only format characters such as a
//    zero-width space) reads "unlabelled axis N".
// 4. A comparison with a higher, a lower and an equal part joins them with one "and", before the last.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const lib = require("./load.cjs");

// Builds a drawn one-series chart on a scale from 0 to the highest value; returns the series line.
function seriesLine(values) {
  const axes = values.map((_, index) => ({ id: `a${index}`, label: `Axis${index + 1}` }));
  const curve = { id: "t", label: "S", values, drawn: true };
  const facts = {
    title: null,
    axes,
    curves: [curve],
    options: {
      showLegend: true,
      ticks: 5,
      graticule: "circle",
      min: 0,
      max: null,
      scaleMax: Math.max(...values),
      scaleMaxSource: "data",
    },
    N: values.length,
    K: 1,
    noRange: false,
    inverted: false,
    maxUnplotted: false,
    legend: true,
    tabled: [curve],
    compared: [curve],
  };
  const built = lib.charts.buildRadarModel(facts);
  return lib.render.renderText(built).detailed.split("\n").find((line) => line.includes("averaging"));
}

test("0.2, 0.3 and 0.4 average 0.3, not 0", () => {
  // mean 0.3; whole number 0 is below 0.2; one decimal place gives 0.3, inside 0.2 to 0.4
  assert.equal(seriesLine([0.2, 0.3, 0.4]), '1. "S", averaging 0.3. Highest on "Axis3", lowest on "Axis1".');
});

test("0.6, 0.9 and 0.8 average 0.8, not 1", () => {
  // mean 0.7667; whole number 1 is above 0.9; one decimal place gives 0.8, inside 0.6 to 0.9
  assert.equal(seriesLine([0.6, 0.9, 0.8]), '1. "S", averaging 0.8. Highest on "Axis2", lowest on "Axis1".');
});

test("0.6, 0.7 and 0.2 average 0.5, a half that was read as 1", () => {
  // mean 0.5; whole number 1 is above 0.7; one decimal place gives 0.5, inside 0.2 to 0.7
  assert.equal(seriesLine([0.6, 0.7, 0.2]), '1. "S", averaging 0.5. Highest on "Axis2", lowest on "Axis3".');
});

test("0.01, 0.02 and 0.03 need two decimal places", () => {
  // mean 0.02; whole number 0 and one decimal place 0.0 are both below 0.01; two places give 0.02
  assert.equal(seriesLine([0.01, 0.02, 0.03]), '1. "S", averaging 0.02. Highest on "Axis3", lowest on "Axis1".');
});

test("the search reaches the series' own largest number of decimal places and no further", () => {
  // mean 0.03; the values have 2 decimal places, so the search runs 0, 1, 2; whole number 0 and one
  // decimal place 0.0 are both below 0.02; two places give 0.03, inside 0.02 to 0.04
  assert.equal(seriesLine([0.02, 0.03, 0.04]), '1. "S", averaging 0.03. Highest on "Axis3", lowest on "Axis1".');
});

test("decimal places are counted from the number's text, exponent form included", () => {
  // 1e-7, 2e-7 and 3e-7 have 7 decimal places; mean 2e-7; only the 7th place is inside the values
  assert.equal(seriesLine([1e-7, 2e-7, 3e-7]), '1. "S", averaging 0.0000002. Highest on "Axis3", lowest on "Axis1".');
});

test("negative values follow the same rule", () => {
  // mean -0.3; whole number 0 is above -0.2; one decimal place gives -0.3, inside -0.4 to -0.2
  assert.equal(seriesLine([-0.4, -0.3, -0.2]), '1. "S", averaging -0.3. Highest on "Axis3", lowest on "Axis1".');
});

test("a whole-number average already inside the values is unchanged", () => {
  // mean 3.33; whole number 3 is inside 2 to 5
  assert.equal(seriesLine([2, 5, 3]), '1. "S", averaging 3. Highest on "Axis2", lowest on "Axis1".');
});

test("a mean that is a half is not rounded onto an end of the values: it keeps one more decimal place", () => {
  // mean 2.5; the whole number 3 sits on the highest value, so the figure is 2.5
  assert.equal(seriesLine([2, 3]), '1. "S", averaging 2.5. Highest on "Axis2", lowest on "Axis1".');
});

test("one more decimal only when the whole number sits on the highest or lowest value", () => {
  assert.ok(seriesLine([1, 2]).startsWith('1. "S", averaging 1.5.'));
  assert.ok(seriesLine([0, 1, 1]).startsWith('1. "S", averaging 0.7.'));
  assert.ok(seriesLine([-1, -2]).startsWith('1. "S", averaging -1.5.'));
  assert.ok(seriesLine([0.2, 0.3, 0.25]).startsWith('1. "S", averaging 0.25.'));
  // not on an end: unchanged
  assert.ok(seriesLine([5, 2]).startsWith('1. "S", averaging 4.'));
  assert.ok(seriesLine([1, 2, 3]).startsWith('1. "S", averaging 2.'));
  assert.ok(seriesLine([2, 5, 3]).startsWith('1. "S", averaging 3.'));
});

test("a series whose values are all equal keeps its whole number, and no extra place is tried", () => {
  assert.equal(seriesLine([2, 2, 2]), '1. "S", averaging 2. The same value on every axis.');
  assert.equal(seriesLine([0.3, 0.3, 0.3]), '1. "S", averaging 0.3. The same value on every axis.');
  assert.equal(seriesLine([0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]), '1. "S", averaging 0.1. The same value on every axis.');
  assert.equal(seriesLine([7, 7, 7]), '1. "S", averaging 7. The same value on every axis.');
});

test("equal fractional values average to that value, not 0", () => {
  // mean 0.3; whole number 0 is below 0.3; one decimal place gives 0.3, which is the value
  assert.equal(seriesLine([0.3, 0.3, 0.3]), '1. "S", averaging 0.3. The same value on every axis.');
});

test("equal whole values are unchanged", () => {
  assert.equal(seriesLine([30, 30, 30]), '1. "S", averaging 30. The same value on every axis.');
});

// ---------------------------------------------------------------------------------------------------
// Axis names: repeated labels take their position, blank labels read "unlabelled axis N".

const ZWSP = "​"; // zero-width space, a Unicode format character
const ZWJ = "‍"; // zero-width joiner, a Unicode format character

// Builds a drawn chart from axis labels and [label, values] series and returns the detailed text, line by line.
function radarLines(axisLabels, seriesList) {
  const axes = axisLabels.map((label, index) => ({ id: `a${index}`, label }));
  const curves = seriesList.map(([label, values], index) => ({ id: `c${index}`, label, values, drawn: true }));
  const scaleMax = Math.max(...curves.flatMap((curve) => curve.values));
  const facts = {
    title: null,
    axes,
    curves,
    options: { showLegend: true, ticks: 5, graticule: "circle", min: 0, max: null, scaleMax, scaleMaxSource: "data" },
    N: axes.length,
    K: curves.length,
    noRange: false,
    inverted: false,
    maxUnplotted: false,
    legend: true,
    tabled: curves,
    compared: curves,
  };
  return lib.render.renderText(lib.charts.buildRadarModel(facts)).detailed.split("\n");
}

const axesSentence = (lines) => lines.find((line) => line.startsWith("The axes, clockwise from the top"));
const seriesLines = (lines) => lines.filter((line) => /^\d+\. /.test(line));
const axisBullets = (lines) => lines.filter((line) => line.startsWith("   • "));
const comparisonLines = (lines) => lines.filter((line) => line.includes(" is higher than ") || line.includes(" is lower than "));
const tableRows = (lines) => lines.filter((line) => line.includes(" | "));

const TWO_SUPPLIERS = [
  ["Supplier A", [9, 1, 5]],
  ["Supplier B", [1, 9, 5]],
];

test("two axes with the same label each take their position, in every sentence and in the table", () => {
  const lines = radarLines(["Quality", "Quality", "Cost"], TWO_SUPPLIERS);
  assert.equal(axesSentence(lines), 'The axes, clockwise from the top, are "Quality" (axis 1), "Quality" (axis 2) and "Cost".');
  assert.deepEqual(seriesLines(lines), [
    '1. "Supplier A", averaging 5. Highest on "Quality" (axis 1), lowest on "Quality" (axis 2).',
    '2. "Supplier B", averaging 5. Highest on "Quality" (axis 2), lowest on "Quality" (axis 1).',
  ]);
  assert.deepEqual(axisBullets(lines), [
    '   • "Quality" (axis 1): 9',
    '   • "Quality" (axis 2): 1',
    '   • "Cost": 5',
    '   • "Quality" (axis 1): 1',
    '   • "Quality" (axis 2): 9',
    '   • "Cost": 5',
  ]);
  assert.deepEqual(comparisonLines(lines), [
    '• "Supplier A" is higher than "Supplier B" on "Quality" (axis 1), lower on "Quality" (axis 2), and equal on "Cost".',
  ]);
  assert.deepEqual(tableRows(lines), [
    "Axis | Supplier A | Supplier B",
    "Quality (axis 1) | 9 | 1",
    "Quality (axis 2) | 1 | 9",
    "Cost | 5 | 5",
  ]);
});

test("axes with different labels carry no position", () => {
  const lines = radarLines(["Speed", "Power", "Skill"], [["Team A", [40, 70, 55]]]);
  assert.equal(axesSentence(lines), 'The axes, clockwise from the top, are "Speed", "Power" and "Skill".');
  assert.equal(lines.some((line) => line.includes("(axis")), false);
  assert.deepEqual(tableRows(lines), ["Axis | Team A", "Speed | 40", "Power | 70", "Skill | 55"]);
});

test("a trailing space does not make a label different: the two axes are a repeat", () => {
  const lines = radarLines(["Quality ", "Quality", "Cost"], TWO_SUPPLIERS);
  // The label is shown as the author wrote it, trailing space included.
  assert.equal(axesSentence(lines), 'The axes, clockwise from the top, are "Quality " (axis 1), "Quality" (axis 2) and "Cost".');
  assert.equal(seriesLines(lines)[0], '1. "Supplier A", averaging 5. Highest on "Quality " (axis 1), lowest on "Quality" (axis 2).');
  assert.deepEqual(tableRows(lines).slice(1, 3), ["Quality  (axis 1) | 9 | 1", "Quality (axis 2) | 1 | 9"]);
});

test("a trailing zero-width space does not make a label different: the two axes are a repeat", () => {
  const lines = radarLines([`Quality${ZWSP}`, "Quality", "Cost"], [TWO_SUPPLIERS[0]]);
  assert.equal(
    axesSentence(lines),
    `The axes, clockwise from the top, are "Quality${ZWSP}" (axis 1), "Quality" (axis 2) and "Cost".`,
  );
  assert.deepEqual(tableRows(lines).slice(1, 3), [`Quality${ZWSP} (axis 1) | 9`, "Quality (axis 2) | 1"]);
});

test("a leading space and a trailing joiner do not make labels different either", () => {
  const lines = radarLines([" Quality", `Quality${ZWJ}`, "Cost"], [TWO_SUPPLIERS[0]]);
  assert.equal(
    axesSentence(lines),
    `The axes, clockwise from the top, are " Quality" (axis 1), "Quality${ZWJ}" (axis 2) and "Cost".`,
  );
});

test("labels that differ in case are not a repeat", () => {
  const lines = radarLines(["quality", "Quality", "Cost"], [TWO_SUPPLIERS[0]]);
  assert.equal(axesSentence(lines), 'The axes, clockwise from the top, are "quality", "Quality" and "Cost".');
  assert.equal(lines.some((line) => line.includes("(axis")), false);
});

test("labels that differ only in the amount or kind of white space between words are a repeat", () => {
  const lines = radarLines(["Quality  x", "Quality x", "Cost"], [TWO_SUPPLIERS[0]]);
  assert.equal(
    axesSentence(lines),
    'The axes, clockwise from the top, are "Quality  x" (axis 1), "Quality x" (axis 2) and "Cost".',
  );
});

test("repeat key: any white space is one space, invisible characters go before composing, ZWJ and tags are kept", () => {
  const repeated = (a, b) => {
    const sentence = axesSentence(radarText({ axisLabels: [a, b, "C"], seriesList: [["S", [1, 2, 3]]] }).lines);
    return sentence.includes("(axis 1)") && sentence.includes("(axis 2)");
  };
  // white space of every kind between words reads as one space
  assert.ok(repeated("New York", "New York"));
  assert.ok(repeated("New York", "New York"));
  assert.ok(repeated("New York", "New\tYork"));
  assert.ok(repeated("New York", "New York"));
  // an invisible character between a letter and its accent cannot stop them composing
  assert.ok(repeated("Café", "Cafe͏́"));
  // the Ogham space mark draws, so it is not a space
  assert.ok(!repeated("ab c", "ab c"));
  // a joiner and tag characters make different emoji and different flags
  assert.ok(!repeated("\u{1F468}‍\u{1F469}‍\u{1F467}", "\u{1F468}\u{1F469}\u{1F467}"));
  assert.ok(
    !repeated(
      "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}",
      "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}",
    ),
  );
  // and names that are the same stay the same, and a joiner at the end is still removed
  assert.ok(repeated("\u{1F468}‍\u{1F469}", "\u{1F468}‍\u{1F469}‍"));
});

test("average: a true half at a large magnitude rounds away from zero, and a small magnitude still does", () => {
  // mean 72603.37725 exactly: a half at four places
  assert.equal(averageOf([72603.377, 72603.377, 72603.377, 72603.378]), "72603.3773");
  assert.equal(averageOf([-32079434.49, -32079434.49, -32079434.49, -32079434.48]), "-32079434.488");
  // must not change
  assert.equal(averageOf([0.377, 0.377, 0.377, 0.378]), "0.3773");
  assert.equal(averageOf([10000000.1, 10000000.2, 10000001.2]), "10000001");
  // not a half: a mean a hair under 0.65 stays under it
  assert.equal(averageOf([-0.7, -0.7, -0.7, -0.7, -0.7, -0.7, -0.7, -0.7, -0.7, -0.7, -0.7, -0.7, -0.7, -0.7, -0.7, -0.7, -0.7, -0.7, -0.7, 0.30000000000000004]), "-0.6");
});

test("speed: a chart of 3,200 distinct axes is described without a quadratic scan", () => {
  const axisLabels = Array.from({ length: 3200 }, (_, i) => `Axis ${i + 1}`);
  const values = Array.from({ length: 3200 }, (_, i) => (i * 7) % 13);
  const started = Date.now();
  radarText({ axisLabels, seriesList: [["S", values]] });
  // 14 ms measured on the draft and about 6,400 ms before; a bound of two seconds fails the quadratic scan and not a slow machine.
  assert.ok(Date.now() - started < 2000);
});

test("a blank axis beside a repeated one keeps its own name and does not join the repeat", () => {
  const lines = radarLines(["", "Quality", "Quality"], [["S", [3, 7, 5]]]);
  assert.equal(
    axesSentence(lines),
    'The axes, clockwise from the top, are unlabelled axis 1, "Quality" (axis 2) and "Quality" (axis 3).',
  );
  assert.deepEqual(tableRows(lines), ["Axis | S", "Unlabelled axis 1 | 3", "Quality (axis 2) | 7", "Quality (axis 3) | 5"]);
});

test("two axes labelled with zero-width characters only read unlabelled axis 1 and unlabelled axis 2", () => {
  // Zero-width characters draw as nothing, so these labels are blank, as in the pie and the xychart.
  const lines = radarLines([ZWSP, ZWSP, "Cost"], [["S", [3, 7, 5]]]);
  assert.equal(axesSentence(lines), 'The axes, clockwise from the top, are unlabelled axis 1, unlabelled axis 2 and "Cost".');
  assert.deepEqual(seriesLines(lines), ['1. "S", averaging 5. Highest on unlabelled axis 2, lowest on unlabelled axis 1.']);
  assert.deepEqual(axisBullets(lines), ["   • Unlabelled axis 1: 3", "   • Unlabelled axis 2: 7", '   • "Cost": 5']);
  assert.deepEqual(tableRows(lines), ["Axis | S", "Unlabelled axis 1 | 3", "Unlabelled axis 2 | 7", "Cost | 5"]);
});

// ---------------------------------------------------------------------------------------------------
// Comparison: one "and", before the last part.

test("a comparison with a higher, a lower and an equal part has one 'and', before the equal part", () => {
  const lines = radarLines(
    ["Planning", "Quality", "Reach", "Speed"],
    [
      ["Team A", [5, 1, 3, 3]],
      ["Team B", [1, 5, 3, 3]],
    ],
  );
  assert.deepEqual(comparisonLines(lines), [
    '• "Team A" is higher than "Team B" on "Planning", lower on "Quality", and equal on "Reach" and "Speed".',
  ]);
});

test("a comparison with a higher and a lower part only keeps its 'and' before the lower part", () => {
  const lines = radarLines(
    ["Defence", "Attack", "Speed"],
    [
      ["Team A", [5, 1, 1]],
      ["Team B", [1, 5, 5]],
    ],
  );
  assert.deepEqual(comparisonLines(lines), ['• "Team A" is higher than "Team B" on "Defence", and lower on "Attack" and "Speed".']);
});

test("a comparison whose last part is the equal part also reads with one 'and'", () => {
  const lines = radarLines(
    ["Speed", "Power", "Skill"],
    [
      ["Team A", [40, 70, 55]],
      ["Team B", [60, 50, 55]],
    ],
  );
  assert.deepEqual(comparisonLines(lines), ['• "Team A" is higher than "Team B" on "Power", lower on "Speed", and equal on "Skill".']);
});


// ---------------------------------------------------------------------------------------------------
// A ring count is never negative; a title or name of invisible characters reads as none; repeated
// series labels take their position; a number is never read in exponent form.

// Written with fromCodePoint so no invisible character sits in this file's source.
const HANGUL_FILLER = String.fromCodePoint(0x3164); // draws as nothing and is neither white space nor a format character
const BRAILLE_BLANK = String.fromCodePoint(0x2800);
const GRAPHEME_JOINER = String.fromCodePoint(0x034f);
const VARIATION_SELECTOR = String.fromCodePoint(0xfe0f);

// Builds a drawn chart with options and returns { short, lines } of the rendered text.
function radarText({ title = null, ticks = 5, axisLabels, seriesList }) {
  const axes = axisLabels.map((label, index) => ({ id: `a${index}`, label }));
  const curves = seriesList.map(([label, values], index) => ({
    id: `c${index}`,
    label,
    values,
    drawn: axes.length >= 2 && values.length === axes.length,
  }));
  const drawn = curves.filter((curve) => curve.drawn);
  const scaleMax = Math.max(...curves.flatMap((curve) => curve.values));
  const facts = {
    title,
    axes,
    curves,
    options: { showLegend: true, ticks, graticule: "circle", min: 0, max: null, scaleMax, scaleMaxSource: "data" },
    N: axes.length,
    K: curves.length,
    noRange: false,
    inverted: false,
    maxUnplotted: false,
    legend: true,
    tabled: drawn,
    compared: drawn,
  };
  const rendered = lib.render.renderText(lib.charts.buildRadarModel(facts));
  return { short: rendered.short, lines: rendered.detailed.split("\n") };
}

const THREE = ["Speed", "Power", "Skill"];
const gridLine = (lines) => lines.find((line) => line.startsWith("The grid has"));

test("a negative ticks value draws no ring, so it reads no rings", () => {
  const text = radarText({ ticks: -2, axisLabels: THREE, seriesList: [["S", [1, 2, 3]]] });
  assert.equal(gridLine(text.lines), "The grid has no rings, and a legend names the series.");
});

test("ticks of 5 and 1.5 still read their rings", () => {
  assert.equal(gridLine(radarText({ axisLabels: THREE, seriesList: [["S", [1, 2, 3]]] }).lines), "The grid has five circular rings, and a legend names the series.");
  assert.equal(
    gridLine(radarText({ ticks: 1.5, axisLabels: THREE, seriesList: [["S", [1, 2, 3]]] }).lines),
    "The grid has two circular rings, and a legend names the series.",
  );
});

test("a series with no axes to sit on says there are no axes, not one", () => {
  const text = radarText({ axisLabels: [], seriesList: [["S", []]] });
  assert.ok(seriesLines(text.lines)[0].startsWith('1. "S": no axes, so it is not plotted'), seriesLines(text.lines)[0]);
});

test("a series on a single axis still says only one axis", () => {
  const text = radarText({ axisLabels: ["Only"], seriesList: [["S", [4]]] });
  assert.ok(seriesLines(text.lines)[0].startsWith('1. "S": only one axis, so it is not plotted'), seriesLines(text.lines)[0]);
});

for (const [name, invisible] of [
  ["zero-width space", ZWSP],
  ["Hangul filler", HANGUL_FILLER],
  ["Braille blank", BRAILLE_BLANK],
  ["variation selector", VARIATION_SELECTOR],
  ["white space", "   "],
]) {
  test(`a title of only a ${name} reads as no title, in the short, the opening and the table caption`, () => {
    const text = radarText({ title: invisible, axisLabels: THREE, seriesList: [["S", [1, 2, 3]]] });
    assert.equal(text.short, "A radar chart with three axes and one series.");
    assert.ok(text.lines.includes("This radar chart plots one series across three axes."));
    assert.ok(text.lines.includes("Data table for this radar chart"));
    assert.ok(!text.lines.some((line) => line.includes(" titled ") || line.startsWith("Data table for:")));
  });
}

test("a visible title is still announced, and so is a title with an invisible character inside", () => {
  const plain = radarText({ title: "Team skills", axisLabels: THREE, seriesList: [["S", [1, 2, 3]]] });
  assert.equal(plain.short, 'A radar chart titled "Team skills" with three axes and one series.');
  assert.ok(plain.lines.includes("Data table for: Team skills"));
  const inside = radarText({ title: `Team${ZWSP}skills`, axisLabels: THREE, seriesList: [["S", [1, 2, 3]]] });
  assert.ok(inside.short.includes(" titled "));
});

test("an axis or series label of characters that draw as nothing reads as unlabelled", () => {
  const axes = radarText({ axisLabels: [HANGUL_FILLER, GRAPHEME_JOINER, "C"], seriesList: [["S", [1, 2, 3]]] });
  assert.equal(axesSentence(axes.lines), "The axes, clockwise from the top, are unlabelled axis 1, unlabelled axis 2 and \"C\".");
  const series = radarText({ axisLabels: THREE, seriesList: [[BRAILLE_BLANK, [1, 2, 3]]] });
  assert.ok(seriesLines(series.lines)[0].startsWith("1. Unlabelled series 1, averaging 2."), seriesLines(series.lines)[0]);
});

test("a label with an invisible character inside is still a name", () => {
  const text = radarText({ axisLabels: [`Qua${HANGUL_FILLER}lity`, "B", "C"], seriesList: [["S", [1, 2, 3]]] });
  assert.ok(axesSentence(text.lines).includes(`"Qua${HANGUL_FILLER}lity"`));
});

test("two series with the same label are told apart by their position, in every sentence and the table header", () => {
  const text = radarText({ axisLabels: THREE, seriesList: [["Team", [1, 2, 3]], ["Team", [3, 2, 1]]] });
  assert.deepEqual(seriesLines(text.lines), [
    '1. "Team" (series 1), averaging 2. Highest on "Skill", lowest on "Speed".',
    '2. "Team" (series 2), averaging 2. Highest on "Speed", lowest on "Skill".',
  ]);
  assert.deepEqual(comparisonLines(text.lines), [
    '• "Team" (series 1) is higher than "Team" (series 2) on "Skill", lower on "Speed", and equal on "Power".',
  ]);
  assert.equal(tableRows(text.lines)[0], "Axis | Team (series 1) | Team (series 2)");
});

test("only the series that share a label take a position, and a trimmed label counts as the same", () => {
  const text = radarText({
    axisLabels: THREE,
    seriesList: [["Red", [1, 2, 3]], ["Blue", [3, 2, 1]], ["Red ", [2, 2, 2]]],
  });
  assert.deepEqual(
    seriesLines(text.lines).map((line) => line.split(",")[0]),
    ['1. "Red" (series 1)', '2. "Blue"', '3. "Red " (series 3)'],
  );
  assert.equal(tableRows(text.lines)[0], "Axis | Red (series 1) | Blue | Red  (series 3)");
});

test("series labels that differ by case, or are unlabelled, take no position", () => {
  const cased = radarText({ axisLabels: THREE, seriesList: [["Team", [1, 2, 3]], ["team", [3, 2, 1]]] });
  assert.ok(!cased.lines.some((line) => line.includes("(series")));
  const blank = radarText({ axisLabels: THREE, seriesList: [["", [1, 2, 3]], ["", [3, 2, 1]]] });
  assert.ok(seriesLines(blank.lines)[0].startsWith("1. Unlabelled series 1,"));
  assert.ok(!blank.lines.some((line) => line.includes("(series")));
});

test("a repeated series label takes its position even when the series is not plotted", () => {
  const text = radarText({ axisLabels: THREE, seriesList: [["Team", [1, 2]], ["Team", [3, 2, 1]]] });
  assert.ok(seriesLines(text.lines)[0].startsWith('1. "Team" (series 1): two values for three axes'));
  assert.equal(tableRows(text.lines)[0], "Axis | Team (series 2)");
});

test("numbers are written in digits, never in exponent form", () => {
  // Three values, so the mean (2e-7) is not on an end of the values and the figure is the whole-place one.
  const small = radarText({ axisLabels: ["A", "B", "C"], seriesList: [["S", [1e-7, 2e-7, 3e-7]]] });
  assert.ok(small.lines.includes("The scale runs from 0 to 0.0000003, set by the highest value."));
  assert.ok(seriesLines(small.lines)[0].startsWith('1. "S", averaging 0.0000002.'));
  assert.deepEqual(tableRows(small.lines), ["Axis | S", "A | 0.0000001", "B | 0.0000002", "C | 0.0000003"]);
  const large = radarText({ axisLabels: ["A", "B"], seriesList: [["S", [1e21, 2e21]]] });
  assert.ok(large.lines.includes("The scale runs from 0 to 2000000000000000000000, set by the highest value."));
  assert.ok(!large.lines.some((line) => /\de[+-]?\d/.test(line)));
});

test("repeat key: a label with an edge character that draws as nothing repeats the label without it", () => {
  for (const edge of [HANGUL_FILLER, BRAILLE_BLANK, VARIATION_SELECTOR]) {
    const text = radarText({ axisLabels: [`Quality${edge}`, "Quality", "C"], seriesList: [["S", [1, 2, 3]]] });
    const sentence = axesSentence(text.lines);
    assert.ok(sentence.includes(`"Quality${edge}" (axis 1)`), sentence);
    assert.ok(sentence.includes('"Quality" (axis 2)'), sentence);
  }
  const plain = radarText({ axisLabels: ["Quality!", "Quality", "C"], seriesList: [["S", [1, 2, 3]]] });
  assert.ok(!axesSentence(plain.lines).includes("(axis"), "a visible character is a different label");
});

// The average keeps searching while it sits on an extreme, a series that overflows is refused,
// the ring count is written in digits and a ticks value that is not finite is refused, and the invisible set is wider.
const onesWithOneZero = (n) => Array.from({ length: n }, (_, index) => (index === 0 ? 0 : 1));
const manyAxes = (n) => Array.from({ length: n }, (_, index) => `X${index + 1}`);

test("20 or more axes: one zero among ones does not read as the highest value", () => {
  for (const [n, want] of [[10, "0.9"], [19, "0.9"], [20, "0.95"], [30, "0.97"], [100, "0.99"], [1000, "0.999"]]) {
    const text = radarText({ axisLabels: manyAxes(n), seriesList: [["S", onesWithOneZero(n)]] });
    assert.ok(seriesLines(text.lines)[0].startsWith(`1. "S", averaging ${want}. `), `${n} axes: ${seriesLines(text.lines)[0].slice(0, 40)}`);
  }
});

test("a figure that still sits on an extreme after the last place says about", () => {
  const text = radarText({ axisLabels: manyAxes(3000), seriesList: [["S", onesWithOneZero(3000)]] });
  assert.ok(seriesLines(text.lines)[0].startsWith('1. "S", averaging about 1. '), seriesLines(text.lines)[0].slice(0, 40));
});

test("an average that is exactly on an extreme, or equal values, never says about", () => {
  assert.ok(seriesLines(radarText({ axisLabels: THREE, seriesList: [["S", [2, 2, 2]]] }).lines)[0].startsWith('1. "S", averaging 2. '));
  assert.ok(seriesLines(radarText({ axisLabels: THREE, seriesList: [["S", [0, 3, 3]]] }).lines)[0].startsWith('1. "S", averaging 2. '));
});

test("a series whose finite values add up past the largest number is refused, not described as Infinity", () => {
  assert.throws(() => radarText({ axisLabels: ["A", "B"], seriesList: [["S", [1.7e308, 1.7e308]]] }), {
    name: "RangeError",
    message: "The radar values add up to more than a number can hold.",
  });
  const fits = radarText({ axisLabels: ["A", "B"], seriesList: [["S", [1e307, 1e307]]] });
  assert.ok(seriesLines(fits.lines)[0].startsWith('1. "S", averaging 10000000'), "a large sum that still fits is described");
});

test("a series of the smallest numbers is never described as NaN", () => {
  const text = radarText({ axisLabels: ["A", "B"], seriesList: [["S", [5e-324, 1e-323]]] });
  assert.ok(!/NaN|Infinity/.test(seriesLines(text.lines)[0]));
});

test("the ring count is written in digits, and a ticks value that is not finite is refused", () => {
  assert.equal(
    gridLine(radarText({ ticks: 1e21, axisLabels: THREE, seriesList: [["S", [1, 2, 3]]] }).lines),
    "The grid has 1000000000000000000000 circular rings, and a legend names the series.",
  );
  for (const ticks of [Infinity, -Infinity, NaN]) {
    assert.throws(() => radarText({ ticks, axisLabels: THREE, seriesList: [["S", [1, 2, 3]]] }), { name: "RangeError" }, String(ticks));
  }
  assert.equal(
    gridLine(radarText({ ticks: 10, axisLabels: THREE, seriesList: [["S", [1, 2, 3]]] }).lines),
    "The grid has 10 circular rings, and a legend names the series.",
  );
});

for (const [name, invisible] of [
  ["Mongolian free variation selector U+180B", "᠋"],
  ["Khmer inherent vowel U+17B4", "឴"],
  ["variation selector 17 U+E0100", "\u{E0100}"],
  ["unassigned default-ignorable U+2065", "⁥"],
]) {
  test(`a label or title of only ${name} reads as unlabelled, and a visible label is still a name`, () => {
    const text = radarText({ title: invisible, axisLabels: [invisible, "B", "C"], seriesList: [[invisible, [1, 2, 3]]] });
    assert.ok(axesSentence(text.lines).includes("unlabelled axis 1"), axesSentence(text.lines));
    assert.ok(seriesLines(text.lines)[0].startsWith("1. Unlabelled series 1, "), seriesLines(text.lines)[0]);
    assert.equal(text.short, "A radar chart with three axes and one series.");
    const inside = radarText({ axisLabels: [`A${invisible}B`, "B", "C"], seriesList: [["S", [1, 2, 3]]] });
    assert.ok(axesSentence(inside.lines).includes(`"A${invisible}B"`), "a label with the character inside is still a name");
  });
}

test("the C0 and C1 controls (bar U+001D and U+007F) and U+180F draw in Chromium, so a label or title of them stays a name", () => {
  for (const drawn of ["\u0000", "\u0001", "\u0085", "\u180F"]) {
    const shown = JSON.stringify(drawn);
    const text = radarText({ title: drawn, axisLabels: [drawn, "B", "C"], seriesList: [["S", [1, 2, 3]]] });
    assert.ok(!axesSentence(text.lines).includes("unlabelled axis 1"), shown);
    assert.ok(text.short.includes("titled"), shown);
  }
});

// The average adds with a compensated sum and never calls a figure on an extreme exact; labels that look and
// sound the same are a repeat; a tie of more than five axes reads as a count.
const averageOf = (values) => /averaging ([^.]*(?:\.\d+)?)\./.exec(seriesLine(values))[1];

test("a huge pair that cancels does not drop the small values from the average", () => {
  // exact mean 14 / 5 = 2.8; a plain running sum loses the 6 beside 1e252 and gives 8 / 5
  assert.equal(seriesLine([1e252, 6, -1e252, 4, 4]), '1. "S", averaging 3. Highest on "Axis1", lowest on "Axis3".');
  assert.equal(averageOf([1e17, 1, 1, 1, 1, -1e17]), "1");
});

test("the order of the values does not change the average", () => {
  assert.equal(averageOf([5, 1e308, -1e308]), "2");
  assert.equal(averageOf([1e308, -1e308, 5]), "2");
});

test("the compensated sum leaves ordinary averages as they were", () => {
  assert.equal(averageOf([1, 2]), "1.5");
  assert.equal(seriesLine([4, 4, 4]), '1. "S", averaging 4. The same value on every axis.');
  assert.equal(averageOf([0.1, 0.2, -0.3]), "0");
  assert.equal(averageOf([0.1, 4.1, 3.3]), "3");
});

test("a figure on the highest or lowest value is never called exact, at any scale", () => {
  // mean 100000000.15: 100000000.1 is the lowest value, so one more place is given
  assert.equal(
    seriesLine([100000000.1, 100000000.2, 100000000.1, 100000000.2]),
    '1. "S", averaging 100000000.15. Highest on "Axis2" and "Axis4", lowest on "Axis1" and "Axis3".'
  );
  // mean 1000000000.4375: the whole number 1000000000 is the lowest value
  assert.equal(averageOf([1e9, 1e9 + 1, 1e9 + 0.5, 1e9 + 0.25, 1e9 + 0.75, 1e9 + 0.125]), "1000000000.4");
});

test("labels that look and sound the same are a repeat: composed form, a no-break space, invisible characters inside", () => {
  for (const [first, second] of [
    ["Caf\u00E9", "Cafe\u0301"],
    ["North", "No\u200Brth"],
    ["New York", "New\u00A0York"],
    ["North", "Nor\u00ADth"],
    ["North", "Nor\u034Fth"],
  ]) {
    const text = radarText({ axisLabels: [first, second, "Z"], seriesList: [["S", [1, 2, 3]]] });
    const shown = JSON.stringify([first, second]);
    assert.ok(axesSentence(text.lines).includes(`"${first}" (axis 1), "${second}" (axis 2)`), shown);
  }
  const series = radarText({ axisLabels: THREE, seriesList: [["Caf\u00E9", [1, 2, 3]], ["Cafe\u0301", [3, 2, 1]]] });
  assert.ok(seriesLines(series.lines)[0].startsWith('1. "Caf\u00E9" (series 1), '), seriesLines(series.lines)[0]);
});

test("labels that differ to the eye stay two names: case, white space inside, another script, full-width letters", () => {
  for (const [first, second] of [
    ["North", "NORTH"],
    ["New York", "NewYork"],
    ["North", "N\u043Erth"],
    ["North", "\uFF2Eorth"],
  ]) {
    const text = radarText({ axisLabels: [first, second, "Z"], seriesList: [["S", [1, 2, 3]]] });
    assert.ok(!axesSentence(text.lines).includes("(axis"), JSON.stringify([first, second]));
  }
});

test("a tie of more than five axes reads as a count; five or fewer stay a list", () => {
  const twenty = radarText({ axisLabels: manyAxes(20), seriesList: [["S", onesWithOneZero(20)]] });
  assert.equal(seriesLines(twenty.lines)[0], '1. "S", averaging 0.95. Highest on 19 axes, lowest on "X1".');
  const six = radarText({ axisLabels: manyAxes(7), seriesList: [["S", onesWithOneZero(7)]] });
  assert.equal(seriesLines(six.lines)[0], '1. "S", averaging 0.9. Highest on six axes, lowest on "X1".');
  const lowSix = radarText({ axisLabels: manyAxes(7), seriesList: [["S", [1, 0, 0, 0, 0, 0, 0]]] });
  assert.equal(seriesLines(lowSix.lines)[0], '1. "S", averaging 0.1. Highest on "X1", lowest on six axes.');
  const five = radarText({ axisLabels: manyAxes(6), seriesList: [["S", onesWithOneZero(6)]] });
  assert.equal(seriesLines(five.lines)[0], '1. "S", averaging 0.8. Highest on "X2", "X3", "X4", "X5" and "X6", lowest on "X1".');
});

// ---- The marks Chromium draws are names, U+FEFF in the repeat key, and the one compensated sum ----

const DRAWN_MARK_RANGES = [[0x600, 0x605], [0x6dd, 0x6dd], [0x70f, 0x70f], [0x890, 0x891], [0x8e2, 0x8e2], [0x1680, 0x1680], [0xfff9, 0xfffb], [0x110bd, 0x110bd], [0x110cd, 0x110cd], [0x13430, 0x1343f], [0x1bca0, 0x1bca3]];
const DRAWN_MARKS_ALL = DRAWN_MARK_RANGES.flatMap(([from, to]) => Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i)));

test("a label or title made of one of the 37 drawn marks is a name; the members that only advance stay blank", () => {
  assert.equal(DRAWN_MARKS_ALL.length, 37);
  for (const mark of DRAWN_MARKS_ALL) {
    const shown = "U+" + mark.codePointAt(0).toString(16);
    const text = radarText({ title: mark, axisLabels: [mark, "B", "C"], seriesList: [["S", [1, 2, 3]]] });
    assert.ok(text.short.includes("titled"), shown);
    assert.ok(axesSentence(text.lines).includes(`"${mark}"`), shown);
    assert.ok(!axesSentence(text.lines).includes("unlabelled axis 1"), shown);
  }
  for (const blank of ["\u200B", "\u034F", "\u17B4", "\u2800", "\uFEFF", "\u00AD"]) {
    const shown = "U+" + blank.codePointAt(0).toString(16);
    const text = radarText({ title: blank, axisLabels: [blank, "B", "C"], seriesList: [["S", [1, 2, 3]]] });
    assert.ok(axesSentence(text.lines).includes("unlabelled axis 1"), shown);
    assert.equal(text.short, "A radar chart with three axes and one series.", shown);
  }
});

test("the repeat key removes an interior U+FEFF, as the pie's does, and keeps different names apart", () => {
  const repeated = (a, b) => {
    const sentence = axesSentence(radarText({ axisLabels: [a, b, "C"], seriesList: [["S", [1, 2, 3]]] }).lines);
    return sentence.includes("(axis 1)") && sentence.includes("(axis 2)");
  };
  assert.ok(repeated("North", "No\uFEFFrth"));
  assert.ok(repeated("Caf\u00E9", "Cafe\u0301"));
  assert.ok(!repeated("North", "NORTH"));
  assert.ok(!repeated("New York", "NewYork"));
});

test("the one compensated sum: values that overflow a sum are still refused, and a small value beside a huge one is kept", () => {
  assert.throws(() => radarText({ axisLabels: ["A", "B"], seriesList: [["S", [Number.MAX_VALUE, Number.MAX_VALUE]]] }), RangeError);
  // The exact mean is 14 / 5 = 2.8, which sits inside the range and reads as the whole number 3; a plain running sum gives 8 / 5 and reads 2.
  assert.equal(averageOf([1e252, 6, -1e252, 4, 4]), "3");
});

// U+001D and U+007F draw nothing in Chromium, so they read as no label and no title; U+0001 draws a box and stays a name

test("a label or title of only U+001D or U+007F reads as none, and U+0001 is still a name", () => {
  for (const blank of ["\u001D", "\u007F"]) {
    const shown = JSON.stringify(blank);
    const text = radarText({ title: blank, axisLabels: [blank, "B", "C"], seriesList: [["S", [1, 2, 3]]] });
    assert.ok(axesSentence(text.lines).includes("unlabelled axis 1"), shown);
    assert.equal(text.short, "A radar chart with three axes and one series.", shown);
  }
  const named = radarText({ title: "\u0001", axisLabels: ["\u0001", "B", "C"], seriesList: [["S", [1, 2, 3]]] });
  assert.ok(named.short.includes("titled"));
  assert.ok(!axesSentence(named.lines).includes("unlabelled axis 1"));
});

// Round 6, register 84: the finite guard in compensatedSum is live, so a test pins it. Without it an infinite value reads NaN.
test("compensated sum: an infinite value reads about Infinity, never NaN", () => {
  assert.equal(seriesLine([Infinity, 1, 2]), "1. \"S\", averaging about Infinity. Highest on \"Axis1\", lowest on \"Axis2\".");
  assert.ok(!seriesLine([-Infinity, 1, 2]).includes("NaN"));
});
