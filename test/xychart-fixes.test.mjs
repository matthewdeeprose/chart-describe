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

test("trend: eight falls that end lower still read as a consistent fall", () => {
  const out = describe(chart(band(null, label(10)), [line("Score", [10, 9, 8, 7, 6, 5, 4, 3, 9, 1])]));
  assert.equal(
    out.short,
    'A line chart showing "Score" over 10 categories. The "Score" series shows a consistently decreasing trend, ranging from 1 to 10.'
  );
  assert.ok(out.lines.includes('• The "Score" series shows a consistently decreasing trend, ranging from 1 to 10.'));
  assert.ok(!out.lines.includes('• The "Score" series shows a consistently decreasing trend.'), "the trend is not repeated");
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
  const noise = chart(band(null, ["A", "B", "C"]), [bar("North", [0.1 + 0.2, 0.3, 0.3]), bar("South", [0.3, 0.3, 0.3])]);
  assert.equal(describe(noise).short, "A bar chart for three categories. The series have the same average.");
});

test("a series with no values is refused, not described as undefined", () => {
  assert.throws(() => describe(chart(band(null, ["A", "B"]), [bar("Level", [])])), /no values/);
});

test("a tie that runs past the labels counts only the labelled categories", () => {
  const out = describe(chart(band(null, ["A", "B"]), [bar("Level", [9, 1, 9, 9, 9])]));
  assert.ok(out.lines.includes("• Highest value: 9 (one of the categories and three positions past the labels)."));
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
  assert.ok(two.lines.includes("• Unlabelled series 2 falls."));
  assert.ok(two.lines.includes("Category | North | Unlabelled series 2"));
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
  assert.ok(wobble.lines.includes('• The "Load" series shows a stable trend.'));
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
    assert.ok(named.lines.includes("• Highest value in unlabelled series 1: 3 (\"B\")."), JSON.stringify(blank));
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
