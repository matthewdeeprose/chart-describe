// A small Chart.js line chart, and the code that describes it.
// The page and Node both load this file, so both get the same config
// and the same words.

(function (root) {
  "use strict";

  // Three lines, told apart by colour, line style and point shape.
  // Each colour has at least 3:1 contrast against the white chart.
  const SERIES_STYLES = [
    { colour: "#0b5cad", dash: [], point: "circle" },
    { colour: "#b3360a", dash: [10, 5], point: "triangle" },
    { colour: "#2f6b1f", dash: [2, 4], point: "rect" },
  ];

  const TEXT_COLOUR = "#1a1a1a";
  const GRID_COLOUR = "#767676";

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const VISITS = [
    { label: "Main library", data: [820, 910, 1040, 980, 760, 640] },
    { label: "Science library", data: [510, 560, 690, 720, 480, 390] },
    { label: "Law library", data: [260, 300, 340, 310, 220, 180] },
  ];

  const config = {
    type: "line",
    data: {
      labels: MONTHS,
      datasets: VISITS.map((series, i) => {
        const style = SERIES_STYLES[i];
        return {
          label: series.label,
          data: series.data,
          borderColor: style.colour,
          backgroundColor: style.colour,
          borderWidth: 3,
          borderDash: style.dash,
          pointStyle: style.point,
          pointRadius: 6,
          pointHoverRadius: 8,
          tension: 0,
        };
      }),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      // No animation for people who ask their system for less motion.
      animation:
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? false
          : undefined,
      plugins: {
        title: {
          display: true,
          text: "Library visits per month",
          color: TEXT_COLOUR,
          font: { size: 18 },
        },
        legend: {
          display: true,
          labels: {
            color: TEXT_COLOUR,
            font: { size: 14 },
            // The key shows each line's colour and style.
            usePointStyle: false,
            boxWidth: 48,
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Month", color: TEXT_COLOUR },
          ticks: { color: TEXT_COLOUR, font: { size: 14 } },
          grid: { color: GRID_COLOUR },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Visits", color: TEXT_COLOUR },
          ticks: { color: TEXT_COLOUR, font: { size: 14 } },
          grid: { color: GRID_COLOUR },
        },
      },
    },
  };

  // Fill the page. Runs only in a browser.
  function start() {
    const canvas = document.getElementById("chart");
    const result = root.ChartDescribeChartJs.describe(config);

    if (!result.supported) {
      console.error("chart-describe could not describe this chart:", result.reason);
      return;
    }

    canvas.setAttribute("aria-label", result.short);
    document.getElementById("short").innerHTML = result.shortHTML;
    document.getElementById("detailed").innerHTML = result.detailed;
    new root.Chart(canvas, config);
  }

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", start);
  }

  const exported = { config, SERIES_STYLES, TEXT_COLOUR, GRID_COLOUR };
  root.ChartDescribeExample = exported;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }
})(typeof window !== "undefined" ? window : globalThis);
