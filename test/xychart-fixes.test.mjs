// These tests pin five fixes to the bar and line chart describer, each one a sentence that was untrue.
// 1. A trend is "consistent" only when the series also ends on the side that most of its steps point to.
// 2. A spoken average lies inside the spoken range, and a value that is not zero is never spoken as zero.
// 3. Series with equal averages are not ranked, so none "shows the highest overall values".
// 4. A flat-topped peak (or a flat-bottomed trough) counts once.
// 5. A label is called a year, a date or a month only when it is one.
// Each test builds a chart and checks the exact sentence, and each fix has a chart just on the other side of its rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const lib = require("./load.cjs");

const label = (count) => Array.from({ length: count }, (_, i) => "L" + (i + 1));
const band = (title, categories) => ({ kind: "band", title, categories });
const line = (name, values) => ({ kind: "line", name, values });
const bar = (name, values) => ({ kind: "bar", name, values });
const chart = (xAxis, series) => ({
  type: "xychart",
  title: null,
  accTitle: "",
  accDescr: "",
  orientation: "vertical",
  xAxis,
  yAxis: null,
  series,
});

// Builds the chart and returns the short sentence and the lines of the detailed text.
function describe(input) {
  const built = lib.charts.buildXychartModel(JSON.parse(JSON.stringify(input)));
  return {
    short: lib.model.flatten(built.short),
    lines: lib.render.renderText(built).detailed.split("\n"),
  };
}

// ---- Fix 1: "consistently" needs the series to end on the side its steps point to ----

const SPIKE = chart(band(null, label(10)), [line("Score", [10, 9, 8, 7, 6, 5, 4, 3, 2, 1000])]);
const CRASH = chart(band(null, ["Mon", "Tue", "Wed", "Thu", "Fri"]), [line("Score", [10, 11, 12, 13, -100])]);

test("trend: eight falls and a final jump to 1000 is not a consistent fall", () => {
  const out = describe(SPIKE);
  assert.equal(
    out.short,
    'A line chart showing "Score" over 10 categories. The "Score" series peaks significantly at 1000 during "L10".'
  );
  assert.ok(out.lines.includes('• The "Score" series shows a generally increasing trend, with fluctuations.'));
  assert.ok(out.lines.includes("• Overall increase of 9900.0% from start to end."));
  assert.equal(out.lines.filter((text) => text.includes("consistently")).length, 0);
});

test("trend: four rises and a final drop to -100 is not a consistent rise", () => {
  const out = describe(CRASH);
  assert.equal(
    out.short,
    'A line chart showing "Score" over five days. The "Score" series is generally decreasing with fluctuations, with values between -100 and 13.'
  );
  assert.ok(out.lines.includes('• The "Score" series shows a generally decreasing trend, with fluctuations.'));
  assert.ok(out.lines.includes("• Overall decrease of 1100.0% from start to end."));
  assert.equal(out.lines.filter((text) => text.includes("consistently")).length, 0);
});

test("trend: eight falls that end lower still read as a consistent fall", () => {
  const out = describe(chart(band(null, label(10)), [line("Score", [10, 9, 8, 7, 6, 5, 4, 3, 9, 1])]));
  assert.equal(
    out.short,
    'A line chart showing "Score" over 10 categories. The "Score" series shows a consistently decreasing trend, ranging from 1 to 10.'
  );
  assert.ok(out.lines.includes('• The "Score" series shows a consistently decreasing trend.'));
});

test("trend: eight rises and a last fall that still ends higher read as a consistent rise", () => {
  const out = describe(chart(band(null, label(10)), [line("Score", [1, 2, 3, 4, 5, 6, 7, 8, 9, 3])]));
  assert.equal(
    out.short,
    'A line chart showing "Score" over 10 categories. The "Score" series shows a consistently increasing trend, ranging from 1 to 9.'
  );
  assert.ok(out.lines.includes('• The "Score" series shows a consistently increasing trend.'));
});

test("trend: eight rises that end where they began are not a consistent rise", () => {
  const out = describe(chart(band(null, label(10)), [line("Score", [1, 2, 3, 4, 5, 6, 7, 8, 9, 1])]));
  assert.equal(out.lines.filter((text) => text.includes("consistently")).length, 0);
  assert.ok(out.lines.includes('• The "Score" series rises, then falls.'));
});

// ---- Fix 2: the spoken average lies inside the spoken range ----

const LEVEL = (values) => chart(band(null, ["A", "B"]), [bar("Level", values)]);

const AVERAGE_ROWS = [
  { name: "100.6 and 100.8 average 100.7, not 101", input: LEVEL([100.6, 100.8]), range: "100.6 to 100.8", average: "100.7" },
  { name: "-100.8 and -100.6 average -100.7, not -101", input: LEVEL([-100.8, -100.6]), range: "-100.8 to -100.6", average: "-100.7" },
  { name: "10.04 and 10.06 average 10.05, not 10.1", input: LEVEL([10.04, 10.06]), range: "10.04 to 10.06", average: "10.05" },
  { name: "1.004 and 1.006 average 1.005, not 1", input: LEVEL([1.004, 1.006]), range: "1.004 to 1.006", average: "1.005" },
  {
    name: "three tiny values average 0.00002, not 0, and are not all about 0.00",
    input: chart(band(null, ["A", "B", "C"]), [bar("Probability", [0.00001, 0.00002, 0.00003])]),
    range: "0.00001 to 0.00003",
    shortRange: "about 0.00001 to about 0.00003",
    average: "0.00002",
    count: "three",
  },
  {
    name: "two values that differ at the fifth decimal are not both about 1.00",
    input: LEVEL([1.00411, 1.00413]),
    range: "1.00411 to 1.00413",
    shortRange: "about 1.00411 to about 1.00413",
    average: "1.00412",
  },
];

for (const row of AVERAGE_ROWS) {
  test(`average: ${row.name}`, () => {
    const out = describe(row.input);
    const count = row.count || "two";
    assert.equal(
      out.short,
      `A bar chart showing "${row.input.series[0].name}" for ${count} categories. Values range from ${row.shortRange || row.range} with an average of ${row.average}.`
    );
    assert.ok(out.lines.includes(`• Values range from ${row.range} with an average of ${row.average}.`));
    assert.ok(out.lines.includes(`• Average value: ${row.average}.`));
  });
}

test("range: a small value beside a larger one is not spoken as about 0.00", () => {
  const out = describe(chart(band(null, ["A", "B", "C"]), [line("Rate", [0.00001, 0.002, 0.004])]));
  assert.equal(
    out.short,
    'A line chart showing "Rate" over three categories. The "Rate" series shows a consistently increasing trend, ranging from about 0.00001 to 0.004.'
  );
});

test("average: a mean that already lies inside the range keeps the magnitude rule", () => {
  const out = describe(LEVEL([99.4, 101.2]));
  assert.equal(
    out.short,
    'A bar chart showing "Level" for two categories. Values range from 99.4 to 101.2 with an average of 100.'
  );
  assert.ok(out.lines.includes("• Average value: 100."));
});

test("average: a value that rounds to a non-zero figure is still spoken rounded", () => {
  const out = describe(chart(band(null, ["A", "B", "C"]), [bar("Share", [0.34567, 0.5, 0.6])]));
  assert.equal(
    out.short,
    'A bar chart showing "Share" for three categories. Values range from about 0.35 to 0.6 with an average of 0.48.'
  );
});

// ---- Fix 3: equal averages are not ranked ----

const SAME_THREE = [5, 6, 7];

test("highest: two identical series have the same average and neither is highest", () => {
  const out = describe(chart(band(null, ["A", "B", "C"]), [line("North", SAME_THREE), line("South", SAME_THREE)]));
  assert.equal(out.short, "A line chart over three categories. The series have the same average.");
  assert.ok(out.lines.includes("• The series have the same average."));
  assert.equal(out.lines.filter((text) => text.includes("highest overall")).length, 0);
});

test("highest: two unnamed identical bar series say the same", () => {
  const out = describe(chart(band(null, ["A", "B", "C"]), [bar(null, SAME_THREE), bar(null, SAME_THREE)]));
  assert.ok(out.lines.includes("• The series have the same average."));
});

test("highest: the same numbers in another order do not let rounding noise pick a winner", () => {
  const out = describe(
    chart(band(null, ["A", "B", "C"]), [line("North", [0.1, 0.2, 0.3]), line("South", [0.3, 0.2, 0.1])])
  );
  assert.equal(out.short, "A line chart over three categories. The series have the same average.");
});

test("highest: two of three series tie for the top and both are named", () => {
  const out = describe(
    chart(band(null, ["A", "B", "C"]), [line("North", SAME_THREE), line("South", SAME_THREE), line("West", [1, 2, 3])])
  );
  assert.ok(
    out.lines.includes('• The "North" series and the "South" series show the highest overall values.')
  );
});

test("highest: averages that differ keep the one-series sentence", () => {
  const out = describe(chart(band(null, ["A", "B", "C"]), [line("North", [6, 7, 8]), line("South", SAME_THREE)]));
  assert.equal(out.short, 'A line chart over three categories. The "North" series shows the highest overall values.');
});

test("highest: averages that differ by a small amount still name the higher one", () => {
  const out = describe(chart(band(null, ["A", "B", "C"]), [line("North", SAME_THREE), line("South", [5, 6, 7.001])]));
  assert.equal(out.short, 'A line chart over three categories. The "South" series shows the highest overall values.');
});

// ---- Fix 4: a flat-topped peak counts once ----

const CYCLIC = (values) => describe(chart(band(null, label(values.length)), [line("Score", values)])).lines;

test("peaks: one flat-topped peak among sharp ones is counted", () => {
  assert.ok(
    CYCLIC([1, 5, 1, 5, 5, 1, 5, 1, 5, 1]).includes("• The data shows a cyclic pattern with four peaks and three troughs.")
  );
});

test("peaks: three flat-topped peaks are a cycle, and the sentence is now said", () => {
  assert.ok(
    CYCLIC([1, 5, 5, 1, 1, 5, 5, 1, 1, 5, 5, 1]).includes("• The data shows a cyclic pattern with three peaks and two troughs.")
  );
});

test("peaks: a flat-bottomed trough counts once", () => {
  assert.ok(
    CYCLIC([1, 5, 1, 1, 5, 1, 5, 1, 5, 1]).includes("• The data shows a cyclic pattern with four peaks and three troughs.")
  );
});

test("peaks: sharp peaks are counted as before", () => {
  assert.ok(
    CYCLIC([1, 5, 1, 5, 1, 5, 1, 5, 1]).includes("• The data shows a cyclic pattern with four peaks and three troughs.")
  );
});

test("peaks: one flat-topped hill is still one peak and says nothing about a cycle", () => {
  assert.equal(CYCLIC([1, 2, 3, 3, 3, 2, 1]).filter((text) => text.includes("cyclic")).length, 0);
});

// ---- Fix 5: label nouns ----

// The plural noun that a list of x-axis labels is given, read from the "<Nouns> are plotted" line.
function nounFor(labels) {
  const out = describe(chart(band(null, labels), [bar("Count", labels.map((_, i) => i + 1))]));
  const found = out.lines.map((text) => /^(\w+) are plotted on the x-axis\.$/.exec(text)).find(Boolean);
  return found ? found[1] : null;
}

const NOUN_ROWS = [
  { name: "year and month labels are categories", labels: ["2024-01", "2024-02", "2024-03"], noun: "Categories" },
  { name: "version numbers are categories", labels: ["1.2.10", "1.3.10", "1.4.10"], noun: "Categories" },
  { name: "bins of a thousand are categories", labels: ["1000", "2000", "3000", "4000"], noun: "Categories" },
  { name: "split years in a row are years", labels: ["2020-21", "2021-22", "2022-23"], noun: "Years" },
  { name: "split years across a century are years", labels: ["1999-00", "2000-01"], noun: "Years" },
  { name: "slashed split years are years", labels: ["2020/21", "2021/22"], noun: "Years" },
  { name: "split years with four-digit second years are years", labels: ["2020-2021", "2021-2022"], noun: "Years" },
  { name: "a split year that skips a year is a category", labels: ["2020-22", "2022-24"], noun: "Categories" },
  { name: "plain years are years", labels: ["2023", "2024", "2025"], noun: "Years" },
  { name: "the earliest and latest accepted years are years", labels: ["1800", "1900", "2000", "2100", "2200"], noun: "Years" },
  { name: "a year before 1800 is a category", labels: ["1799", "1800"], noun: "Categories" },
  { name: "a year after 2200 is a category", labels: ["2200", "2201"], noun: "Categories" },
  { name: "dotted dates with four-digit years are dates", labels: ["01.02.2024", "02.02.2024"], noun: "Dates" },
  { name: "slashed dates with two-digit years are dates", labels: ["3/4/24", "5/4/24"], noun: "Dates" },
  { name: "a date with a day of 31 and a month of 12 is a date", labels: ["31/12/24", "1/1/25"], noun: "Dates" },
  { name: "a date with no possible month is a category", labels: ["13/13/24", "14/14/24"], noun: "Categories" },
  { name: "a date with a day of 32 is a category", labels: ["32/1/24", "33/1/24"], noun: "Categories" },
  { name: "ISO dates are dates", labels: ["2024-01-05", "2024-01-06"], noun: "Dates" },
];

for (const row of NOUN_ROWS) {
  test(`noun: ${row.name}`, () => {
    assert.equal(nounFor(row.labels), row.noun);
  });
}

test("noun: year and month labels read as categories in the short sentence and the detailed opening", () => {
  const out = describe(chart(band(null, ["2024-01", "2024-02", "2024-03"]), [line("Visits", [5, 7, 6])]));
  assert.equal(
    out.short,
    'A line chart showing "Visits" over three categories. The "Visits" series rises to a peak at "2024-02", then falls, with values between 5 and 7.'
  );
  assert.ok(
    out.lines.some((text) =>
      text.startsWith('This line chart shows "Visits" over three categories, from "2024-01" to "2024-03".')
    )
  );
});
