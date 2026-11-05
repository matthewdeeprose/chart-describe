# chart-describe

chart-describe writes plain-language descriptions of charts, for people who cannot see them. You give it the facts of a chart. It gives you words.

It works with **Chart.js**. Pass a bar, line or pie config to one call, `ChartDescribeChartJs.describe(config)`, and you get the words back. It also takes the data behind Mermaid's pie, radar and xychart diagrams: the builders below accept that shape.

It describes three kinds of chart: bar and line charts (together called xychart), pie charts, and radar charts. Every chart gets two descriptions:

- **Short.** One or two sentences. Use it as an `aria-label` or a caption.
- **Detailed.** Headed sections: how the chart is built, the main facts, and every value in a table.

The rules are fixed. The same chart always gets the same words. There is no model to train and no service to call. The library has no dependencies and no build step. Read [docs/STANDARD.md](docs/STANDARD.md) to see every wording rule.

## Try the example

[examples/chartjs.html](examples/chartjs.html) draws one Chart.js line chart and shows both descriptions. The three lines differ by colour, line style and point shape. Open the file in a browser. It works from a local file and from a web server. It loads Chart.js 4.5.1 from the jsDelivr CDN, so you need a network connection. The config and the wiring are in [examples/chartjs-example.js](examples/chartjs-example.js).

## What you get back

You ask for a description in three steps. First, build a model from the chart's facts. The model holds the words and marks which ones the chart's author wrote. Second, turn the model into the form you need: HTML, plain text or Markdown. Third, use the result.

The library escapes the author's words for you. A title such as `<script>` comes out safe in HTML, and safe in Markdown.

## Use it in a browser

Load the files with script tags, in this order:

```html
<script src="src/text.js"></script>
<script src="src/model.js"></script>
<script src="src/render.js"></script>
<script src="src/charts-shared.js"></script>
<script src="src/charts-xychart.js"></script>
<script src="src/charts-pie.js"></script>
<script src="src/charts-radar.js"></script>
<script src="src/charts.js"></script>
<script src="src/chartjs.js"></script>
```

Each file adds one object to `window`, such as `window.ChartDescribeCharts`. The last file, `chartjs.js`, is optional. It reads a Chart.js config for you. It supports bar, line and pie charts.

The renderer uses regular expression lookbehind. You need a modern browser: current Chrome, Edge, Firefox or Safari.

## Use it in Node

Load the files in the same order with `require`. Each file also puts its object on `globalThis`, because the files find each other there.

```js
for (const file of [
  "text", "model", "render", "charts-shared",
  "charts-xychart", "charts-pie", "charts-radar", "charts", "chartjs",
]) {
  require(`./src/${file}.js`);
}

const { ChartDescribeCharts, ChartDescribeModel, ChartDescribeRender } = globalThis;
```

## A worked example

Describe a pie chart:

```js
const model = ChartDescribeCharts.buildPieModel("Browser share", [
  { name: "Firefox", value: 40 },
  { name: "Chrome", value: 60 },
]);

// The short description, as plain text
ChartDescribeModel.flatten(model.short);

// The short description, as HTML
ChartDescribeRender.renderHtml(model, ChartDescribeRender.PROFILES.lines).shortHTML;
```

Both calls give this sentence. In HTML, the quotation marks come out as `&quot;`.

> A pie chart titled "Browser share" showing the distribution of two categories. Chrome is the largest segment at 60.0%, representing over half of the total.

A bar chart works the same way. You pass `buildXychartModel` a chart in this shape:

```js
const model = ChartDescribeCharts.buildXychartModel({
  type: "xychart",
  title: "Sales",
  accTitle: "",
  accDescr: "",
  orientation: "vertical",
  xAxis: { kind: "band", title: null, categories: ["jan", "feb", "mar"] },
  yAxis: null,
  series: [{ kind: "bar", name: null, values: [40, 60, 80] }],
});

ChartDescribeModel.flatten(model.short);
```

> A bar chart titled "Sales" for three months. Values range from 40 to 80 with an average of 60.

For a radar chart, call `buildRadarModel` with a facts object. The files in `test/goldens/` hold a working input and output for every family.

### The other forms

Every model also turns into plain text and Markdown. Each call gives you `{ short, detailed }`:

```js
ChartDescribeRender.renderText(model);
ChartDescribeRender.renderMarkdown(model);
```

`renderHtml` gives you `{ shortHTML, detailed }`. The `lines` profile writes plain headings, paragraphs, lists and tables. A page that wants its own class names can pass its own profile. `chartjs.js` shows one for pie charts: `composePie` writes the pie detailed description with section wrappers and class names.

## Tests

```
npm test
```

This runs Node's built-in test runner. There is nothing to install. The test files are named in `scripts.test` in `package.json`, so add a new test file to that list. Each of the 181 goldens in `test/goldens/` is a chart input with the exact output the library gave for it. A change to any word turns a test red. Further tests check that markup in a title or a label cannot get through.

## How it differs from other tools

Other projects also help people who cannot see a chart. We know of these three, and we describe them as we understand them:

- **chart2text** writes summaries of charts with trained language models. chart-describe uses fixed rules, so its output is the same every time, and you can read the rule behind any sentence.
- **Olli** builds a tree that a screen reader user can move through, from a chart specification. chart-describe makes no interface. It writes words, and you place them in your own page.
- **Apple's `AXChartDescriptor`** lets an app describe a chart to VoiceOver on Apple devices. chart-describe works on the web and in Node, and it can write HTML and Markdown.

chart-describe covers fewer chart types than a general tool would. It aims to cover three well.

## Status

Version 0.1. The wording is settled enough to test against, and the tests pin it. Expect it to change as more people read the descriptions and tell us what helps.

## Licence

MIT. See [LICENSE](LICENSE).
