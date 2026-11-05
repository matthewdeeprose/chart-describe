# The wording standard

This page says what chart-describe writes, and why each rule exists. Every rule names the function that carries it. If a rule here and the code ever disagree, the code is right and this page needs fixing.

Every chart gets two descriptions:

- **The short description.** One or two sentences. It fits an `aria-label` or a figure caption.
- **The detailed description.** Headed sections. It gives the structure of the chart, the main facts, and every value.

The library does not check how long a short description is. The builders keep it short by design. For example, `buildTakeawayRuns` in `charts-xychart.js` leaves out the list of series names in the short form, because that list has no length limit.

## Rules for every chart

1. **The chart's author wrote their words. The library never changes them.** A title, a label or a series name goes into the description as the author typed it. The library does not change its case. This rule is carried by `author` in `model.js`, and by `capitalise` in `charts-shared.js`, which raises the first letter of the library's own words only.

2. **Author text is escaped once, at the last step.** The model holds the raw text. `renderHtml` in `render.js` escapes it through `escapeAuthor`, which calls `escapeHtml` in `text.js`. That function replaces `&`, `<`, `>`, `"` and `'`. The plain short description is never escaped, because a screen reader would read an entity out loud.

3. **Markdown gets its own escaping.** `renderMarkdown` in `render.js` puts a backslash before characters that Markdown would read as formatting, through `escapeMarkdownAuthor`. The text `<script>` becomes `\<script>`.

4. **Small counts are words, and big counts are digits.** Zero to nine are written as words. From 10, the library writes digits. This is `narrationNumber` in `text.js`.

5. **Lists use a comma before the last "and".** "A, B, and C." Two items read "A and B". This is `formatList` in `text.js`. Radar uses its own `joinRunsNoSerial` in `charts-radar.js`, which writes "A, B and C" with no comma before the "and".

6. **A value is never left silent.** Where a chart has no value, the description says so in words. The xychart table writes "no value" (`buildTableModel` in `charts-xychart.js`).

## Pie charts

The pie rules live in `charts-pie.js`. The builder is `buildPieModel`. It also serves doughnut and polar-area charts.

**The short description.** It opens "A pie chart", adds the title if there is one, and says how many categories there are. Then it adds one sentence that names the largest segment. `largestSentence` writes that sentence. The detailed description reuses the same function, so the two cannot disagree.

**The detailed description.** It has these sections, in this order:

1. Chart Construction: what the chart is, and the list of categories.
2. Key Insights: the largest segment, the total, the largest and the smallest.
3. Complete Data Points: every segment with its value and share.
4. Distribution Pattern: only when there are three or more segments and the total is above zero (`generatePatternSection`). It gives the average segment size. With more than four segments it also gives the share of the smaller half.

**Sorting.** `buildPieModel` sorts the segments by value, largest first. It sorts the array you pass in, so give it a copy.

**Percentages.** `formatPercentage` writes one decimal place. A share above zero that would print as 0.0% reads "less than 0.1%".

**Over half, a third, a quarter.** `proportionPhrase` tests the exact fraction. It writes "exactly half" only when the share is within a tiny tolerance of a half. Above that, it writes "over half". The same rule applies to thirds and quarters. A smaller share gets no phrase.

**Ties.** `readTies` finds equal values at the top and bottom. When two or more segments share the top value, `largestSentence` writes "X and Y are the joint largest segments, at 40.0% each." When every segment is equal, it writes "Both segments are equal" for two segments, or "All four segments are equal" for four. In that case the Key Insights list leaves out the largest and smallest lines, because they would contradict it.

**A single segment.** One segment is not a tie. `readTies` does not call it "all equal".

**A zero total.** `largestSentence` writes "Every value is zero, so no segment is larger than another." The data list then shows values without shares, and the Key Insights list leaves out the largest and smallest lines.

**No segments.** The Key Insights list holds only the total. The Construction section describes the layout of a pie chart in general.

**Noise in the total.** Decimal sums carry tiny errors. `cleanTotal` keeps twelve significant digits, so a total of 0.3 does not print as 0.30000000000000004.

## Radar charts

The radar rules live in `charts-radar.js`. The builder is `buildRadarModel`.

**The short description.** One sentence: "A radar chart titled "…" with three axes and one series." `buildShortRuns` is the only function that writes it.

**The detailed description.** These sections, in this order:

1. Overview: what the chart plots, the axes in clockwise order starting at the top, the scale, and the grid (`buildOpeningSentence`, `buildAxesSentence`, `buildScaleSentence`, `buildGridSentence`).
2. Series: one numbered item for each series (`buildSeriesItem`).
3. Comparison: only when two or more series are plotted (`comparisonItems`).
4. Data Table: only when at least one series is in the table (`buildDataTable`).

**Each series item.** A plotted series gets its label, its average (only when the chart has a range), and one sentence that names its highest and lowest axes. Under it, one item gives the value on each axis. `roundedMean` rounds a half away from zero, and it copes with decimal sums that fall just short of a half.

**Ties.** `extremesSentence` finds the highest and lowest. When several axes share a value, it names every one of them. When every value is equal, it writes "The same value on every axis."

**Empty labels.** A label that is empty or only spaces becomes "unlabelled axis 2" or "unlabelled series 1", with its position. This is `proseName` for prose and `cellName` for table headers. No cell is ever empty.

**Mismatched series.** A series with a different number of values from the axes is not plotted. Its item says so, gives the reason, and lists its values in the order written (`buildSeriesItem`). It has no column in the table.

**Values outside the scale.** When the author sets a scale, `clampedSentence` says how many values sit above the maximum or below the minimum, and where the picture draws them.

**Comparison.** `buildPairSentence` compares two series. The earlier series is always the subject. It names each axis once, as higher, lower or equal. `comparisonItems` lists at most six pairs, which is the `MAX_LISTED_PAIRS` constant. Beyond six, one last item says how many pairs it left out, and points to the data table.

## Bar and line charts (xychart)

The xychart rules live in `charts-xychart.js`. The builder is `buildXychartModel`. It describes bar charts, line charts and charts that mix both.

**The short description.** The opening sentence plus one takeaway sentence. `buildShortOpeningRuns` writes the opening: the chart type, the title, what the y-axis shows, and how many categories there are. `buildTakeawayRuns` writes the takeaway, with the short form of the numbers.

**The detailed description.** These sections, in this order:

1. Chart Construction (`buildConstructionBlocks`).
2. Key Insights (`buildInsightsModel`). The first item is the same takeaway as the short description, in bold. On a chart with several series, line series come before bar series.
3. Data Table (`buildTableModel`).

**One series or several.** With several series, the takeaway compares the average of each series and names the one with the highest values. With one series, it uses that series' range, its trend or its highest and lowest points.

**Mismatched series.** When the series have different numbers of values, the takeaway says so instead of comparing averages. `buildTakeawayRuns` does this. A series that disagrees with the number of labels the author declared gets its own sentence in the Construction section (`mismatchedSeries` finds them).

**Single values.** A series with one value reads "The chart has a single value, 42, at "Mon"." A series where every value is the same reads "All three values are 42." or "Both values are 42." That is `degenerateTakeaway`. Next to other series, it reads "Every value in the "Forecast" series is 300." (`degenerateSeriesInsight`). No range, trend or ratio is claimed for a series with no variation (`isDegenerateSeries`).

**Ties.** `computeStatistics` finds every position that holds the highest value and every position that holds the lowest. `pointReferencesRuns` names them all. From four tied positions (`TIED_POSITION_COLLAPSE_AT`), it gives a count instead of a list.

**Signed values.** The takeaway says "N% below the average" only when the lowest value is zero or above. A negative lowest value would give a figure above 100%, which misleads. `buildTakeawayRuns` carries this guard. The "above the average" sentence has no such limit.

**Trends.** Trend sentences appear on line series only. They never appear when the x-axis is a numeric range, because a numeric range is not a sequence of occasions. `analyseTrend` decides the trend, and `TREND_CLAUSE` holds the exact words.

**Statistics.** From five values (`STATISTICS_MIN_POINTS`), a single-series bar chart adds the standard deviation, the median, and a sentence on skew (`buildDistributionSentence`).

**Missing values.** A position where a series has no value shows "no value" in the table (`buildTableModel`). The cell is never left empty.

**Repeated labels.** When two categories share a label, the table numbers every one of them, including the first, for example "Autumn (position 1)". `isDuplicatedLabel` finds them. A screen reader then gives each row a different name.

**Rounding in the short form.** A value with more than four decimal places is rounded to two, but only in the short description (`formatAuthorValueForTier`). The detailed description and the table keep the author's exact number.
