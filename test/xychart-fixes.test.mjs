// These tests pin five fixes to the bar and line chart describer, each one a sentence that was untrue.
// 1. A trend is "consistent" only when the series also ends on the side that most of its steps point to.
// 2. A spoken average lies inside the spoken range, and a value that is not zero is never spoken as zero.
// 3. Series with equal averages are not ranked, so none "shows the highest overall values".
// 4. A flat-topped peak (or a flat-bottomed trough) counts once.
// 5. A label is called a year, a date or a month only when it is one.
// 6. Wording that misled: a mostly flat series that ends far from its start, a trend claimed from the end points alone,
//    a percentage of a start near zero, a value outside the y-axis range, one or two steps called a consistent trend,
//    a blank label, a tie inside brackets, a trend said twice, "points" on a labelled axis and two series with one name.
// 7. A repeated or blank label is judged without its edge spaces and invisible characters.
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
    'A line chart showing "Score" over 10 categories. The "Score" series peaks at 1000 during "L10", well above its average.'
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
  assert.ok(out.lines.includes('• The "Score" series is generally decreasing with fluctuations, with values between -100 and 13.'));
  assert.ok(out.lines.includes("• Overall, the values go from 10 at the start to -100 at the end."));
  assert.equal(out.lines.filter((text) => text.includes("consistently")).length, 0);
});

test("trend: eight falls and one rise of two thirds of the range read as a fall with fluctuations (a single step against the direction above 0.25 of the range)", () => {
  const out = describe(chart(band(null, label(10)), [line("Score", [10, 9, 8, 7, 6, 5, 4, 3, 9, 1])]));
  assert.equal(
    out.short,
    'A line chart showing "Score" over 10 categories. The "Score" series peaks at 10 during "L1", well above its average.'
  );
  assert.ok(out.lines.includes('• The "Score" series shows a generally decreasing trend, with fluctuations.'));
  assert.ok(!out.lines.some((text) => text.includes("consistently")), "not called consistent");
});

test("trend: eight rises and a last fall that still ends higher read as a rise, then a fall", () => {
  const out = describe(chart(band(null, label(10)), [line("Score", [1, 2, 3, 4, 5, 6, 7, 8, 9, 3])]));
  assert.equal(
    out.short,
    'A line chart showing "Score" over 10 categories. The "Score" series peaks at 9 during "L9", well above its average.'
  );
  assert.ok(out.lines.includes('• The "Score" series rises, then falls.'));
  assert.ok(!out.lines.some((text) => text.includes("consistently")), "the last fall is not called a consistent rise");
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
    shortRange: "0.00001 to 0.00003",
    average: "0.00002",
    count: "three",
  },
  {
    name: "two values that differ at the fifth decimal are not both about 1.00",
    input: LEVEL([1.00411, 1.00413]),
    range: "1.00411 to 1.00413",
    // Both ends round to 1.00 alike, so they are written to five decimals; those digits are the typed values, so neither is "about".
    // (This row used to read "about 1.00411 to about 1.00413": the word was kept for ends that had rounded alike, though the digits were exact.)
    shortRange: "1.00411 to 1.00413",
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
    'A line chart showing "Rate" over three categories. The "Rate" series rises, ranging from 0.00001 to 0.004.'
  );
});

test("average: a mean that already lies inside the range keeps the magnitude rule", () => {
  const out = describe(LEVEL([99.4, 101.2]));
  assert.equal(
    out.short,
    'A bar chart showing "Level" for two categories. Values range from 99.4 to 101.2 with an average of 100.3.'
  );
  // The bullet repeats the range sentence's average: 100 sat 16.7% of the range from the mean, so both read 100.3.
  assert.ok(out.lines.includes("• Values range from 99.4 to 101.2 with an average of 100.3."));
  assert.ok(out.lines.includes("• Average value: 100.3."));
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
  const out = describe(chart(band(null, ["A", "B", "C"]), [line("North", SAME_THREE), line("South", [5, 6, 7.3])]));
  assert.equal(out.short, 'A line chart over three categories. The "South" series shows the highest overall values.');
});

// ---- Fix 4: a flat-topped peak counts once ----

const CYCLIC = (values) => describe(chart(band(null, label(values.length)), [line("Score", values)])).lines;

test("peaks: one flat-topped peak among sharp ones is counted", () => {
  assert.ok(
    CYCLIC([1, 5, 1, 5, 5, 1, 5, 1, 5, 1]).includes("• The data rises and falls repeatedly, with four peaks and three troughs.")
  );
});

test("peaks: three flat-topped peaks are a cycle, and the sentence is now said", () => {
  assert.ok(
    CYCLIC([1, 5, 5, 1, 1, 5, 5, 1, 1, 5, 5, 1]).includes("• The data rises and falls repeatedly, with three peaks and two troughs.")
  );
});

test("peaks: a flat-bottomed trough counts once", () => {
  assert.ok(
    CYCLIC([1, 5, 1, 1, 5, 1, 5, 1, 5, 1]).includes("• The data rises and falls repeatedly, with four peaks and three troughs.")
  );
});

test("peaks: sharp peaks are counted as before", () => {
  assert.ok(
    CYCLIC([1, 5, 1, 5, 1, 5, 1, 5, 1]).includes("• The data rises and falls repeatedly, with four peaks and three troughs.")
  );
});

test("peaks: one flat-topped hill is still one peak and says nothing about a cycle", () => {
  assert.equal(CYCLIC([1, 2, 3, 3, 3, 2, 1]).filter((text) => text.includes("rises and falls repeatedly")).length, 0);
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

// ---- Fix 6: wording that misled, each with a chart just on the other side of its rule ----

const ZWSP = "​";
const ZWJ = "‍";
const scoreLine = (values, categories = label(values.length)) => chart(band(null, categories), [line("Score", values)]);
const levelBar = (categories, values) => chart(band(null, categories), [bar("Level", values)]);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

test("level: a flat series that ends far from its start is level apart from one large change", () => {
  const fall = describe(scoreLine([100, 100, 0, 0, 0, 0]));
  assert.ok(fall.lines.includes('• The "Score" series is mostly level, apart from a large fall.'));
  assert.equal(fall.lines.filter((text) => text.includes("stable")).length, 0);

  const rise = describe(scoreLine([0, 0, 0, 0, 0, 100]));
  assert.ok(rise.lines.includes('• The "Score" series is mostly level, apart from a large rise.'));
});

test("level: a flat series with a small wobble is still stable", () => {
  const out = describe(scoreLine([10, 10, 10, 10, 10, 10.2, 10, 10]));
  assert.ok(out.lines.includes('• The "Score" series is stable, with values between 10 and 10.2.'));
  assert.equal(out.lines.filter((text) => text.includes("mostly level")).length, 0);
});

test("fitted: a zigzag whose ends point one way but whose fitted line points the other has no clear trend", () => {
  const out = describe(scoreLine([0, 9, 2, 8, 1, 7, 0.5, 6, 0.4, 5, 1]));
  assert.ok(out.lines.includes('• The "Score" series fluctuates with no clear trend.'));
  assert.equal(out.lines.filter((text) => text.includes("generally increasing")).length, 0);
});

test("fitted: a rise with a dip along the way is still generally increasing", () => {
  const out = describe(scoreLine([1, 3, 2, 5, 4, 7, 6, 9]));
  assert.ok(out.lines.includes('• The "Score" series shows a generally increasing trend, with fluctuations.'));
});

test("fitted: a zigzag whose ends point up but whose fitted line points down has no clear trend", () => {
  const out = describe(scoreLine([10, 1, 9, 2, 9, 3, 9, 4, 9, 5, 9.5]));
  assert.ok(out.lines.includes('• The "Score" series fluctuates with no clear trend.'));
  assert.equal(out.lines.filter((text) => text.includes("generally decreasing")).length, 0);
});

test("peak: a peak is said to be well above the average, not significant", () => {
  const out = describe(scoreLine([1, 3, 2, 5, 4, 7, 6, 9]));
  assert.equal(
    out.short,
    'A line chart showing "Score" over eight categories. The "Score" series peaks at 9 during "L8", well above its average.'
  );
  assert.equal(out.lines.filter((text) => text.includes("significantly")).length, 0);
});

test("steps: two steps are a rise or a fall, and three or more can be a consistent trend", () => {
  const two = describe(chart(band(null, ["A", "B"]), [line("Score", [9, 3])]));
  assert.equal(
    two.short,
    'A line chart showing "Score" over two categories. The "Score" series falls, ranging from 3 to 9.'
  );
  const three = describe(chart(band(null, ["A", "B", "C"]), [line("Score", [9, 6, 3])]));
  assert.equal(
    three.short,
    'A line chart showing "Score" over three categories. The "Score" series falls, ranging from 3 to 9.'
  );
  const four = describe(scoreLine([1, 2, 3, 4]));
  assert.equal(
    four.short,
    'A line chart showing "Score" over four categories. The "Score" series shows a consistently increasing trend, ranging from 1 to 4.'
  );
  assert.deepEqual(
    four.lines.filter((text) => text.includes("consistently")),
    ['• The "Score" series shows a consistently increasing trend, ranging from 1 to 4.']
  );
});

test("overall: a start near zero gives the two values, not a percentage of the start", () => {
  const out = describe(scoreLine([0.5, 40, 60, 80, 100]));
  assert.ok(out.lines.includes("• Overall, the values go from 0.5 at the start to 100 at the end."));
  assert.equal(out.lines.filter((text) => text.includes("Overall increase")).length, 0);
});

test("overall: a start that is not near zero keeps the percentage", () => {
  const out = describe(scoreLine([5, 40, 60, 80, 100]));
  assert.ok(out.lines.includes("• Overall increase of 1900.0% from start to end."));
  assert.equal(out.lines.filter((text) => text.startsWith("• Overall, the values go")).length, 0);
});

test("overall: values on either side of zero give the two values", () => {
  const out = describe(scoreLine([-4, -2, 0, 2, 4], DAYS));
  assert.ok(out.lines.includes("• Overall, the values go from -4 at the start to 4 at the end."));
});

test("range: a value outside the declared y-axis range is said so", () => {
  const out = describe({ ...levelBar(DAYS, [-10, 20, 30, 40, 50]), yAxis: { title: "Level", min: 0, max: 100 } });
  assert.ok(
    out.lines.includes(
      'Days are plotted on the x-axis, and the y-axis, "Level", runs from 0 to 100. Some values lie outside the y-axis range.'
    )
  );
});

test("range: values inside, on the edge of, or beyond a reversed y-axis range say nothing", () => {
  const sentence = 'Days are plotted on the x-axis, and the y-axis, "Level", runs from 0 to 100.';
  for (const values of [[10, 20, 30, 40, 50], [0, 20, 30, 40, 100]]) {
    const out = describe({ ...levelBar(DAYS, values), yAxis: { title: "Level", min: 0, max: 100 } });
    assert.ok(out.lines.includes(sentence));
  }
  const reversed = describe({ ...levelBar(DAYS, [10, 20, 30, 40, 50]), yAxis: { title: "Level", min: 100, max: 0 } });
  assert.equal(reversed.lines.filter((text) => text.includes("outside")).length, 0);
});

test("blank: a blank label is named by its position everywhere it is spoken", () => {
  const out = describe(levelBar(["A", "B", "C", ""], [1, 2, 3, 4]));
  assert.equal(
    out.short,
    'A bar chart showing "Level" for four categories. The highest value, 4 at unlabelled category 4, is 60% above the average.'
  );
  assert.ok(
    out.lines.includes(
      'This bar chart shows "Level" for four categories, from "A" to unlabelled category 4. The chart has one data series.'
    )
  );
  assert.ok(out.lines.includes("• Highest value: 4 (unlabelled category 4)."));
  assert.ok(out.lines.includes("Unlabelled category 4 | 4"));
});

test("blank: a blank first label on a line chart reads the same way", () => {
  const out = describe(chart(band(null, ["", "B", "C", "D"]), [line("Level", [4, 3, 2, 1])]));
  assert.ok(
    out.lines.includes(
      'This line chart shows "Level" over four categories, from unlabelled category 1 to "D". The chart has one data series.'
    )
  );
  assert.ok(out.lines.includes("• The \"Level\" series peaks at 4 (unlabelled category 1)."));
});

test("blank: labels that are all present keep their quoted names", () => {
  const out = describe(levelBar(["A", "B", "C", "D"], [1, 2, 3, 4]));
  assert.ok(
    out.lines.includes(
      'This bar chart shows "Level" for four categories, from "A" to "D". The chart has one data series.'
    )
  );
  assert.ok(out.lines.includes('• Highest value: 4 ("D").'));
});

test("tie: a tie among distinct labels keeps the bracket form", () => {
  const out = describe(levelBar(DAYS, [1, 5, 2, 5, 3]));
  assert.ok(out.lines.includes('• Highest value: 5 ("Tue" and "Thu").'));
});

test("tie: a tie that holds a repeated label puts the positions in the sentence", () => {
  const out = describe(levelBar(["Mon", "Tue", "Mon", "Wed"], [1, 9, 9, 2]));
  assert.ok(out.lines.includes('• Highest value: 9, at "Tue" and "Mon" (the third position).'));
});

test("trend bullet: a consistent trend is not said twice", () => {
  const out = describe(scoreLine([1, 2, 3, 4, 5], DAYS));
  assert.deepEqual(
    out.lines.filter((text) => text.includes("consistently")),
    ['• The "Score" series shows a consistently increasing trend, ranging from 1 to 5.']
  );
});

test("trend bullet: a series whose mean is zero keeps both lines, because the takeaway does not say the trend", () => {
  const out = describe(scoreLine([-4, -2, 0, 2, 4], DAYS));
  assert.ok(out.lines.includes('• The "Score" series shows a consistently increasing trend.'));
});

test("collapse: four tied points on a labelled axis are categories, not points", () => {
  const out = describe(scoreLine([1, 9, 1, 9, 1, 9, 1, 9]));
  assert.ok(out.lines.includes('• The "Score" series peaks at 9, at four of the categories.'));
  const days = describe(levelBar(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], [9, 1, 9, 1, 9, 1, 9]));
  assert.ok(days.lines.includes("• Highest value: 9 (four of the days)."));
});

test("collapse: four tied points on a range axis stay points", () => {
  const out = describe({
    ...chart({ kind: "range", title: "Mark", min: 0, max: 7 }, [bar("Level", [1, 9, 1, 9, 1, 9, 1, 9])]),
  });
  assert.ok(out.lines.includes("• Highest value: 9 (four points)."));
});

test("series: two series with one name are told apart by their kind, or by their order when the kind is the same", () => {
  const out = describe(chart(band(null, ["A", "B", "C"]), [bar("Total", [1, 2, 3]), line("Total", [3, 2, 1])]));
  assert.ok(out.lines.includes('• The "Total" line series falls.'));
  assert.ok(out.lines.includes('• Highest value in the "Total" bar series: 3 ("C").'));
  assert.ok(out.lines.includes("Category | Total (series 1) | Total (series 2)"));
  const same = describe(chart(band(null, ["A", "B", "C"]), [line("Total", [1, 2, 3]), line("Total", [3, 2, 2.5])]));
  assert.ok(same.lines.includes('• The second "Total" series falls, then rises.'));
  assert.ok(same.lines.includes('• The first "Total" series peaks at 3 ("C").'));
});

test("series: two series with different names keep their plain names", () => {
  const out = describe(chart(band(null, ["A", "B", "C"]), [line("North", [1, 2, 3]), line("South", [3, 2, 1])]));
  assert.ok(out.lines.includes('• The "North" series rises.'));
  assert.ok(out.lines.includes("Category | North | South"));
});

// ---- Fix 7: a repeat or a blank is judged on the text without its edge spaces and invisible characters ----

const AUTUMN = (second) => levelBar(["Spring", second, "Autumn", "Winter"], [1, 9, 2, 3]);

test("repeat: a label with a trailing space repeats the label without one", () => {
  const out = describe(AUTUMN("Autumn "));
  assert.equal(
    out.short,
    'A bar chart showing "Level" for four categories. The highest value, 9 at "Autumn " (the second position), is 140% above the average.'
  );
  assert.ok(out.lines.includes('• Highest value: 9 ("Autumn ", the second position).'));
  assert.ok(out.lines.includes("Autumn  (position 2) | 9"));
  assert.ok(out.lines.includes("Autumn (position 3) | 2"));
});

test("repeat: a label with a trailing zero-width space repeats the label without one", () => {
  const out = describe(AUTUMN(`Autumn${ZWSP}`));
  assert.equal(
    out.short,
    `A bar chart showing "Level" for four categories. The highest value, 9 at "Autumn${ZWSP}" (the second position), is 140% above the average.`
  );
  assert.ok(out.lines.includes(`Autumn${ZWSP} (position 2) | 9`));
  assert.ok(out.lines.includes("Autumn (position 3) | 2"));
});

test("repeat: a different case is a different label, and a run of white space inside a label is one space", () => {
  const lower = describe(AUTUMN("autumn"));
  assert.equal(
    lower.short,
    'A bar chart showing "Level" for four categories. The highest value, 9 at "autumn", is 140% above the average.'
  );
  assert.ok(lower.lines.includes("autumn | 9"));
  // Two spaces, a no-break space, a thin space, a tab or a line break sound the same as one space, so the labels repeat.
  const interior = describe(levelBar(["Spring", "Late  Autumn", "Late Autumn", "Winter"], [1, 9, 2, 3]));
  assert.ok(interior.lines.includes("Late  Autumn (position 2) | 9"));
  assert.ok(interior.lines.includes("Late Autumn (position 3) | 2"));
  const thin = describe(levelBar(["Spring", "Late Autumn", "Late Autumn", "Winter"], [1, 9, 2, 3]));
  assert.ok(thin.lines.includes("Late Autumn (position 2) | 9"));
  // But no space at all is a different label.
  const joined = describe(levelBar(["Spring", "LateAutumn", "Late Autumn", "Winter"], [1, 9, 2, 3]));
  assert.ok(joined.lines.includes("LateAutumn | 9"));
});

test("blank: a label of zero-width characters only is blank", () => {
  const out = describe(levelBar(["Spring", ZWSP, "Autumn", "Winter"], [1, 9, 2, 3]));
  assert.equal(
    out.short,
    'A bar chart showing "Level" for four categories. The highest value, 9 at unlabelled category 2, is 140% above the average.'
  );
  assert.ok(out.lines.includes("Unlabelled category 2 | 9"));
});

test("blank: two blank labels tied for the highest value keep the bracket form", () => {
  for (const blank of ["", ZWSP + ZWJ, " "]) {
    const out = describe(levelBar(["A", blank, blank, "D"], [1, 9, 9, 2]));
    assert.ok(out.lines.includes("• Highest value: 9 (unlabelled category 2 and unlabelled category 3)."), JSON.stringify(blank));
    assert.ok(out.lines.includes("Unlabelled category 2 | 9"));
    assert.ok(out.lines.includes("Unlabelled category 3 | 9"));
  }
});

// ---- Statistics, ties, names, trends and times: each test pins one sentence that was untrue or misleading ----

const withExtras = (input, extras) => ({ ...input, ...extras });
const FIVE = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const levelBars = (values, labels = label(values.length)) => chart(band(null, labels), [bar("Level", values)]);

test("a median is kept inside the range, as the average is", () => {
  assert.ok(describe(levelBars([100.6, 100.62, 100.64, 100.66, 100.68])).lines.includes("• Median value: 100.64."));
  assert.ok(describe(levelBars([-100.68, -100.66, -100.64, -100.62, -100.6])).lines.includes("• Median value: -100.64."));
  assert.ok(describe(levelBars([10, 20, 30, 40, 50])).lines.includes("• Median value: 30."));
});

test("a standard deviation of varying data is not spoken as 0, and a flat series still says 0", () => {
  assert.ok(describe(levelBars([0.001, 0.002, 0.003, 0.004, 0.005])).lines.includes("• Standard deviation: 0.001."));
  assert.ok(describe(levelBars([0.1, 0.1, 0.1, 0.1, 0.1])).lines.includes("• Standard deviation: 0."));
  assert.ok(describe(levelBars([10, 20, 30, 40, 50])).lines.includes("• Standard deviation: 14.1."));
});

test("a mean that is float noise around zero is zero, never a percentage and never -0", () => {
  assert.equal(
    describe(chart(band(null, ["A", "B", "C"]), [bar("Delta", [0.1, 0.2, -0.3])])).short,
    'A bar chart showing "Delta" for three categories. Values range from -0.3 to 0.2 with an average of 0.'
  );
  assert.equal(
    describe(chart(band(null, ["A", "B", "C"]), [bar("Delta", [0.7, 0.2, -0.9])])).short,
    'A bar chart showing "Delta" for three categories. Values range from -0.9 to 0.7 with an average of 0.'
  );
  assert.ok(describe(chart(band(null, ["A", "B", "C"]), [bar("Delta", [0.5, 0.6, 0.7])])).short.includes("average of 0.6"));
});

test("averages that differ at the thirteenth figure are not the same average", () => {
  const near = chart(band(null, ["A", "B"]), [
    bar("North", [1000000000000.5, 1000000000000.5]),
    bar("South", [1000000000000.4, 1000000000000.4]),
  ]);
  assert.equal(describe(near).short, 'A bar chart for two categories. The "North" series shows the highest overall values.');
  // A computed 0.1 + 0.2 is the double 0.30000000000000004, whose written digits are not 0.3, so it reads as higher than a typed 0.3.
  const noise = chart(band(null, ["A", "B", "C"]), [bar("North", [0.1 + 0.2, 0.3, 0.3]), bar("South", [0.3, 0.3, 0.3])]);
  assert.equal(describe(noise).short, 'A bar chart for three categories. The "North" series shows the highest overall values.');
  const typed = chart(band(null, ["A", "B", "C"]), [bar("North", [0.3, 0.3, 0.3]), bar("South", [0.3, 0.3, 0.3])]);
  assert.equal(describe(typed).short, "A bar chart for three categories. The series have the same average.");
});

test("a series with no values is refused, not described as undefined", () => {
  assert.throws(() => describe(chart(band(null, ["A", "B"]), [bar("Level", [])])), /no values/);
});

test("a tie that runs past the labels counts only the labelled categories", () => {
  // The figures cover the drawn values, so the positions past the labels are no longer part of a tie.
  const out = describe(chart(band(null, ["A", "B"]), [bar("Level", [9, 1, 9, 9, 9])]));
  assert.ok(out.lines.includes('• Highest value: 9 ("A").'));
  assert.ok(describe(levelBars([9, 9, 9, 9, 1])).lines.includes("• Highest value: 9 (four of the categories)."));
});

test("a blank title, axis title or series name is not quoted as an empty name", () => {
  const blank = withExtras(chart(band(" ", ["A", "B"]), [bar(" ", [1, 2])]), {
    title: "​",
    yAxis: { kind: "range", title: " ", min: null, max: null },
  });
  const out = describe(blank);
  assert.equal(out.short, "A bar chart for two categories. Values range from 1 to 2 with an average of 1.5.");
  assert.ok(out.lines.includes("Categories are plotted on the x-axis."));
  assert.ok(out.lines.includes("Data table"));
  assert.ok(out.lines.includes("Category | Value"));
  const two = describe(chart(band(null, ["A", "B"]), [bar("North", [1, 2]), line(" ", [2, 1])]));
  assert.ok(two.lines.includes("• The line series falls."));
  assert.ok(two.lines.includes("Category | North | Line series"));
  const ordinary = describe(chart(band(null, ["A", "B"]), [bar("North", [1, 2])]));
  assert.ok(ordinary.lines.includes("Category | North"));
  // One blank test for labels as well: Hangul filler (U+3164) is invisible and is not white space or a format character.
  assert.ok(describe(chart(band(null, ["A", String.fromCharCode(0x3164)]), [bar("Level", [1, 2])])).lines.includes("Unlabelled category 2 | 2"));
});

test("two series whose names differ only at the edges are told apart", () => {
  const out = describe(chart(band(null, ["A", "B", "C"]), [bar("Total", [1, 2, 3]), bar("Total ", [3, 2, 9])]));
  assert.equal(out.short, 'A bar chart for three categories. The second "Total " series shows the highest overall values.');
});

test("same-name series of different kinds are told apart by kind, and numbered within the kind", () => {
  const out = describe(chart(band(null, ["A", "B", "C"]), [bar("Total", [1, 2, 3]), line("Total", [3, 2, 9])]));
  assert.equal(
    out.short,
    'A combined chart with one bar series and one line series over three shared categories. The "Total" line series shows the highest overall values.'
  );
  const three = describe(chart(band(null, ["A", "B", "C"]), [bar("Total", [1, 2, 3]), line("Total", [3, 2, 9]), line("Total", [2, 2, 2])]));
  assert.ok(three.lines.includes('• Every value in the second "Total" line series is 2.'));
});

test("an average strictly inside the range is not spoken as an end of it", () => {
  assert.equal(
    describe(chart(band(null, ["A", "B"]), [bar("Level", [100, 101])])).short,
    'A bar chart showing "Level" for two categories. Values range from 100 to 101 with an average of 100.5.'
  );
  assert.ok(describe(chart(band(null, ["A", "B"]), [bar("Level", [99.4, 101.2])])).short.includes("average of 100."));
});

test("a non-zero minimum is never '100% below'", () => {
  const four = (values) => describe(chart(band(null, ["A", "B", "C", "D"]), [bar("Level", values)])).lines;
  assert.ok(four([1, 1000, 1000, 1000]).includes('• The lowest value, 1 at "A", is more than 99% below the average.'));
  assert.ok(four([0, 1000, 1000, 1000]).includes('• The lowest value, 0 at "A", is 100% below the average.'));
  assert.ok(four([20, 100, 100, 100]).includes('• The lowest value, 20 at "A", is 75% below the average.'));
});

test("no 'above the average' claim where the signs cancel", () => {
  const profit = describe(chart(band(null, FIVE), [bar("Profit", [-100, 100, 1, 2, 3])]));
  assert.equal(profit.short, 'A bar chart showing "Profit" for five days. Values range from -100 to 100 with an average of 1.2.');
  const sound = describe(chart(band(null, FIVE), [bar("Profit", [-1, 10, 11, 12, 100])]));
  assert.ok(sound.lines.includes('• The highest value, 100 at "Fri", is 279% above the average.'));
});

test("a series that starts below zero gives its start and end, not a percentage", () => {
  const down = describe(chart(band(null, FIVE), [line("Delta", [-10, -8, -12, -9, -1])]));
  assert.ok(down.lines.includes("• Overall, the values go from -10 at the start to -1 at the end."));
  const up = describe(chart(band(null, FIVE), [line("Delta", [10, 12, 14, 11, 19])]));
  assert.ok(up.lines.includes("• Overall increase of 90.0% from start to end."));
});

test("a series that crashes at the end is not a consistent rise", () => {
  const crash = describe(chart(band(null, label(5)), [line("S", [1, 54, 64, 91, 11])]));
  assert.ok(!crash.short.includes("consistently"));
  assert.ok(!crash.lines.some((text) => text.includes("consistently")));
  const steady = describe(chart(band(null, label(5)), [line("S", [10, 20, 30, 40, 50])]));
  assert.equal(steady.short, 'A line chart showing "S" over five categories. The "S" series shows a consistently increasing trend, ranging from 10 to 50.');
  const start = describe(chart(band(null, label(5)), [line("S", [99, 25, 47, 70, 100])]));
  assert.ok(!start.short.includes("consistently"));
});

test("a rise with no step against it is not said to fluctuate", () => {
  const stairs = describe(chart(band(null, label(8)), [line("Price", [1, 1, 2, 2, 3, 3, 4, 4])]));
  assert.ok(stairs.lines.some((text) => text.includes("generally increasing")));
  assert.ok(!stairs.lines.some((text) => text.includes("fluctuat")));
  const steps = describe(chart(band(null, label(8)), [line("Stock", [9, 9, 8, 8, 7, 7, 6, 6])]));
  assert.ok(steps.lines.some((text) => text.includes("generally decreasing")));
  assert.ok(!steps.lines.some((text) => text.includes("fluctuat")));
  const zigzag = describe(chart(band(null, label(8)), [line("Price", [1, 3, 2, 5, 4, 7, 6, 9])]));
  assert.ok(zigzag.lines.some((text) => text.includes("with fluctuations")));
});

test("a flat series with one huge spike is not called stable", () => {
  const spike = describe(chart(band(null, label(10)), [line("Load", [1, 1, 1, 1, 1, 1, 1, 1, 1000, 1])]));
  assert.ok(spike.lines.some((text) => text.includes("mostly level, apart from a large spike")));
  assert.ok(!spike.lines.some((text) => text.includes("stable")));
  const dip = describe(chart(band(null, label(10)), [line("Load", [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1, 1000])]));
  assert.ok(dip.lines.some((text) => text.includes("mostly level, apart from a large dip")));
  const wobble = describe(chart(band(null, label(12)), [line("Load", [0, 0, 0, 0, 0, 0, 0, 0, 0, 10, 4.9, 4.9])]));
  assert.ok(wobble.lines.includes('• The "Load" series is mostly level, apart from a raised stretch.'));
});

test("the trend is said once when the takeaway already says it", () => {
  const fall = describe(chart(band(null, FIVE), [line("Load", [9, 9, 9, 9, 5])]));
  assert.equal(fall.short, 'A line chart showing "Load" over five days. The "Load" series is mostly level, apart from a large fall, with values between 5 and 9.');
  assert.equal(fall.lines.filter((text) => text.includes("apart from a large fall")).length, 1);
  const peak = describe(chart(band(null, label(10)), [line("Score", [10, 9, 8, 7, 6, 5, 4, 3, 2, 1000])]));
  assert.ok(peak.lines.some((text) => text.includes("generally increasing trend, with fluctuations")));
});

test("times and ISO dates need digits that exist", () => {
  const noun = (labels) => describe(chart(band(null, labels), [bar("Level", [1, 2])])).short;
  assert.equal(noun(["99:99", "98:98"]), 'A bar chart showing "Level" for two categories. Values range from 1 to 2 with an average of 1.5.');
  assert.equal(noun(["2024-13-45", "2024-14-45"]), 'A bar chart showing "Level" for two categories. Values range from 1 to 2 with an average of 1.5.');
  assert.equal(noun(["09:30", "10:30"]), 'A bar chart showing "Level" for two times. Values range from 1 to 2 with an average of 1.5.');
  assert.equal(noun(["2024-01-15", "2024-01-16"]), 'A bar chart showing "Level" for two dates. Values range from 1 to 2 with an average of 1.5.');
});

// ---- The repeating-shape sentence, and the wide set of blank and edge characters ----

test("the repeating-shape sentence says what the data does, however small the swings", () => {
  const cycle = describe(chart(band(null, label(7)), [line("Score", [10, 30, 12, 32, 11, 31, 13])]));
  assert.ok(cycle.lines.includes("• The data rises and falls repeatedly, with three peaks and two troughs."));
  const wiggle = describe(chart(band(null, label(9)), [line("Level", [100, 100.1, 100, 100.1, 100, 100.1, 100, 100.1, 100])]));
  assert.ok(wiggle.lines.includes("• The data rises and falls repeatedly, with four peaks and three troughs."));
  assert.ok(![cycle, wiggle].some((out) => out.lines.some((text) => text.includes("cyclic"))));
});

test("blank set: a category or series name of characters that draw as nothing reads as unlabelled", () => {
  for (const blank of ["\u3164", "\u2800", "\uFE0F", "\u034F", "\u115F\u1160", "\uFFA0"]) {
    const cat = describe(chart(band(null, ["A", blank, "C"]), [bar("S", [1, 3, 2])]));
    assert.ok(cat.lines.includes("• Highest value: 3 (unlabelled category 2)."), JSON.stringify(blank));
    const named = describe(chart(band(null, ["A", "B"]), [bar(blank, [1, 3]), bar("Real", [2, 1])]));
    assert.ok(named.lines.includes("• Highest value in the first bar series: 3 (\"B\")."), JSON.stringify(blank));
  }
});

test("repeat key: edge characters outside plain format characters still count as edges", () => {
  const EDGE_CHARACTERS = ["\u034F", "\u115F", "\u1160", "\u2800", "\u3164", "\uFE0F", "\uFFA0"];
  for (const edge of EDGE_CHARACTERS) {
    const out = describe(AUTUMN(`Autumn${edge}`));
    assert.ok(out.lines.some((text) => text.includes("(position 2)")), `U+${edge.codePointAt(0).toString(16)} at the end repeats the label`);
  }
  const front = describe(AUTUMN("\u2800Autumn"));
  assert.ok(front.lines.some((text) => text.includes("(position 2)")), "a Braille blank at the front repeats the label");
  const control = describe(AUTUMN("Autumn!"));
  assert.ok(!control.lines.some((text) => text.includes("(position 2)")), "a visible character is a different label");
});


// ---- Numbers at their edges, the spike and dip words, the invisible set ----


test("average: a mean the decimals cannot hold is spoken inside the range, never as zero or as 0.12", () => {
  const pair = describe(chart(band(null, ["A", "B"]), [bar("S", [0.123456789012345, 0.123456789012346])]));
  assert.ok(pair.lines.includes("• Average value: 0.1234567890123455."));
  const tiny = describe(chart(band(null, ["A", "B"]), [bar("S", [1e-15, 2e-15])]));
  assert.ok(tiny.lines.includes("• Average value: 0.0000000000000015."));
  const five = describe(chart(band(null, label(5)), [bar("S", [1e-9, 1.0000001e-9, 1.0000002e-9, 1.0000003e-9, 1.0000004e-9])]));
  assert.ok(five.lines.includes("• Average value: 0.0000000010000002."));
  // Just on the other side: ordinary means keep the banded text, and an all-equal series keeps its whole number.
  assert.ok(describe(chart(band(null, ["A", "B"]), [bar("S", [100, 101])])).lines.includes("• Average value: 100.5."));
  assert.ok(describe(chart(band(null, ["A", "B"]), [bar("S", [100.6, 100.8])])).lines.includes("• Average value: 100.7."));
  assert.ok(describe(chart(band(null, label(5)), [bar("S", Array(5).fill(0.1 + 0.2))])).lines.includes("• Average value: 0.30000000000000004."));
});

test("noise floor: a real mean is not erased on large integers, and 0.1 + 0.2 - 0.3 still reads zero", () => {
  const real = describe(chart(band(null, ["A", "B"]), [bar("S", [10000000000000, -9999999999999])]));
  assert.ok(real.lines.includes("• Average value: 0.5."));
  const two = describe(chart(band(null, ["A", "B"]), [bar("North", [10000000000000, -9999999999999]), bar("South", [0, 0])]));
  assert.equal(two.short, 'A bar chart for two categories. The "North" series shows the highest overall values.');
  assert.ok(describe(chart(band(null, label(3)), [bar("S", [0.1, 0.2, -0.3])])).lines.includes("• Average value: 0."));
});

test("same average: means that differ are not called the same, float noise still is", () => {
  const apart = describe(chart(band(null, ["x", "y"]), [bar("North", [1e15, 1e15]), bar("South", [1e15 + 4, 1e15 + 4])]));
  assert.equal(apart.short, 'A bar chart for two categories. The "South" series shows the highest overall values.');
  const near = describe(chart(band(null, ["x", "y"]), [bar("North", [1e13, 1e13]), bar("South", [1e13 + 0.05, 1e13 + 0.05])]));
  assert.equal(near.short, 'A bar chart for two categories. The "South" series shows the highest overall values.');
  // A computed 0.1 + 0.2 is written 0.30000000000000004, so the South series reads as higher than a typed 0.3.
  const noise = describe(chart(band(null, ["x", "y"]), [bar("North", [0.3, 0.3]), bar("South", [0.1 + 0.2, 0.1 + 0.2])]));
  assert.equal(noise.short, 'A bar chart for two categories. The "South" series shows the highest overall values.');
  const typed = describe(chart(band(null, ["x", "y"]), [bar("North", [0.3, 0.3]), bar("South", [0.3, 0.3])]));
  assert.equal(typed.short, "A bar chart for two categories. The series have the same average.");
});

test("spread: data that varies never has a spread spoken as zero, however small", () => {
  const tiny = describe(chart(band(null, label(5)), [bar("S", [0, 1e-16, 0, 1e-16, 0])]));
  assert.ok(tiny.lines.includes("• Standard deviation: less than 0.000000000000001."));
  assert.ok(describe(chart(band(null, label(5)), [bar("S", [0, 1e-9, 0, 1e-9, 0])])).lines.some((text) => text === "• Standard deviation: 0.0000000005."));
  assert.ok(describe(chart(band(null, label(3)), [bar("S", [5, 5, 5])])).lines.every((text) => !text.includes("Standard deviation")));
});

test("spike and dip: said only when a few points in one stretch stand apart from a level series", () => {
  const level = (before, at, after, value, odd) => Array.from({ length: before + at + after }, (_, i) => (i >= before && i < before + at ? odd : value));
  const sentence = (values) => describe(chart(band(null, label(values.length)), [line("S", values)])).lines.find((text) => text.includes("mostly level"));
  // The ends are the outliers: the level is NOT the spike (or the dip). They read as points, never as "a large spike" (a
  // stretch is a run of values, and each of these is one value).
  assert.equal(sentence([10, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 10]), '• The "S" series is mostly level, apart from raised points.');
  assert.equal(sentence([1, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 1]), '• The "S" series is mostly level, apart from lowered points, with values between 1 and 10.');
  // Two spikes are not "a large spike".
  assert.equal(sentence([0, 0, 0, 0, 5, 0, 0, 0, 0, 0, 5, 0, 0, 0, 0, 0]), '• The "S" series is mostly level, apart from raised points.');
  // Two runs of values are stretches, however many points each holds.
  assert.equal(sentence([0, 0, 0, 0, 5, 5, 0, 0, 0, 0, 0, 5, 5, 0, 0, 0, 0, 0, 0, 0]), '• The "S" series is mostly level, apart from raised stretches.');
  // One spike, one dip and a two-point spike keep their words.
  assert.equal(sentence(level(6, 1, 9, 0, 5)), '• The "S" series is mostly level, apart from a large spike.');
  assert.ok(sentence(level(6, 1, 9, 5, 0)).includes("apart from a large dip"));
  assert.equal(sentence(level(6, 2, 8, 0, 5)), '• The "S" series is mostly level, apart from a large spike.');
});

test("trend twice: no 'rises and falls repeatedly' beside 'consistently increasing'", () => {
  const up = describe(chart(band(null, label(11)), [line("S", [10, 30, 20, 40, 30, 50, 60, 70, 80, 90, 100])]));
  assert.ok(up.lines.includes('• The "S" series shows a consistently increasing trend, ranging from 10 to 100.'));
  assert.ok(!up.lines.some((text) => text.includes("rises and falls repeatedly")));
  const down = describe(chart(band(null, label(11)), [line("S", [100, 90, 95, 80, 85, 70, 60, 50, 40, 30, 10])]));
  assert.ok(down.lines.some((text) => text.includes("consistently decreasing")));
  assert.ok(!down.lines.some((text) => text.includes("rises and falls repeatedly")));
  const cycle = describe(chart(band(null, label(7)), [line("Score", [10, 30, 12, 32, 11, 31, 13])]));
  assert.ok(cycle.lines.includes("• The data rises and falls repeatedly, with three peaks and two troughs."));
});

test("mixed signs: no percentage above an average that the negative values have pulled down", () => {
  for (const values of [[-50, 100, 0, 0, 0], [-50, 100, 20, 20, 20]]) {
    const out = describe(chart(band(null, label(5)), [bar("S", values)]));
    assert.ok(!out.short.includes("above the average"), JSON.stringify(values));
    assert.ok(out.short.startsWith('A bar chart showing "S" for five categories. Values range from -50 to 100 with an average of'), JSON.stringify(values));
  }
  const sound = describe(chart(band(null, label(5)), [bar("Profit", [-1, 10, 11, 12, 100])]));
  assert.ok(sound.lines.includes('• The highest value, 100 at "L5", is 279% above the average.'));
});

test("invisible set: Khmer vowels, Mongolian selectors and plane-14 selectors read as no name", () => {
  for (const blank of ["឴", "឵", "᠋", "᠍", "\u{E0100}", "\u{E01EF}", "⁥"]) {
    const where = `U+${blank.codePointAt(0).toString(16).toUpperCase()}`;
    const cat = describe(chart(band(null, ["A", blank, "C"]), [bar("S", [1, 5, 2])]));
    assert.ok(cat.lines.includes("• Highest value: 5 (unlabelled category 2)."), where);
    const named = describe(chart(band(null, ["A", "B"]), [bar(blank, [1, 3]), bar("Real", [2, 1])]));
    assert.ok(named.lines.some((text) => text.includes("a bar series and a second bar series named")), where);
    const titled = describe({ ...chart(band(null, ["A", "B"]), [bar("S", [1, 3])]), title: blank });
    assert.ok(!titled.short.includes("titled"), where);
  }
  // The C0 and C1 controls draw in Chromium (bar U+001D and U+007F) and so does U+180F: they stay names and are NOT in the class.
  for (const drawn of ["\u0001", "\u0085", "᠏"]) {
    const out = describe(chart(band(null, ["A", drawn, "C"]), [bar("S", [1, 5, 2])]));
    assert.ok(out.lines.includes(`• Highest value: 5 ("${drawn}").`), `U+${drawn.codePointAt(0).toString(16).toUpperCase()} is quoted, not unlabelled`);
  }
  // Visible characters are still names, and a repeat key trims the same set at the edges.
  assert.ok(describe(chart(band(null, ["A", "·", "C"]), [bar("S", [1, 5, 2])])).lines.includes('• Highest value: 5 ("·").'));
  assert.ok(describe(AUTUMN("Autumn឴")).lines.some((text) => text.includes("(position 2)")));
});


// ---- Numbers are spoken and tabled in digits ----


test("digits: a number JavaScript writes with an exponent is spoken and tabled in digits", () => {
  const small = describe(chart(band(null, label(3)), [bar("S", [1e-7, 2e-7, 3e-7])]));
  assert.ok(small.short.includes("Values range from 0.0000001 to 0.0000003 with an average of 0.0000002."));
  assert.ok(small.lines.includes("Category | S"));
  assert.ok(small.lines.includes("L1 | 0.0000001"));
  const huge = describe(chart(band(null, label(2)), [bar("S", [1e21, 2e21])]));
  assert.ok(huge.lines.some((text) => text.includes("1000000000000000000000")));
  for (const out of [small, huge]) assert.ok(!out.lines.some((text) => /\d[eE][-+]?\d/.test(text)), "no exponent form is spoken");
  // Just on the other side: a plain number is untouched.
  assert.ok(describe(chart(band(null, label(3)), [bar("S", [0.000001, 2, 3])])).lines.includes("L1 | 0.000001"));
});

test("digits: an average past 1e21 that must be restored from its rounded form is written in digits, not with an exponent", () => {
  // Library-level data: Mermaid's grammar rejects exponents, but the library accepts any finite number.
  // The mean of 1e21 and 1e21 + 262144 is 1.0000000000000001e21. Rounded to 15 figures it is 1e21, which is the lowest value,
  // so the average is restored from more figures, and `toFixed` would write that in exponent form from 1e21.
  const out = describe(chart(band(null, label(2)), [bar("S", [1e21, 1e21 + 262144])]));
  assert.ok(out.short.includes("with an average of 1000000000000000100000."));
  assert.ok(out.lines.includes("• Average value: 1000000000000000100000."));
  assert.ok(!out.lines.some((text) => /\d[eE][-+]?\d/.test(text)), "no exponent form is spoken");
});


// ---- A blank series name reads as a missing one ----


test("series order: a blank series name is numbered within its kind, like a missing one, and a lone series has no number", () => {
  const three = describe(chart(band(null, label(4)), [bar("Alpha", [1, 2, 3, 4]), line("Beta", [1, 2, 3, 4]), line(" ", [2, 2, 3, 3])]));
  assert.ok(three.lines.some((text) => text.includes("a line series named \"Beta\", and a second line series.")));
  assert.ok(three.lines.includes("• The second line series shows a generally increasing trend."));
  assert.ok(three.lines.includes("Category | Alpha | Beta | Line series 2"));
  const lone = describe(chart(band(null, label(6)), [line(" ", [1, 2, 3, 4, 5, 6])]));
  assert.ok(lone.lines.includes("• The line series shows a consistently increasing trend, ranging from 1 to 6."));
});


// ---- Means, ranges and the figures spoken for them ----

const repeatValue = (value, count) => Array.from({ length: count }, () => value);

test("a real whole-number mean is never erased by the float bound, whatever the count", () => {
  const hundred = describe(chart(band(null, label(100)), [bar("S", [...repeatValue(1e14, 49).flatMap((v) => [v, -v]), 60, 90])]));
  assert.ok(hundred.lines.includes("• Average value: 1.5."));
  const ten = describe(chart(band(null, label(10)), [bar("S", [1e13, -1e13, 0.1, 0, 0, 0, 0, 0, 0, 0])]));
  assert.ok(ten.lines.includes("• Average value: 0.01."));
  // Just on the other side: decimal noise at any count still reads zero.
  assert.ok(describe(chart(band(null, label(3)), [bar("S", [0.1, 0.2, -0.3])])).lines.includes("• Average value: 0."));
  assert.ok(describe(chart(band(null, label(60)), [bar("S", repeatValue(0.1, 20).concat(repeatValue(0.2, 20), repeatValue(-0.3, 20)))])).lines.includes("• Average value: 0."));
});

test("means that differ are not the same average at a large count or scale", () => {
  const apart = describe(chart(band(null, label(8)), [line("A", [1e15, -1e15, 1e15, -1e15, 1e15, -1e15, 2, 4]), bar("B", repeatValue(0, 8))]));
  assert.equal(apart.short, 'A combined chart with one bar series and one line series over eight shared categories. The "A" series shows the highest overall values.');
  const hundred = describe(chart(band(null, label(100)), [line("A", repeatValue(1e12, 100)), bar("B", [...repeatValue(1e12, 99), 1e12 + 1])]));
  assert.ok(hundred.short.endsWith('The "B" series shows the highest overall values.'));
  // Just on the other side: identical series, and means that differ only by decimal noise, are still the same average.
  const same = describe(chart(band(null, label(100)), [line("A", repeatValue(0.1, 100)), bar("B", repeatValue(0.1, 100))]));
  assert.ok(same.short.endsWith("The series have the same average."));
  // The same pair as above, read from the digits a computed 0.1 + 0.2 is written with: the South series is higher.
  const noise = describe(chart(band(null, ["x", "y"]), [bar("North", [0.3, 0.3]), bar("South", [0.1 + 0.2, 0.1 + 0.2])]));
  assert.ok(noise.short.endsWith('The "South" series shows the highest overall values.'));
});

test("an average that equals an end in doubles is spoken in full, not as a rounded figure outside the range", () => {
  const out = describe(chart(band(null, ["A", "B"]), [bar("S", [0.12345678901234567, 0.12345678901234568])]));
  assert.ok(out.lines.includes("• Values range from 0.12345678901234566 to 0.12345678901234568 with an average of 0.12345678901234566."));
  assert.ok(out.lines.includes("• Average value: 0.12345678901234566."));
  // Just on the other side: an all-equal series keeps its banded text, and a range with room keeps its banded average.
  assert.ok(describe(chart(band(null, label(5)), [bar("S", Array(5).fill(0.1 + 0.2))])).lines.includes("• Average value: 0.30000000000000004."));
  assert.ok(describe(chart(band(null, ["A", "B"]), [bar("S", [100.6, 100.8])])).lines.includes("• Average value: 100.7."));
});

test("the spread of huge or tiny values is a number, not Infinity and not zero", () => {
  const huge = describe(chart(band(null, label(6)), [bar("S", [1e155, 2e155, 3e155, 4e155, 5e155, 6e155])]));
  const hugeSpread = huge.lines.find((text) => text.startsWith("• Standard deviation: "));
  assert.match(hugeSpread, /^• Standard deviation: 170782512765993\d{141}\.$/);
  const tiny = describe(chart(band(null, label(6)), [bar("S", [1e-200, 2e-200, 3e-200, 4e-200, 5e-200, 6e-200])]));
  assert.ok(tiny.lines.includes("• Standard deviation: less than 0.000000000000001."));
  // Just on the other side: an ordinary spread, and a series with no spread, are as before.
  assert.ok(describe(chart(band(null, label(5)), [bar("S", [2, 4, 6, 8, 10])])).lines.includes("• Standard deviation: 2.83."));
  assert.ok(describe(chart(band(null, label(5)), [bar("S", [5, 5, 5, 5, 5])])).lines.includes("• Standard deviation: 0."));
});

test("a level series with a large range that no single spike or dip explains is not called stable", () => {
  const twoSpikes = describe(chart(band(null, label(20)), [line("S", [1, 1, 1, 9, 1, 1, 1, 1, 1, 1, 1, 1, 1, 9, 1, 1, 1, 1, 1, 1])]));
  assert.ok(twoSpikes.lines.includes('• The "S" series is mostly level, apart from raised points.'));
  const plateau = describe(chart(band(null, label(12)), [line("S", [1, 1, 1, 1, 9, 9, 9, 9, 1, 1, 1, 1])]));
  assert.ok(plateau.lines.includes('• The "S" series is mostly level, apart from a raised stretch.'));
  const mesa = describe(chart(band(null, label(12)), [line("S", [1, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 1])]));
  assert.ok(mesa.short.includes("is mostly level, apart from lowered points"));
  // Just on the other side: one spike in one short stretch keeps its sentence, and a small range stays stable.
  const spike = describe(chart(band(null, label(12)), [line("S", [1, 1, 1, 1, 1, 9, 1, 1, 1, 1, 1, 1])]));
  assert.ok(spike.lines.includes('• The "S" series is mostly level, apart from a large spike.'));
  const wobble = describe(chart(band(null, label(8)), [line("S", [100, 100, 101, 100, 100, 100, 100, 100])]));
  assert.ok(wobble.lines.includes('• The "S" series is stable, with values between 100 and 101.'));
});

test("a climb with one step against its direction of more than a quarter of the range is not consistent", () => {
  const zigzag = describe(chart(band(null, label(13)), [line("S", [0, 10, 20, 100, 30, 40, 100, 50, 60, 70, 80, 90, 100])]));
  assert.ok(!zigzag.lines.some((text) => text.includes("consistently")));
  assert.ok(zigzag.lines.includes('• The "S" series shows a generally increasing trend, with fluctuations.'));
  // The peaks bullet names L13 as a position of the highest value; the end point is not in the count, so the sentence says so.
  assert.ok(zigzag.lines.includes("• The data rises and falls repeatedly, with two peaks and two troughs, and it ends at its highest value."));
  // The gate is a single step: the staircase with one rise of two thirds of the range, and a fall of 30 on a range of 80, are no longer consistent.
  const drop = describe(chart(band(null, label(10)), [line("Score", [10, 9, 8, 7, 6, 5, 4, 3, 9, 1])]));
  assert.ok(drop.lines.includes('• The "Score" series shows a generally decreasing trend, with fluctuations.'));
  assert.ok(!drop.short.includes("consistently"));
  const dip = describe(chart(band(null, label(5)), [line("Visitors", [100, 120, 90, 150, 170])]));
  assert.ok(dip.short.includes("is generally increasing with fluctuations, with values between 90 and 170"));
  // Just on the other side: a small step against the direction (under a quarter of the range) stays consistent.
  const small = describe(chart(band(null, label(5)), [line("Visitors", [100, 110, 105, 130, 170])]));
  assert.ok(small.short.includes("consistently increasing"));
});

test("a huge whole-number statistic is spoken to 15 figures, not padded with rounding noise", () => {
  assert.ok(describe(chart(band(null, ["A", "B"]), [bar("S", [1e22, 5e22])])).lines.includes("• Average value: 30000000000000000000000."));
  assert.ok(describe(chart(band(null, label(3)), [bar("S", [1e22, 2e22, 2e22])])).lines.includes("• Average value: 16666666666666700000000."));
  // Just on the other side: below 1e21 a whole number keeps every digit it has.
  assert.ok(describe(chart(band(null, ["A", "B"]), [bar("S", [9007199254740992, 9007199254740992])])).lines.includes("• Average value: 9007199254740992."));
});

test("a mean that is not zero is never spoken as 0 when the range holds zero", () => {
  const out = describe(chart(band(null, label(3)), [bar("S", [-0.00000015, 0.00000025, 0.00000009])]));
  assert.ok(out.lines.includes("• Average value: 0.000000063."));
  assert.ok(describe(chart(band(null, label(3)), [bar("S", [-1, 1, 0.013])])).lines.includes("• Average value: 0.0043."));
  // Just on the other side: a true zero stays zero.
  assert.ok(describe(chart(band(null, label(4)), [bar("S", [-5, 5, -2, 2])])).lines.includes("• Average value: 0."));
});

test("two ends that read as the same figure add decimals until they differ", () => {
  const out = describe(chart(band(null, ["A", "B"]), [bar("S", [1, 1.000000000000001])]));
  assert.equal(out.short, 'A bar chart showing "S" for two categories. Values range from 1 to 1.000000000000001 with an average of 1.0000000000000004.');
  // Just on the other side: ends that differ at the shown figure are untouched.
  assert.ok(describe(chart(band(null, ["A", "B"]), [bar("S", [2.7857142857, 4.8])])).short.includes("from about 2.79 to 4.8"));
});


// ---- A value past the last x-axis label is in the code and not in the picture ----

const UNDRAWN_NOTE = "written in the code, not drawn in the picture";

test("undrawn values: figures cover the drawn values, and one sentence names the rest with the disclosure", () => {
  const out = describe(chart(band(null, ["A", "B", "C"]), [bar("", [4, 9, 6, 12, 2])]));
  // The short tier says the picture leaves values out, because its figures cover the drawn ones only.
  assert.equal(out.short, "A bar chart for three categories. Two further values are written in the code and not drawn. Values range from 4 to 9 with an average of 6.33.");
  assert.ok(out.lines.includes(`• The bar series also holds two values past the last label: 12 and 2 (${UNDRAWN_NOTE}).`));
  assert.ok(out.lines.includes('• Highest value: 9 ("B").'));
  assert.ok(out.lines.includes("• Average value: 6.33."));
  // The table keeps every value the author wrote, and each undrawn cell carries the disclosure.
  assert.ok(out.lines.includes(`Position 4 | 12 (${UNDRAWN_NOTE})`));
  assert.ok(out.lines.includes(`Position 5 | 2 (${UNDRAWN_NOTE})`));
  assert.ok(out.lines.includes("A | 4"));
});

test("undrawn values: a tie past the labels is no longer a position; the values are named once, with the disclosure", () => {
  const out = describe(chart(band(null, ["A", "B"]), [bar("Level", [9, 1, 9, 9, 9])]));
  assert.ok(out.lines.includes('• Highest value: 9 ("A").'));
  assert.ok(out.lines.includes(`• The "Level" series also holds three values past the last label: 9, 9 and 9 (${UNDRAWN_NOTE}).`));
  assert.ok(!out.lines.some((text) => text.includes("positions past the labels")));
});

test("undrawn values: two series, one longer, keep the mismatch sentence on the full counts, and the short tier discloses the rest", () => {
  const out = describe(chart(band(null, ["A", "B", "C"]), [bar("North", [1, 2, 3, 4]), bar("South", [3, 2, 1])]));
  assert.ok(out.lines.includes('• The chart\'s series have different numbers of values: the "North" series has four and the "South" series has three.'));
  // The short tier says a value is left out, beside the sentence that counts the code's values.
  assert.ok(out.short.includes("One further value is written in the code and not drawn. The chart's series have different numbers of values."));
  assert.ok(out.lines.includes(`• The "North" series also holds one value past the last label: 4 (${UNDRAWN_NOTE}).`));
  assert.ok(out.lines.includes('• Highest value in the "North" series: 3 ("C").'));
  assert.ok(out.lines.includes(`Position 4 | 4 (${UNDRAWN_NOTE}) | no value`));
});

test("undrawn values: the trend is read on the drawn values", () => {
  const rises = describe(chart(band(null, ["A", "B", "C"]), [line("", [1, 2, 3, 9, 1, 1])]));
  assert.ok(rises.short.includes("The line series rises, ranging from 1 to 3."));
  assert.ok(rises.lines.includes(`• The line series also holds three values past the last label: 9, 1 and 1 (${UNDRAWN_NOTE}).`));
  // Just on the other side: a series with no value past the labels says nothing of the kind, and a shortfall is as before.
  const matched = describe(chart(band(null, ["A", "B", "C"]), [bar("", [4, 9, 6])]));
  assert.ok(!matched.lines.some((text) => text.includes(UNDRAWN_NOTE)));
  const shortfall = describe(chart(band(null, ["A", "B", "C"]), [bar("", [4, 9])]));
  assert.ok(!shortfall.lines.some((text) => text.includes(UNDRAWN_NOTE)));
});

// ---- One repeat key for series names, and the marks Chromium draws are names ----

// The 37 members of the invisible set that leave ink when drawn alone, by range.
const DRAWN_MARK_RANGES = [[0x600, 0x605], [0x6dd, 0x6dd], [0x70f, 0x70f], [0x890, 0x891], [0x8e2, 0x8e2], [0x1680, 0x1680], [0xfff9, 0xfffb], [0x110bd, 0x110bd], [0x110cd, 0x110cd], [0x13430, 0x1343f], [0x1bca0, 0x1bca3]];
const DRAWN_MARKS_ALL = DRAWN_MARK_RANGES.flatMap(([from, to]) => Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i)));

test("drawn marks: a category made of one of the 37 drawn marks is a name; the members that only advance stay blank", () => {
  assert.equal(DRAWN_MARKS_ALL.length, 37);
  const highest = (mark) => describe(chart(band(null, ["A", mark, "C"]), [bar("S", [1, 5, 2])])).lines.filter((text) => text.startsWith("• Highest value"));
  for (const mark of DRAWN_MARKS_ALL) {
    assert.deepEqual(highest(mark), [`• Highest value: 5 ("${mark}").`], "U+" + mark.codePointAt(0).toString(16));
  }
  // Just on the other side: members that draw nothing (they only advance, or are not drawn at all) still read as no name.
  for (const blank of ["\u200B", "\u034F", "\u17B4", "\u2800", "\uFEFF", "\u00AD"]) {
    assert.deepEqual(highest(blank), ["• Highest value: 5 (unlabelled category 2)."], "U+" + blank.codePointAt(0).toString(16));
  }
});

test("repeat key: series names that look and sound the same carry their position, and different names do not", () => {
  const numbered = (first, second) => {
    const text = describe(chart(band(null, ["x", "y"]), [bar(first, [1, 2]), line(second, [2, 1])])).lines.join("\n");
    return text.includes("(series 1)") && text.includes("(series 2)");
  };
  assert.ok(numbered("Caf\u00E9", "Cafe\u0301"), "NFC against NFD");
  assert.ok(numbered("North", "No\u200Brth"), "an interior zero-width space");
  assert.ok(numbered("North", "No\uFEFFrth"), "an interior U+FEFF");
  assert.ok(numbered("New York", "New\u00A0York"), "a no-break space against a space");
  assert.ok(numbered("North", "North\u200B"), "an edge zero-width space (as before)");
  // Just on the other side: case, a lookalike letter and a missing space are still different names.
  assert.ok(!numbered("North", "NORTH"));
  assert.ok(!numbered("North", "N\u043Erth"));
  assert.ok(!numbered("New York", "NewYork"));
});

test("a fall of more than a quarter of the range in the middle of a rise is not consistent (two negatives)", () => {
  const out = describe(chart(band(null, label(5)), [line("S", [-10, -8, -12, -9, -1])]));
  assert.ok(out.short.includes('The "S" series is generally increasing with fluctuations, with values between -12 and -1.'), out.short);
  assert.ok(!out.short.includes("consistently"));
});

test("an unclear trend is one phrase, fluctuates with no clear trend, with or without the range", () => {
  const wiggle = describe(chart(band(null, label(9)), [line("S", [100, 100.1, 100, 100.1, 100, 100.1, 100, 100.1, 100])]));
  assert.ok(wiggle.lines.some((text) => text.includes("fluctuates with no clear trend")), wiggle.lines.join(" | "));
  assert.ok(!wiggle.lines.some((text) => text.includes("is fluctuating")));
  assert.ok(!wiggle.short.includes("is fluctuating"));
});

// ---- Means, trends, ranges and repeated names ----

test("whole numbers: a real mean is never swallowed while the compensated sum is exact", () => {
  const average = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).short;
  // Whole numbers a double holds exactly: the true means are 0.25, 0.5, 1 and 1/3, and none reads as 0.
  assert.ok(average([3000000000000001, -3000000000000000, 0, 0]).includes("with an average of 0.25."));
  assert.ok(average([1e16, 1, 1, -1e16]).includes("with an average of 0.5."));
  assert.ok(average([-4503599627370495, 4503599627370498, -4503599627370499, 4503599627370500]).includes("with an average of 1."));
  assert.ok(average([1e16, -1e16, 1]).includes("with an average of 0.33."));
  // Just on the other side: float noise on typed decimals is still 0, a mean below the documented bound is still 0, and a true 0 is 0.
  assert.ok(average([0.1, 0.2, -0.3]).includes("with an average of 0."));
  assert.ok(average([1, -1, 1e-16]).includes("with an average of 0."));
  assert.ok(average([4.98e222, 1.47e199, -4.98e222, -1.47e199]).includes("with an average of 0."));
});

test("whole numbers: two series whose exact means differ are not the same average", () => {
  const two = (a, b) => describe(chart(band(null, label(a.length)), [bar("N", a), line("M", b)])).short;
  assert.ok(two([1e16, 1, 1], [1e16, 1, 4]).includes('The "M" series shows the highest overall values.'));
  assert.ok(two([4503599627370496, 4503599627370497, -4503599627370496, -4503599627370495], [4503599627370496, 4503599627370496, -4503599627370496, -4503599627370496]).includes('The "N" series shows the highest overall values.'));
  // Two identical series are still the same average, huge or not.
  assert.ok(two([4503599627370496, 4503599627370497], [4503599627370496, 4503599627370497]).includes("The series have the same average."));
  assert.ok(two([0.1, 0.2, 0.3], [0.1, 0.2, 0.3]).includes("The series have the same average."));
});

test("mostly level: points that stand apart both ways say so, and too many points apart is no clear trend", () => {
  const trend = (values) => describe(chart(band(null, label(values.length)), [line("S", values)])).lines.find((text) => text.includes("mostly level") || text.includes("no clear trend"));
  // Four raised points and three lowered: the sentence used to name only the lowered stretch.
  assert.equal(trend([5, 5, 10, 10, 10, 10, 5, 5, 0, 0, 0, 5, 5, 5, 5, 5]), '• The "S" series fluctuates with no clear trend.');
  // One raised point and one lowered point, level at the midpoint: both sides are named, and single points are points.
  assert.equal(trend([0, 5, 5, 5, 10, 5, 5, 5, 5, 5, 5, 5]), '• The "S" series is mostly level, apart from raised and lowered points.');
  // Runs on both sides stay stretches.
  assert.equal(trend([5, 5, 5, 10, 10, 5, 5, 5, 0, 0, 5, 5, 5, 5, 5, 5]), '• The "S" series is mostly level, apart from raised and lowered stretches.');
  // A run on one side and single points on the other: each side says its own.
  assert.equal(trend([5, 5, 5, 10, 10, 5, 5, 5, 0, 5, 5, 5, 5, 5, 5, 5]), '• The "S" series is mostly level, apart from a raised stretch and a lowered point.');
  assert.equal(trend([5, 5, 5, 10, 5, 5, 5, 0, 0, 5, 5, 5, 5, 5, 5, 5]), '• The "S" series is mostly level, apart from a raised point and a lowered stretch.');
  // A wide square wave holds 43% of its points off its level: not "apart from raised stretches".
  const wave = [];
  for (let block = 0; block < 7; block += 1) for (let i = 0; i < 5; i += 1) wave.push(block % 2 ? 10 : 0);
  assert.equal(trend(wave), '• The "S" series fluctuates with no clear trend.');
  // Just on the other side: 35% (seven of twenty) and one side only keep their sentence.
  assert.equal(trend([2, 2, 2, 6, 6, 6, 6, 2, 2, 2, 2, 2, 2, 6, 6, 6, 2, 2, 2, 2]), '• The "S" series is mostly level, apart from raised stretches.');
  assert.equal(trend([1, 1, 1, 1, 9, 9, 9, 9, 1, 1, 1, 1]), '• The "S" series is mostly level, apart from a raised stretch.');
});

test("range ends: two ends rounded to the step that lie closer than the step are written to the decimals that show it",() => {
  const range = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).short;
  assert.ok(range([1.0049999, 1.0050001]).includes("Values range from 1.0049999 to 1.0050001 "));
  assert.ok(range([9.9949999, 9.9950001]).includes("Values range from 9.9949999 to 9.9950001 "));
  // The boundary: ends a full step or more apart keep their rounding.
  assert.ok(range([1, 1.0050001]).includes("from 1 to about 1.01"));
  assert.ok(range([1.0049999, 1.0150001]).includes("from about 1 to about 1.02"));
});

test("range ends: a rounded end is not left beside a longer end it would round to", () => {
  const range = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).short;
  assert.ok(range([1.0049999, 1.005]).includes("Values range from 1.0049999 to 1.005 "));
  // Just on the other side: ends that differ at the figure shown keep their rounding.
  assert.ok(range([2.7857142857, 4.8]).includes("from about 2.79 to 4.8"));
  assert.ok(range([0.00001, 0.00002]).includes("from 0.00001 to 0.00002"));
  assert.ok(range([1.004999, 1.005]).includes("from 1.004999 to 1.005"));
  // A whole-number end beside a float-noise end is not the same case: 0 and 0.30000000000000004 keep "about 0.3".
  const noisy = describe(chart(band(null, label(7)), [line("S", [0, 0.1, 0.2, 0.3, 0.225, 0.3, 0.30000000000000004])]));
  assert.ok(noisy.short.includes("ranging from 0 to about 0.3."), noisy.short);
});

test("repeat: one key for series names and category labels", () => {
  const headers = (names) => describe(chart(band(null, label(3)), [bar(names[0], [1, 2, 3]), line(names[1], [3, 2, 1])])).lines.find((text) => text.startsWith("Category"));
  // A thin space, an em space, a tab and a doubled space all sound like one space: a repeat.
  for (const space of [" ", " ", "\t", "  ", " "]) {
    const row = headers(["New York", `New${space}York`]);
    assert.ok(row.includes("(series 1)") && row.includes("(series 2)"), JSON.stringify(row));
  }
  // No space at all, a different case and a different pictograph sequence are different names.
  for (const pair of [["New York", "NewYork"], ["North", "NORTH"], ["\u{1F468}‍\u{1F469}‍\u{1F467}", "\u{1F468}\u{1F469}\u{1F467}"]]) {
    assert.ok(!headers(pair).includes("(series"), JSON.stringify(pair));
  }
  // The flags of England and Scotland are tag characters after a black flag: different names. A stray joiner at an edge is junk.
  const england = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
  const scotland = "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
  assert.ok(!headers([england, scotland]).includes("(series"));
  assert.ok(headers(["North", "North‍"]).includes("(series 1)"));
  // A letter and its accent, composed or not, and a ZWJ between a letter and an accent, are one name (the join is not a pictograph's).
  assert.ok(headers(["Café", "Cafe‍́"]).includes("(series 1)"));
  // The same key serves category labels.
  const labels = describe(chart(band(null, ["Spring", "Late Autumn", "Late Autumn"]), [bar("Level", [1, 9, 2])]));
  assert.ok(labels.lines.includes("Late Autumn (position 2) | 9"));
});

test("repeat: the Ogham space mark draws as ink, so a name ending in it is not a repeat of the same name without it", () => {
  const ogham = String.fromCodePoint(0x1680);
  const row = describe(chart(band(null, label(3)), [bar("A", [1, 2, 3]), line(`A${ogham}`, [3, 2, 1])])).lines.find((text) => text.startsWith("Category"));
  assert.equal(row, `Category | A | A${ogham}`);
});

test("a finite series whose compensated sum would overflow has a finite mean; a value that is not finite keeps today's reading", () => {
  const average = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).lines.find((text) => text.startsWith("• Average value:"));
  // Every finite series is added exactly, so 1.7e308 + 1.7e308 + 0.5 does not overflow (a compensated sum read Infinity).
  assert.match(average([1.7e308, 1.7e308, 0.5]), /^• Average value: 113333333333333(0{294})\.$/);
  // An Infinity or a NaN is outside the stated input and describe() turns it into null, so it is handed to the library directly: it keeps the
  // compensated sum and the noise bound exactly as before (an Infinity reads as an average of 0, a NaN as NaN).
  const direct = (values) => lib.render.renderText(lib.charts.buildXychartModel(chart(band(null, label(values.length)), [bar("S", values)]))).detailed;
  assert.ok(direct([1, Infinity, 3]).includes("• Average value: 0."));
  assert.ok(direct([1, NaN, 3]).includes("• Average value: NaN."));
});

// A series of whole numbers is added as big integers; its average and its comparisons are exact.

test("whole-number series whose exact means differ by one in the last figure are not the same average", () => {
  const two = (a, b) => describe(chart(band(null, label(a.length)), [bar("N", a), line("M", b)])).lines.join(" | ");
  assert.ok(two([1e16, 1], [1e16, 0]).includes('The "N" series shows the highest overall values.'));
  assert.ok(two([8000000000000001, 8e15, 8e15], [8e15, 8e15, 8e15]).includes('The "N" series shows the highest overall values.'));
  // The boundaries that must not move.
  assert.ok(two([1, 2, 3], [3, 2, 1]).includes("The series have the same average."));
  assert.ok(two([1e16, 1, 1, -1e16], [1e16, 1, 1, -1e16]).includes("The series have the same average."));
  assert.ok(two([1e16, 1e16], [1e16, 1e16]).includes("The series have the same average."));
});

test("a whole series against a series with a decimal is compared exactly (mean 1 against mean 1.2 are not the same)", () => {
  const out = describe(chart(band(null, label(3)), [bar("N", [1e16, 3, -1e16]), line("M", [1.5, 1.5, 0.6])])).lines.join(" | ");
  assert.ok(out.includes('The "M" series shows the highest overall values.'), out);
});

test("a whole-number average is the exact one, however large the values and however much cancels", () => {
  const average = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).lines.find((text) => text.startsWith("• Average value:"));
  // The exact mean is 1e200 / 3: 200 digits, spoken to the 15 figures a derived whole number keeps.
  assert.match(average([1e300, 1e200, -1e300]), /^• Average value: 333333333333333(0{185})\.$/);
  assert.equal(average([1e16, 1, 1, -1e16]), "• Average value: 0.5.");
});

// Every finite value is added exactly from the digits it is written with, so a decimal beside a huge whole number is compared and
// averaged exactly. A series with no decimal places is the whole-number case above.

test("a decimal beside a huge whole number is compared exactly, past 16 digits, with no cap", () => {
  const two = (a, b) => describe(chart(band(null, label(a.length)), [bar("N", a), line("M", b)])).lines.join(" | ");
  // The exact means are 5000000000000000.25 and 5000000000000000.125: 18 digits in the sums.
  assert.ok(two([1e16, 0.5], [1e16, 0.25]).includes('The "N" series shows the highest overall values.'));
  assert.ok(two([2e16, 0.5], [2e16, 0.25]).includes('The "N" series shows the highest overall values.'));
  assert.ok(two([1e16, 0.25], [1e16, 0.5]).includes('The "M" series shows the highest overall values.'));
  // The boundaries that must not move.
  assert.ok(two([1e16, 0.5], [1e16, 0.5]).includes("The series have the same average."));
  assert.ok(two([0.1, 0.2], [0.2, 0.1]).includes("The series have the same average."));
});

test("a mean is the exact one from the written digits, however a value is written", () => {
  const average = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).lines.find((text) => text.startsWith("• Average value:"));
  assert.equal(average([0.1, 0.2, -0.3]), "• Average value: 0.");
  // The exact mean is 0.5 (it was read as 0 before).
  assert.equal(average([1e16, 1, 1, -1e16, 0.5]), "• Average value: 0.5.");
  // Exponent form: 1e-7 and 3e-7 average 2e-7, which the number rules give as 0.0000002.
  assert.equal(average([1e-7, 3e-7]), "• Average value: 0.0000002.");
  // The documented noise bound of rounds 5 and 6 is gone for finite input: a real mean of 1 / 3 x 1e-16 is spoken, not swallowed.
  assert.match(average([1, -1, 1e-16]), /^• Average value: 0\.000000000000000033/);
});

// A printed mean whose exact value is a decimal tie rounds half away from zero, read from the exact sum and never from the double: 0.545 is
// stored a hair above its tie and reads 0.55, 0.075 and 1.005 are stored a hair below theirs and read 0.08 and 1.01, as hand arithmetic does.

const average = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).lines.find((text) => text.startsWith("• Average value:"));
const EIGHT_VALUES = [-0.3, 0.5, 1, -0.5, 0.8, -0.4, -1, 0.5]; // exact mean 0.075
const NINE_VALUES = [96.63, -90.74, 55.22, 47.64, 30.34, 56.08, -92.73, 97.85, 2.66]; // exact mean 22.55

test("tie: an exact decimal tie in a mean rounds half away from zero, whichever side of the tie its double lies", () => {
  // 0.545: the double is a hair above the tie.
  assert.equal(average([6.63, -5.54]), "• Average value: 0.55.");
  assert.equal(average([-6.63, 5.54]), "• Average value: -0.55.");
  // 0.075: the double is a hair below the tie.
  assert.equal(average(EIGHT_VALUES), "• Average value: 0.08.");
  assert.equal(average(EIGHT_VALUES.map((value) => -value)), "• Average value: -0.08.");
  // 22.55 reads to one decimal from 10 up; the double is a hair above the tie.
  assert.equal(average(NINE_VALUES), "• Average value: 22.6.");
  assert.equal(average(NINE_VALUES.map((value) => -value)), "• Average value: -22.6.");
  // 1.005: the double is a hair below the tie.
  assert.equal(average([2.01, 0]), "• Average value: 1.01.");
  assert.equal(average([-2.01, 0]), "• Average value: -1.01.");
  // The short tier says the same figure.
  assert.ok(describe(chart(band(null, label(2)), [bar("S", [0.95, 1.06])])).short.includes("Values range from 0.95 to 1.06 with an average of 1.01."));
});

test("tie: a mean a hair either side of a tie reads as its own digits", () => {
  assert.equal(average([6.629, -5.54]), "• Average value: 0.54."); // 0.5445
  assert.equal(average([6.631, -5.54]), "• Average value: 0.55."); // 0.5455
  assert.equal(average([...EIGHT_VALUES.slice(0, 7), 0.49]), "• Average value: 0.07."); // 0.07375
  assert.equal(average([...EIGHT_VALUES.slice(0, 7), 0.51]), "• Average value: 0.08."); // 0.07625
  assert.equal(average([4.62, 0]), "• Average value: 2.31.");
});

test("tie: the rule holds where the sentence changes its precision and where decimals are restored", () => {
  // 9.995 reads to two decimals (below 10) and the tie goes up to 10, which lies inside the range 9.9 to 10.09.
  assert.equal(average([9.9, 10.09]), "• Average value: 10.");
  // 99.95 reads to one decimal (below 100) and the tie goes up to 100; 100.5 reads to none and goes up to 101.
  assert.equal(average([99, 100.9]), "• Average value: 100.");
  assert.equal(average([99, 102]), "• Average value: 101.");
  // A mean at the end of its range is written with more decimals until it lies inside, and those decimals round the same way: 0.00015.
  assert.equal(average([0.0003, 0]), "• Average value: 0.0002.");
  assert.equal(average([-0.0003, 0]), "• Average value: -0.0002.");
  // 0.000125 is not a tie at four decimals (it is 1.25 of them), so it rounds down.
  assert.equal(average([0.00025, 0]), "• Average value: 0.0001.");
});

// The same rule at the other places a typed value is rounded for print: an end of the range in the short tier, and the median (a typed value
// or the mean of the two in the middle).

test("tie: a range end typed to a tie reads half away from zero in the short tier", () => {
  const short = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).short;
  // 0.00165 is stored a hair below its tie and reads to two figures as 0.0017.
  assert.ok(short([0.00165, 0.00185]).includes("Values range from about 0.0017 to about 0.0019 with an average of 0.0018."));
  assert.ok(short([-0.00165, -0.00185]).includes("Values range from about -0.0019 to about -0.0017 with an average of -0.0018."));
  // Either side of the tie reads as its own digits.
  assert.ok(short([0.00164, 0.00175]).includes("Values range from about 0.0016 to about 0.0018"));
  // (0.00166 beside 0.00176, a whole step apart: beside 0.00175 the pair is narrower than its step and is read in full.)
  assert.ok(short([0.00166, 0.00176]).includes("Values range from about 0.0017 to about 0.0018"));
});

// An end the short tier writes in full is the typed value, so "about" stays only on an end whose printed digits differ from the typed ones.

test("range ends: an end written in full is the typed value and is not about, whether or not the ends first rounded alike", () => {
  const short = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).short;
  // Both ends round to the same 14 decimals, so they are widened to the full 15, and both are exactly what was typed.
  assert.ok(short([0.123456789012345, 0.123456789012346]).includes("Values range from 0.123456789012345 to 0.123456789012346 with an average of 0.1234567890123455."));
  // Both ends round alike at two decimals and are written in full to six.
  assert.ok(short([0.333331, 0.333334]).includes("Values range from 0.333331 to 0.333334 with an average of 0.333333."));
  // One end is written in full and the other is still rounded: only the rounded one is "about".
  assert.ok(short([0.12345, 0.123456]).includes("Values range from 0.12345 to about 0.12346 with an average of 0.123453."));
  // The same for negative values.
  assert.ok(short([-0.123456789012345, -0.123456789012346]).includes("Values range from -0.123456789012346 to -0.123456789012345 with an average of -0.1234567890123455."));
  assert.ok(short([-0.12345, -0.123456]).includes("Values range from about -0.12346 to -0.12345 with an average of -0.123453."));
});

test("range ends: an end whose printed digits differ from the typed value is still about", () => {
  const short = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).short;
  assert.ok(short([0.00165, 0.00185]).includes("Values range from about 0.0017 to about 0.0019 with an average of 0.0018."));
  assert.ok(short([2.7857142857, 4.8]).includes("Values range from about 2.79 to 4.8 with an average of 3.79."));
  // Two ends that lie closer than the rounding step are written in full, and read as typed.
  assert.ok(short([1.0049999, 1.0050001]).includes("Values range from 1.0049999 to 1.0050001 with an average of 1.005."));
  // An end typed to seven decimals is rounded to 1.005, which is not what was typed, so it stays about.
  assert.ok(short([1, 1.0049999]).includes("Values range from 1 to about 1.005 with an average of 1.002."));
});

test("tie: a median that is a typed tie, or the mean of the two in the middle, reads half away from zero", () => {
  const median = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).lines.find((text) => text.startsWith("• Median value:"));
  // The middle value 0.015 is typed; the middle pair -0.71 and -0.82 averages -0.765.
  assert.equal(median([0, 0.01, 0.015, 8, 9]), "• Median value: 0.02.");
  assert.equal(median([0, -0.01, -0.015, -8, -9]), "• Median value: -0.02.");
  assert.equal(median([0.29, 1.02, -0.85, -0.82, -1.62, -0.71, 1.97, -1.24]), "• Median value: -0.77.");
  // Either side of the tie.
  assert.equal(median([0, 0.01, 0.0149, 8, 9]), "• Median value: 0.01.");
  assert.equal(median([0, 0.01, 0.0151, 8, 9]), "• Median value: 0.02.");
});

// U+001D and U+007F draw nothing in Chromium, so they read as no name, no category and no title; U+0001 stays a name

test("a category, series name or title of only U+001D or U+007F reads as none, and U+0001 is still a name", () => {
  for (const blank of ["\u001D", "\u007F"]) {
    const where = JSON.stringify(blank);
    const cat = describe(chart(band(null, ["A", blank, "C"]), [bar("S", [1, 5, 2])]));
    assert.ok(cat.lines.includes("• Highest value: 5 (unlabelled category 2)."), where);
    const titled = describe({ ...chart(band(null, ["A", "B"]), [bar("S", [1, 3])]), title: blank });
    assert.ok(!titled.short.includes("titled"), where);
  }
  const named = describe(chart(band(null, ["A", "\u0001", "C"]), [bar("S", [1, 5, 2])]));
  assert.ok(named.lines.includes('• Highest value: 5 ("\u0001").'));
});

// An even-count median whose double sum overflows is the mean of the exact middle pair.
test("median: the mean of a middle pair that overflows in doubles is the exact pair's mean", () => {
  const median = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).lines.find((text) => text.startsWith("• Median value:"));
  const huge = "17" + "0".repeat(307); // 1.7e308 written in digits
  assert.equal(median([1, 2, 1.7e308, 1.7e308, 1.7e308, 1.7e308]), `• Median value: ${huge}.`);
  assert.equal(median([-1.7e308, -1.7e308, -1.7e308, -1.7e308, 1, 2]), `• Median value: -${huge}.`);
  // A pair whose two values differ: the exact mean of 1.7e308 and 1.79e308 is 1.745e308.
  assert.equal(median([1, 2, 1.7e308, 1.79e308, 1.79e308, 1.79e308]), `• Median value: 1745${"0".repeat(305)}.`);
  // Must not move: an odd count, a pair whose sum fits, and every finite median.
  assert.equal(median([1, 2, 1.7e308, 1.7e308, 1.7e308]), `• Median value: ${huge}.`);
  assert.equal(median([1, 2, 8e307, 8e307, 8e307, 8e307]), `• Median value: 8${"0".repeat(307)}.`);
  assert.equal(median([1, 2, 3, 4, 5, 6]), "• Median value: 3.5.");
});

// A mean below the smallest normal double is spoken from its exact digits, not through a double.
test("average: a mean below the smallest normal double is spoken from its exact digits", () => {
  const average = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).lines.find((text) => text.startsWith("• Average value:"));
  // The exact mean of 5e-324 and 0 is 2.5e-324. As a double it is 5e-324 (twice the mean), and two figures typed back through Number()
  // gave 5e-324 again, so the old text read 0.000...005.
  assert.equal(average([5e-324, 0]), `• Average value: 0.${"0".repeat(323)}25.`);
  assert.equal(average([-5e-324, 0]), `• Average value: -0.${"0".repeat(323)}25.`);
  // Must not move: a mean whose two figures survive the double (1e-310 has 13 figures of precision), and a mean in the normal range.
  assert.equal(average([1e-310, 0]), `• Average value: 0.${"0".repeat(310)}5.`);
  assert.equal(average([2.5e-308, 0]), `• Average value: 0.${"0".repeat(307)}1.`);
  assert.equal(average([1e-300, 0]), `• Average value: 0.${"0".repeat(300)}5.`);
});

// A typed value of more than four decimals and under 0.1 keeps two significant figures after "about".
test("short tier: a typed value under 0.1 is spoken to two significant figures, never to two decimals", () => {
  const short = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).short;
  // Two decimals read 0.0050001 as "about 0.01", twice its size, and 0.0068816 as "about 0.01".
  assert.ok(short([0.0030001, 0.0050001]).includes("Values range from about 0.003 to about 0.005 with an average of 0.004."));
  assert.ok(short([0.0037034, 0.0068816]).includes("Values range from about 0.0037 to about 0.0069 with an average of 0.0053."));
  assert.ok(short([0.0000001, 0.0050001]).includes("The highest value, about 0.005 at"));
  assert.ok(short([0.0050001, 1, 1, 1]).includes("The lowest value, about 0.005 at"));
  assert.ok(short([0.0612345, 0.0712345]).includes("Values range from about 0.061 to about 0.071 with an average of 0.066."));
  assert.ok(short([-0.0050001, -0.0030001]).includes("Values range from about -0.005 to about -0.003 with an average of -0.004."));
  // A value that rounds up to 0.1 is spoken as 0.1.
  assert.ok(short([0.09999999, 0.2]).includes("Values range from about 0.1 to 0.2 with an average of 0.15."));
  // Must not move: a value at or above 0.1 (two decimals), a value of four decimals or fewer (0.0099 stays as typed; the other end is
  // a seven-decimal value under 0.1 and does move), and a pair read in full.
  assert.ok(short([0.12345, 0.2]).includes("Values range from about 0.12 to 0.2 with an average of 0.16."));
  assert.ok(short([0.100001, 0.2]).includes("Values range from about 0.1 to 0.2 with an average of 0.15."));
  assert.ok(short([0.0099, 0.0123456]).includes("Values range from 0.0099 to about 0.0123 with an average of 0.0111."));
  assert.ok(short([0.0049999, 0.0050001]).includes("Values range from 0.0049999 to 0.0050001 with an average of 0.005."));
});

// Two "about" ends closer together than one unit of the level they were widened to are written to more decimals.
test("short tier: two ends narrower than the level they are written at go on to more decimals", () => {
  const short = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).short;
  // Each pair is 1e-5 to 6e-5 wide and used to read as a range one unit of the third to fifth decimal wide ("about 1 to about 1.001").
  assert.ok(short([1.00049, 1.00051]).includes("Values range from 1.00049 to 1.00051 with an average of 1.0005."));
  assert.ok(short([18.00004, 18.00005]).includes("Values range from 18.00004 to 18.00005 with an average of 18.000045."));
  assert.ok(short([1.00004, 1.00005]).includes("Values range from 1.00004 to 1.00005 with an average of 1.000045."));
  assert.ok(short([3.999999, 4.000005]).includes("Values range from 3.999999 to 4.000005 with an average of 4."));
  assert.ok(short([0.90003, 0.90006]).includes("Values range from 0.90003 to 0.90006 with an average of 0.90005."));
  // Must not move: a pair read in full already, a pair a whole step wide at the level it stops at, and an end that is not "about".
  assert.ok(short([1.0049999, 1.0050001]).includes("Values range from 1.0049999 to 1.0050001 with an average of 1.005."));
  assert.ok(short([1.0004, 1.0016]).includes("Values range from 1.0004 to 1.0016 with an average of 1.001."));
  assert.ok(short([1, 1.0049999]).includes("Values range from 1 to about 1.005 with an average of 1.002."));
});

// A rounded end sheds its trailing zeros, so one rounded end reads one way ("about 4", never "about 4.00").
test("short tier: a rounded end sheds its trailing zeros", () => {
  const short = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).short;
  // The same rounded end read "about 4.00" in one chart and "about 4" in the other.
  assert.ok(short([4.00004, 4.0001]).includes("Values range from about 4 to 4.0001 with an average of 4.00007."));
  assert.ok(short([1.00049, 1.001]).includes("Values range from about 1 to 1.001 with an average of 1.0007."));
  assert.ok(short([1.5000001, 3]).includes("Values range from about 1.5 to 3 with an average of 2.25."));
  assert.ok(short([1.1000001, 3]).includes("Values range from about 1.1 to 3 with an average of 2.05."));
  assert.ok(short([1, 1, 2.000001]).includes("The highest value, about 2 at"));
  // The rounded-to-the-step test reads the value, not the text, so a pair narrower than its rounding step still reads in full.
  assert.ok(short([1.0049999, 1.0050001]).includes("Values range from 1.0049999 to 1.0050001 "));
  // Must not move: a rounded end that keeps two decimals.
  assert.ok(short([1.5700001, 3]).includes("Values range from about 1.57 to 3 with an average of 2.29."));
});

// The two-significant-figure end says "about" only where its figures differ from the typed digits.
test("short tier: a small end whose two figures are the typed digits is not about", () => {
  const short = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).short;
  // Typed to five decimals or more, and two figures are all it has: nothing was rounded.
  assert.ok(short([0.00001, 0.00002]).includes("Values range from 0.00001 to 0.00002 with an average of 0.000015."));
  assert.ok(short([0.00012, 0.00015]).includes("Values range from 0.00012 to 0.00015 with an average of 0.00014."));
  assert.ok(short([-0.00001, -0.00002]).includes("Values range from -0.00002 to -0.00001 with an average of -0.000015."));
  assert.ok(short([0.00000005, 0.00000005, 0.00000025]).includes("The highest value, 0.00000025 at"));
  assert.ok(short([0.00001, 1, 1, 1]).includes("The lowest value, 0.00001 at"));
  // Must not move: a longer typed value is still rounded to two figures and is still about, and so is a three-figure one.
  assert.ok(short([0.000012345, 0.00002]).includes("Values range from about 0.000012 to 0.00002 with an average of 0.000016."));
  assert.ok(short([0.000125, 0.00015]).includes("Values range from about 0.00013 to 0.00015 with an average of 0.00014."));
  assert.ok(short([0.00001, 0.0000123456]).includes("Values range from 0.00001 to about 0.000012 with an average of 0.000011."));
});

// "N% above the average" and "Overall change of N.N%" are the exact figure rounded half away from zero.
test("percentage: a figure that is an exact tie rounds half away from zero, whichever side of it the double lies", () => {
  const takeaway = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).lines.find((text) => /% (above|below) the average/.test(text));
  const overall = (values) => describe(chart(band(null, label(values.length)), [line("S", values)])).lines.find((text) => text.startsWith("• Overall"));
  // 1.9 over a mean of 0.8 is 237.5% of it, so 137.5% above: the double ratio read 137.49999999999997 and Math.round said 137.
  assert.equal(takeaway([1.9, -0.3]), '• The highest value, 1.9 at "L1", is 138% above the average.');
  assert.equal(takeaway([7, -6.5, 10.7, 4.8]), '• The highest value, 10.7 at "L3", is 168% above the average.');
  assert.equal(takeaway([30.2, 6.6, 3.2]), '• The highest value, 30.2 at "L1", is 127% above the average.');
  // The overall change is 1681.25% of the start, and toFixed(1) read it down to 1681.2.
  assert.equal(overall([1.6, 5.1, 7, 4.5, 28.5]), "• Overall increase of 1681.3% from start to end.");
  assert.equal(overall([1.6, 5.6, 28, 0.5, 29.9]), "• Overall increase of 1768.8% from start to end.");
  // Must not move: a whole figure, a figure that is not a tie, the "more than 99" form, a tie the double already rounds up, and a plain change.
  assert.equal(takeaway([10, 1, 1]), '• The highest value, 10 at "L1", is 150% above the average.');
  assert.equal(takeaway([10, 2, 1]), '• The highest value, 10 at "L1", is 131% above the average.');
  assert.equal(takeaway([0.51, 2.745, 2.745]), '• The lowest value, 0.51 at "L1", is 75% below the average.');
  assert.equal(takeaway([0.001, 3, 3]), '• The lowest value, 0.001 at "L1", is more than 99% below the average.');
  assert.equal(overall([1, 2, 3, 4, 3, 2, 4]), "• Overall increase of 300.0% from start to end.");
  assert.equal(overall([10, 12, 15, 18, 20, 22, 25]), "• Overall increase of 150.0% from start to end.");
});

// The two mixed "mostly level" forms count what the series holds.
test("mostly level: a side with exactly one point or stretch is singular, the others plural", () => {
  const marked = (marks) => Array.from({ length: 40 }, (_, i) => (i in marks ? marks[i] : 5));
  const trend = (marks) => describe(chart(band(null, label(40)), [line("S", marked(marks))])).lines.find((text) => text.includes("mostly level"));
  const sentence = (words) => `• The "S" series is mostly level, apart from ${words}.`;
  const RAISED_POINT = { 8: 11 };
  const RAISED_POINTS = { 8: 11, 14: 11 };
  const RAISED_STRETCH = { 8: 11, 9: 11 };
  const RAISED_STRETCHES = { 8: 11, 9: 11, 14: 11, 15: 11 };
  const LOWERED_POINT = { 20: 0 };
  const LOWERED_POINTS = { 20: 0, 30: 0 };
  const LOWERED_STRETCH = { 20: 0, 21: 0 };
  const LOWERED_STRETCHES = { 20: 0, 21: 0, 30: 0, 31: 0 };
  // Points on the raised side, runs on the lowered side.
  assert.equal(trend({ ...RAISED_POINT, ...LOWERED_STRETCH }), sentence("a raised point and a lowered stretch"));
  assert.equal(trend({ ...RAISED_POINT, ...LOWERED_STRETCHES }), sentence("a raised point and lowered stretches"));
  assert.equal(trend({ ...RAISED_POINTS, ...LOWERED_STRETCH }), sentence("raised points and a lowered stretch"));
  assert.equal(trend({ ...RAISED_POINTS, ...LOWERED_STRETCHES }), sentence("raised points and lowered stretches"));
  // Runs on the raised side, points on the lowered side.
  assert.equal(trend({ ...RAISED_STRETCH, ...LOWERED_POINT }), sentence("a raised stretch and a lowered point"));
  assert.equal(trend({ ...RAISED_STRETCH, ...LOWERED_POINTS }), sentence("a raised stretch and lowered points"));
  assert.equal(trend({ ...RAISED_STRETCHES, ...LOWERED_POINT }), sentence("raised stretches and a lowered point"));
  assert.equal(trend({ ...RAISED_STRETCHES, ...LOWERED_POINTS }), sentence("raised stretches and lowered points"));
  // Must not move: the compact two-sided forms (the plural covers both sides) and the one-sided forms.
  assert.equal(trend({ ...RAISED_POINT, ...LOWERED_POINT }), sentence("raised and lowered points"));
  assert.equal(trend({ ...RAISED_STRETCH, ...LOWERED_STRETCH }), sentence("raised and lowered stretches"));
  assert.equal(trend({ ...RAISED_POINTS, ...LOWERED_POINTS }), sentence("raised and lowered points"));
  assert.equal(trend(RAISED_POINTS), sentence("raised points"));
});

// A mean the double cannot hold at two figures is spoken from its exact digits.
test("average: a mean too small for a double to hold is spoken from its exact digits, not as 0 or as the nearest double", () => {
  const average = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).lines.find((text) => text.startsWith("• Average value:"));
  // [5e-324, 0, 0] has the exact mean 1.67e-324, which is the double 0: it read "Average value: 0."
  assert.equal(average([5e-324, 0, 0]), `• Average value: 0.${"0".repeat(323)}17.`);
  // [5e-324, 1e-323] has the exact mean 7.5e-324, which is the double 1e-323: it read 1e-323.
  assert.equal(average([5e-324, 1e-323]), `• Average value: 0.${"0".repeat(323)}75.`);
  // Must not move: a mean in the subnormal range that still holds three figures keeps the fewest-figures reading.
  assert.equal(average([2.5e-308, 0]), `• Average value: 0.${"0".repeat(307)}1.`);
});

// Two ends under 0.1 are each written to two significant figures, and a pair closer together than one unit of
// the last of those figures is written to more decimals, as a pair at two decimals is.
test("short tier: two ends under 0.1 narrower than their two figures go on to more decimals", () => {
  const short = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).short;
  // 0.000227 wide: it read "about 0.06 to about 0.061", a range one thousandth wide.
  assert.ok(short([0.060306, 0.060533]).includes("Values range from about 0.0603 to about 0.0605 with an average of 0.0604."));
  // The same pair below zero.
  assert.ok(short([-0.060533, -0.060306]).includes("Values range from about -0.0605 to about -0.0603 with an average of -0.0604."));
  // Two ends whose last figures sit at different places (0.0001 and 0.001): the coarser place is the unit.
  assert.ok(short([0.0095123, 0.0101234]).includes("Values range from about 0.0095 to about 0.0101 with an average of 0.0098."));
  // Neither end sheds a zero: 0.0007 wide, it read "about 0.061 to about 0.062".
  assert.ok(short([0.061201, 0.061899]).includes("Values range from about 0.0612 to about 0.0619 with an average of 0.0616."));
  // Narrower than the step by one unit of the next place: both ends are the typed values. It read "about 0.0017 to about 0.0018".
  assert.ok(short([0.00166, 0.00175]).includes("Values range from 0.00166 to 0.00175 with an average of 0.00171."));
  // Exactly one step wide by its digits (the doubles' difference is a hair under): not narrower, so it keeps its two figures. As a bar chart its
  // average is the low end's figure (0.0017), so both ends then read as typed; a line chart has no average and shows the two figures.
  assert.ok(short([0.00165, 0.00175]).includes("Values range from 0.00165 to 0.00175 with an average of 0.0017."));
  assert.ok(describe(chart(band(null, label(2)), [line("S", [0.00165, 0.00175])])).short.includes("ranging from about 0.0017 to about 0.0018."));
  // Past the decimals that can be given back, both ends are read in full.
  assert.ok(short([0.00000000000000000603061, 0.00000000000000000605339]).includes("Values range from 0.00000000000000000603061 to 0.00000000000000000605339 with"));
  // Must not move: a pair a whole unit wide (its range, and not its average: 0.060856 read "0.061", the top end, and now reads "0.0609"),
  // and a pair the widening already reached.
  assert.ok(short([0.060306, 0.061406]).includes("Values range from about 0.06 to about 0.061 with an average of 0.0609."));
  assert.ok(short([0.0612345, 0.0712345]).includes("Values range from about 0.061 to about 0.071 with an average of 0.066."));
  assert.ok(short([0.0000603061, 0.0000605339]).includes("Values range from about 0.0000603 to about 0.0000605 with an average of 0.0000604."));
});

// A range with one end typed and the other rounded: the rounded end is written to at least as many decimals as the typed end, and
// never lands on the near side of it (a range read upside down, or wider than the data).
test("short tier: a rounded end beside a typed end has at least as many decimals and never reads upside down", () => {
  const short = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).short;
  // 0.0832 to 0.08349 read "from 0.0832 to about 0.083", a range that runs backwards.
  assert.ok(short([0.0832, 0.08349]).includes("Values range from 0.0832 to about 0.0835 with"));
  // The same pair below zero: it read "from about -0.083 to -0.0832".
  assert.ok(short([-0.08349, -0.0832]).includes("Values range from about -0.0835 to -0.0832 with"));
  // Above 0.1 the two-decimal rounding did the same: it read "from 0.1234 to about 0.12", "from 1.2345 to about 1.23" and "from about -1.23 to -1.2345".
  assert.ok(short([0.1234, 0.12348]).includes("Values range from 0.1234 to about 0.1235 with"));
  assert.ok(short([1.2345, 1.23499]).includes("Values range from 1.2345 to about 1.235 with"));
  assert.ok(short([-1.2345, -1.23499]).includes("Values range from about -1.235 to -1.2345 with"));
  // Not backwards, but wider than the data: it read "from 0.0603 to about 0.061", a range three times as wide as 0.0603 to 0.060533.
  assert.ok(short([0.0603, 0.060533]).includes("Values range from 0.0603 to about 0.0605 with an average of 0.0604."));
  assert.ok(short([0.2013, 0.202090354]).includes("Values range from 0.2013 to about 0.2021 with"));
  assert.ok(short([1234.5678, 1234.567891]).includes("Values range from 1234.5678 to about 1234.5679 with"));
  // Must not move: both ends typed, a rounded end that already has the figures of the typed end, and a typed end with fewer figures than the rounded end.
  assert.ok(short([0.0832, 0.0836]).includes("Values range from 0.0832 to 0.0836 with"));
  assert.ok(short([12.4, 12.449]).includes("Values range from 12.4 to 12.449 with"));
  assert.ok(short([3.2, 3.24999]).includes("Values range from 3.2 to about 3.25 with"));
  assert.ok(short([1000.1, 1000.12345]).includes("Values range from 1000.1 to about 1000.12 with"));
  assert.ok(short([0.5, 0.50049]).includes("Values range from 0.5 to about 0.5005 with"));
  assert.ok(short([0.0999, 0.10004]).includes("Values range from 0.0999 to about 0.1 with"));
  assert.ok(short([0.0612345, 0.0712345]).includes("Values range from about 0.061 to about 0.071 with"));
});

// "N% below the average" is the exact figure rounded half away from zero, as "N% above" is.
test("percentage: a below-the-average figure that is an exact tie rounds half away from zero, whichever side of it the double lies", () => {
  const takeaway = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).lines.find((text) => /% below the average/.test(text));
  // 2.97 under a mean of 6 is 50.5% below: the double ratio read 50.49999999999999 and Math.round said 50.
  assert.equal(takeaway([2.97, 6.07, 8.96]), '• The lowest value, 2.97 at "L1", is 51% below the average.');
  // 29.1 under a mean of 60 is 51.5% below.
  assert.equal(takeaway([29.1, 60.9, 90]), '• The lowest value, 29.1 at "L1", is 52% below the average.');
  // Must not move: a figure that is not a tie, and a tie the double already rounds up.
  assert.equal(takeaway([0.51, 2.745, 2.745]), '• The lowest value, 0.51 at "L1", is 75% below the average.');
  assert.equal(takeaway([20, 100, 100, 100]), '• The lowest value, 20 at "L1", is 75% below the average.');
});

// A mean just above the point where the double is too coarse for two figures is still spoken from its exact digits: written back through Number it moves.
test("average: a mean of three figures in the subnormal range keeps the digits it was written with", () => {
  const average = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).lines.find((text) => text.startsWith("• Average value:"));
  // The exact mean of 2.1e-322 and 2.2e-322 is 2.15e-322; Number("2.15e-322") is a double that writes back as 2.17e-322.
  assert.equal(average([2.1e-322, 2.2e-322]), `• Average value: 0.${"0".repeat(321)}215.`);
  // 6.25e-322 comes back as 6.27e-322.
  assert.equal(average([6.2e-322, 6.3e-322]), `• Average value: 0.${"0".repeat(321)}625.`);
  // Must not move: a mean far enough above the smallest doubles that the round trip keeps all three figures.
  assert.equal(average([6.2e-310, 6.3e-310]), `• Average value: 0.${"0".repeat(309)}625.`);
});

// An end exactly half a step from a figure: rounding half away from zero printed a step twice as wide as the data ("0.34 to about
// 0.340001" for 0.34 and 0.3400005), so the end is printed as typed.
test("short tier: an end half a step from a figure beside another end is printed as typed", () => {
  const short = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).short;
  assert.ok(short([0.34, 0.3400005]).includes("Values range from 0.34 to 0.3400005 with"));
  assert.ok(short([2, 2.000005]).includes("Values range from 2 to 2.000005 with"));
  assert.ok(short([0.0832, 0.08325]).includes("Values range from 0.0832 to 0.08325 with"));
  assert.ok(short([-0.34, -0.3400005]).includes("Values range from -0.3400005 to -0.34 with"));
  // Must not move: a tie in a range wider than half a step (1.5 steps wide, printed 2), an end not on a half step, one past it, and two
  // rounded ends the widening never reaches.
  assert.ok(short([0.0832, 0.08335]).includes("Values range from 0.0832 to about 0.0834 with"));
  assert.ok(short([0.34, 0.3400004]).includes("Values range from 0.34 to 0.3400004 with"));
  assert.ok(short([0.34, 0.3400006]).includes("Values range from 0.34 to about 0.340001 with"));
  assert.ok(short([0.2400005, 0.3500005]).includes("Values range from about 0.24 to about 0.35 with"));
});

// A two-figure end under 0.1 beside a two-decimal end from 0.1 up: each rounds to its own step, and 0.09659823 to 0.1040567267 read
// "about 0.097 to about 0.1", under half the width of the data.
test("short tier: two rounded ends across 0.1 that lie closer than the two-decimal step show how narrow the range is", () => {
  const short = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).short;
  assert.ok(short([0.09659823, 0.1040567267]).includes("Values range from about 0.097 to about 0.104 with"));
  assert.ok(short([-0.09659823, -0.1040567267]).includes("Values range from about -0.104 to about -0.097 with"));
  // Must not move: both ends under 0.1, a pair a whole step wide across 0.1, and an end typed in full.
  assert.ok(short([0.0612345, 0.0712345]).includes("Values range from about 0.061 to about 0.071 with"));
  assert.ok(short([0.0912345, 0.1112345]).includes("Values range from about 0.091 to about 0.11 with"));
  assert.ok(short([0.0999, 0.10004]).includes("Values range from 0.0999 to about 0.1 with"));
});

// An average spoken as the same figure as an end printed "about" sounds like the top or bottom of the range ("from 0.0994 to about 0.0995
// with an average of 0.0995", for a mean of 0.09945). Beside such an end the average is given the figures that put it inside the printed range.
test("short tier: an average is never spoken as the figure of an end printed about, when the mean is inside the printed range", () => {
  const short = (values, series = bar) => describe(chart(band(null, label(values.length)), [series("S", values)])).short;
  assert.ok(short([0.0994, 0.0995001]).includes("Values range from 0.0994 to about 0.0995 with an average of 0.09945."));
  assert.ok(short([0.0099, 0.01000049]).includes("Values range from 0.0099 to about 0.01 with an average of 0.00995."));
  assert.ok(short([-0.0995001, -0.0994]).includes("Values range from about -0.0995 to -0.0994 with an average of -0.09945."));
  assert.ok(short([1.994, 1.9950001]).includes("Values range from 1.994 to about 1.995 with an average of 1.9945."));
  assert.ok(short([0.0994, 0.0995, 0.0995001]).includes("Values range from 0.0994 to about 0.0995 with an average of 0.09947."));
  // A mean that is the end's own figure (the middle of 0.00165 and 0.00175 is 0.0017, and 0.00165 rounds up to it) cannot move, so the end is
  // printed as typed instead of "about 0.0017".
  assert.ok(short([0.00165, 0.00175]).includes("Values range from 0.00165 to 0.00175 with an average of 0.0017."));
  assert.ok(short([-0.00175, -0.00165]).includes("Values range from -0.00175 to -0.00165 with an average of -0.0017."));
  // Must not move: an average that is not that figure (0.00165 is the middle of three, and neither end is 0.0017), and ends both typed. The
  // detailed tier's ends are the typed values; its average takes the same floor as the short tier's where the magnitude rule misplaces it.
  assert.ok(short([0.00155, 0.00165, 0.00175]).includes("Values range from about 0.0016 to about 0.0018 with an average of 0.0017."));
  assert.ok(short([0.0994, 0.0996]).includes("Values range from 0.0994 to 0.0996 with an average of 0.0995."));
  assert.ok(short([0.0994, 0.0999501]).includes("Values range from 0.0994 to about 0.1 with an average of 0.0997."));
  assert.ok(short([0.00165, 0.00185]).includes("Values range from about 0.0017 to about 0.0019 with an average of 0.0018."));
  const detailed = describe(chart(band(null, label(2)), [bar("S", [0.0994, 0.0995001])])).lines;
  assert.ok(detailed.includes("• Values range from 0.0994 to 0.0995001 with an average of 0.0994501."));
  assert.ok(detailed.includes("• Average value: 0.0994501."));
});

// A typed end below 1e-15 beside a rounded end: the rounded end keeps the decimals its own two figures need, as it does above 1e-15. The
// rule stopped at 15 decimals, so the rounded end printed on 0 or on a multiple of 1e-15 ("from about -0 to 0.0000000000000002" for -3.71e-16 to 2e-16).
test("short tier: a rounded end beside a typed end below 1e-15 keeps the decimals its own figures need", () => {
  const short = (values, series = bar) => describe(chart(band(null, label(values.length)), [series("S", values)])).short;
  // It read "to about 0.000000000000001" (1.5 times the data's own high end) and "from about -0 to 0.0000000000000003".
  assert.ok(short([4e-16, 6.66e-16, 5e-16]).includes("Values range from 0.0000000000000004 to about 0.00000000000000067 with"));
  assert.ok(short([3e-16, -2.22e-16, 1e-16]).includes("Values range from about -0.00000000000000022 to 0.0000000000000003 with"));
  // It read "from about 0 to 0.000000000000000088" and "from about -0 to 0.0000000000000002 with an average of -0.000000000000000024", an average below the printed low end.
  assert.ok(short([7.34e-17, 8.8e-17]).includes("Values range from about 0.000000000000000073 to 0.000000000000000088 with"));
  assert.ok(short([1e-16, -3.71e-16, 2e-16]).includes("Values range from about -0.00000000000000037 to 0.0000000000000002 with an average of -0.000000000000000024."));
  // The same below zero, in a line chart, and at 15 decimals and past (the cap was 15 decimals, so 7.77e-15 needs 16).
  assert.ok(short([-5e-16, -7.77e-16, -6e-16]).includes("Values range from about -0.00000000000000078 to -0.0000000000000005 with"));
  assert.ok(short([5e-16, 6e-16, 7.77e-16], line).includes('The "S" series rises, ranging from 0.0000000000000005 to about 0.00000000000000078.'));
  assert.ok(short([5e-15, 7.77e-15, 6e-15]).includes("Values range from 0.000000000000005 to about 0.0000000000000078 with"));
  // Must not move: a pair that both ends already print right (two figures past 15 decimals), both ends typed, and a pair above 1e-13.
  assert.ok(short([1.2e-17, 3.4567e-17]).includes("Values range from 0.000000000000000012 to about 0.000000000000000035 with"));
  assert.ok(short([1e-16, 2e-16]).includes("Values range from 0.0000000000000001 to 0.0000000000000002 with"));
  assert.ok(short([5.5e-14, 7.7777e-14]).includes("Values range from 0.000000000000055 to about 0.000000000000078 with"));
});

// Two rounded ends either side of 0.1 or 0.01, with data about one rounding step wide: each end rounds inward (the step is 0.001 below 0.1
// and 0.01 above it), so "about 0.095 to about 0.1" printed 0.005 for 0.0101 of data. A printed range at most half the data's is written
// again at the finer of the two steps.
test("short tier: two rounded ends across a power of ten that print half the data's width are written at the finer step", () => {
  const short = (values, series = bar) => describe(chart(band(null, label(values.length)), [series("S", values)])).short;
  // 0.0101 wide, printed 0.005: it read "about 0.095 to about 0.1".
  assert.ok(short([0.09468, 0.0952, 0.10479]).includes("Values range from about 0.095 to about 0.105 with an average of 0.098."));
  assert.ok(short([0.09476, 0.0955, 0.0949, 0.10486]).includes("Values range from about 0.095 to about 0.105 with"));
  assert.ok(short([-0.10490005, -0.0985, -0.094898]).includes("Values range from about -0.105 to about -0.095 with"));
  // The same at 0.01 (0.001 wide, printed 0.0005): it read "about 0.0095 to about 0.01", and each end keeps its own two figures.
  assert.ok(short([0.009468846, 0.0098, 0.010478846]).includes("Values range from about 0.0095 to about 0.0105 with an average of 0.0099."));
  assert.ok(short([-0.01046006, -0.0099, -0.00946003]).includes("Values range from about -0.0105 to about -0.0095 with"));
  assert.ok(short([0.00948, 0.01048]).includes("Values range from about 0.0095 to about 0.0105 with"));
  // A line chart reads through the same ends.
  assert.ok(short([0.09468, 0.0952, 0.10479], line).includes('The "S" series rises, ranging from about 0.095 to about 0.105.'));
  // Must not move: a pair the across-0.1 rule already widens, a pair a step and a tenth or more wide (it prints at more than half), an
  // end typed in full, and two ends under 0.1 whose steps match.
  assert.ok(short([0.0951234, 0.1049999]).includes("Values range from about 0.095 to about 0.105 with"));
  assert.ok(short([0.009482, 0.010502]).includes("Values range from about 0.0095 to about 0.011 with"));
  assert.ok(short([0.0948, 0.105]).includes("Values range from 0.0948 to 0.105 with"));
  assert.ok(short([0.060306, 0.061406]).includes("Values range from about 0.06 to about 0.061 with"));
});

// An average beside a rounded end is written to at least that end's decimals. "about 0.095 to about 0.105 with an average of 0.1" read as a
// central average where the mean (0.0975) sits a quarter of the way along the range. A range whose two ends are typed in
// full takes the same floor, in both tiers, only where the magnitude rule speaks the average more than a twentieth of the range from the mean.
// The detailed "Average value:" bullet repeats the range sentence's average where that sentence is the takeaway.
test("short tier: an average beside an end printed about is written to the decimals of the printed ends", () => {
  const short = (values, series = bar) => describe(chart(band(null, label(values.length)), [series("S", values)])).short;
  // It read "with an average of 0.1" for each of these (the exact mean is 0.097505, -0.09943, 0.0099159, -0.00994003 and -6.25e-16).
  assert.ok(short([0.09476, 0.0955, 0.0949, 0.10486]).includes("Values range from about 0.095 to about 0.105 with an average of 0.098."));
  assert.ok(short([-0.10490005, -0.0985, -0.094898]).includes("Values range from about -0.105 to about -0.095 with an average of -0.099."));
  assert.ok(short([0.009468846, 0.0098, 0.010478846]).includes("Values range from about 0.0095 to about 0.0105 with an average of 0.0099."));
  assert.ok(short([-0.01046006, -0.0099, -0.00946003]).includes("Values range from about -0.0105 to about -0.0095 with an average of -0.0099."));
  assert.ok(short([-5e-16, -7.77e-16, -6e-16]).includes("Values range from about -0.00000000000000078 to -0.0000000000000005 with an average of -0.00000000000000063."));
  // One rounded end is enough, and the average is rounded half away from zero from the exact mean (0.09975 at three decimals is 0.1).
  assert.ok(short([0.09468, 0.10482]).includes("Values range from about 0.095 to about 0.105 with an average of 0.1."));
  // The earlier steps still apply after the decimals floor: the average stays inside the printed range and is not the figure of an end printed "about".
  assert.ok(short([0.0994, 0.0995001]).includes("Values range from 0.0994 to about 0.0995 with an average of 0.09945."));
  assert.ok(short([1.994, 1.9950001]).includes("Values range from 1.994 to about 1.995 with an average of 1.9945."));
  // The mean (1.0008) written at the ends' three decimals is 1.001, the end's own figure, so the search goes on to four; it read "an average of 1".
  assert.ok(short([0.99941, 1.00149, 1.00149]).includes("Values range from about 0.999 to about 1.001 with an average of 1.0008."));
  // Two typed ends keep the magnitude rule, except where it speaks the average more than a twentieth of the range from the mean. "From 0.095
  // to 0.105 with an average of 0.1" read as a central average where the mean (0.0975) sits a quarter of the way along; 1.27 is 6% of the
  // range from 1.266.
  assert.ok(short([0.095, 0.095, 0.095, 0.105]).includes("Values range from 0.095 to 0.105 with an average of 0.098."));
  assert.ok(short([-0.095, -0.095, -0.095, -0.105]).includes("Values range from -0.105 to -0.095 with an average of -0.098."));
  assert.ok(short([1.234, 1.298]).includes("Values range from 1.234 to 1.298 with an average of 1.266."));
  // Ends typed to different decimals: the more precise end sets the floor. It read "with an average of 100.6" (15% of the range from 100.5625).
  assert.ok(short([100.5, 100.75, 100.5, 100.5]).includes("Values range from 100.5 to 100.75 with an average of 100.56."));
  // Must not move: an average within a twentieth of the range (0.3%, 2.8% and 4.6% here), an average that already has the ends' decimals, a
  // mean the ends' decimals write as the same figure, and a line chart (no average).
  assert.ok(short([12.345, 19.876, 14.5]).includes("Values range from 12.345 to 19.876 with an average of 15.6."));
  assert.ok(short([995.5, 995.5, 995.5, 1004.5]).includes("Values range from 995.5 to 1004.5 with an average of 998."));
  assert.ok(short([100.1, 100.1, 100.1, 109.9]).includes("Values range from 100.1 to 109.9 with an average of 103."));
  assert.ok(short([4, 4, 4, 5]).includes("Values range from 4 to 5 with an average of 4.25."));
  assert.ok(short([0.095, 0.105]).includes("Values range from 0.095 to 0.105 with an average of 0.1."));
  const detailedOf = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).lines;
  // The detailed tier takes the same test: the range sentence and the "Average value:" bullet read the same average.
  assert.ok(detailedOf([0.095, 0.095, 0.095, 0.105]).includes("• Values range from 0.095 to 0.105 with an average of 0.098."));
  assert.ok(detailedOf([0.095, 0.095, 0.095, 0.105]).includes("• Average value: 0.098."));
  const detailed = detailedOf([0.09468, 0.0952, 0.10479]);
  assert.ok(detailed.includes("• Values range from 0.09468 to 0.10479 with an average of 0.09822."));
  assert.ok(detailed.includes("• Average value: 0.09822."));
  assert.ok(detailedOf([12.345, 19.876, 14.5]).includes("• Values range from 12.345 to 19.876 with an average of 15.6."));
  assert.ok(detailedOf([12.345, 19.876, 14.5]).includes("• Average value: 15.6."));
  // A takeaway that is not the range sentence leaves the bullet as it was: 0.000125 is half way along 0 to 0.00025 and stays 0.0001.
  assert.ok(detailedOf([0.00025, 0]).includes("• Average value: 0.0001."));
  assert.ok(short([0.09468, 0.0952, 0.10479], line).includes('The "S" series rises, ranging from about 0.095 to about 0.105.'));
});

test('detailed tier: the "Average value:" bullet prints the range sentence\'s average whole, decimals and all, at 100 and above', () => {
  const detailedOf = (values) => describe(chart(band(null, label(values.length)), [bar("S", values)])).lines;
  // The magnitude rule speaks a mean of 100 or more as a whole number; beside two typed ends the average carries the ends' decimals in both
  // the range sentence and the bullet. A reader who stops at the first full stop would take "100." and "12346." for these bullets, so the
  // test reads each whole bullet and the decimals must sit before that stop.
  for (const [values, low, high, average] of [
    [[100.5, 100.5, 100.5, 101.5], "100.5", "101.5", "100.8"],
    [[100.25, 101.5], "100.25", "101.5", "100.88"],
    [[12345.6, 12345.6, 12345.6, 12349.6], "12345.6", "12349.6", "12346.6"],
  ]) {
    const lines = detailedOf(values);
    assert.ok(lines.includes(`• Values range from ${low} to ${high} with an average of ${average}.`), `range sentence for ${values}`);
    assert.ok(lines.includes(`• Average value: ${average}.`), `bullet for ${values}`);
  }
});
