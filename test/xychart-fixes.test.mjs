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
  assert.ok(out.lines.includes('• The "Score" series shows a generally decreasing trend, with fluctuations.'));
  assert.ok(out.lines.includes("• Overall, the values go from 10 at the start to -100 at the end."));
  assert.equal(out.lines.filter((text) => text.includes("consistently")).length, 0);
});

test("trend: eight falls that end lower still read as a consistent fall", () => {
  const out = describe(chart(band(null, label(10)), [line("Score", [10, 9, 8, 7, 6, 5, 4, 3, 9, 1])]));
  assert.equal(
    out.short,
    'A line chart showing "Score" over 10 categories. The "Score" series shows a consistently decreasing trend, ranging from 1 to 10.'
  );
  assert.ok(out.lines.includes('• The "Score" series shows a consistently decreasing trend, ranging from 1 to 10.'));
  assert.ok(!out.lines.includes('• The "Score" series shows a consistently decreasing trend.'), "the trend is not repeated");
});

test("trend: eight rises and a last fall that still ends higher read as a consistent rise", () => {
  const out = describe(chart(band(null, label(10)), [line("Score", [1, 2, 3, 4, 5, 6, 7, 8, 9, 3])]));
  assert.equal(
    out.short,
    'A line chart showing "Score" over 10 categories. The "Score" series shows a consistently increasing trend, ranging from 1 to 9.'
  );
  assert.ok(out.lines.includes('• The "Score" series shows a consistently increasing trend, ranging from 1 to 9.'));
  assert.ok(!out.lines.includes('• The "Score" series shows a consistently increasing trend.'), "the trend is not repeated");
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
    'A line chart showing "Rate" over three categories. The "Rate" series rises, ranging from about 0.00001 to 0.004.'
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
  assert.ok(out.lines.includes('• The "Score" series shows a stable trend.'));
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

test("series: two series with one name are told apart by their order", () => {
  const out = describe(chart(band(null, ["A", "B", "C"]), [bar("Total", [1, 2, 3]), line("Total", [3, 2, 1])]));
  assert.ok(out.lines.includes('• The second "Total" series falls.'));
  assert.ok(out.lines.includes('• Highest value in the first "Total" series: 3 ("C").'));
  assert.ok(out.lines.includes("Category | Total (series 1) | Total (series 2)"));
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

test("repeat: a different case or an interior space is a different label", () => {
  const lower = describe(AUTUMN("autumn"));
  assert.equal(
    lower.short,
    'A bar chart showing "Level" for four categories. The highest value, 9 at "autumn", is 140% above the average.'
  );
  assert.ok(lower.lines.includes("autumn | 9"));
  const interior = describe(levelBar(["Spring", "Late  Autumn", "Late Autumn", "Winter"], [1, 9, 2, 3]));
  assert.ok(interior.lines.includes("Late  Autumn | 9"));
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
