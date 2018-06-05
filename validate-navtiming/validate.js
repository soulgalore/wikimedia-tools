"use strict";
const fs = require("fs");
const args = process.argv.slice(2);

if (!args[0]) {
  console.error("Missing filename");
  process.exit(1);
}

function isCompliant(event) {
  const sequences = [
    [
      "navigationStart",
      "fetchStart",
      "domainLookupStart",
      "domainLookupEnd",
      "connectStart",
      "connectEnd",
      "requestStart",
      "responseStart",
      "responseEnd",
      "domInteractive",
      "domComplete",
      "loadEventStart",
      "loadEventEnd"
    ],
    ["secureConnectionStart", "requestStart"]
  ];

  for (let sequence of sequences) {
    let previous = 0;
    for (let metric of sequence) {
      if (event[metric] && event[metric] > 0) {
        if (event[metric] < previous) {
          return false;
        }
        previous = event[metric];
      }
    }
  }
  return true;
}

function getMetric(event) {
  const metric = {};
  const start = event.fetchStart ? event.fetchStart : 0;

  const metrics = [
    "domComplete",
    "domInteractive",
    "firstPaint",
    "loadEventEnd",
    "loadEventStart",
    "mediaWikiLoadEnd",
    "responseStart"
  ];

  for (let name of metrics) {
    metric[name] = event[name] - start;
  }

  metric.dns = event.dnsLookup ? event.dnsLookup : 0;
  metric.unload = event.unload ? event.unload : 0;
  metric.redirect = event.redirecting ? event.redirecting : 0;
  metric.gaps = event.gaps ? event.gaps : 0;

  if (event.connectEnd && event.connectStart) {
    metric.tcp = event.connectEnd - event.connectStart;
  } else {
    metric.tcp = 0;
  }

  if (event.responseStart && event.requestStart) {
    metric.request = event.responseStart - event.requestStart;
  } else {
    metric.request = 0;
  }

  if (event.responseEnd && event.responseStart) {
    metric.response = event.responseEnd - event.responseStart;
  } else {
    metric.response = 0;
  }

  if (event.domComplete && event.responseEnd) {
    metric.processing = event.domComplete - event.responseEnd;
  } else {
    metric.processing = 0;
  }

  if (event.loadEventEnd && event.loadEventStart) {
    metric.onLoad = event.loadEventEnd - event.loadEventStart;
  } else {
    metric.onLoad = 0;
  }

  if (event.connectEnd && event.secureConnectionStart) {
    metric.ssl = event.connectEnd - event.secureConnectionStart;
  } else {
    metric.ssl = 0;
  }

  metric.original = event;
  return metric;
}

// Read the file and make sure we only get NavigationTiming events
const file = fs.readFileSync(args[0], "utf8");
const events = file
  .split("\n")
  .map(function(line) {
    return line ? JSON.parse(line) : undefined;
  })
  .filter(function(e) {
    if (e && e.schema === "NavigationTiming") return e;
  });

for (let e of events) {
  const event = e.event;

  if (isCompliant(event)) {
    const metric = getMetric(event);
    const total =
      metric.dns +
      metric.tcp +
      metric.request +
      metric.response +
      metric.processing +
      metric.gaps +
      metric.onLoad;
    if (total !== metric.loadEventEnd) {
      console.log(
        "Unmatching total:" + total + " loadEventEnd:" + metric.loadEventEnd
      );
      console.log(metric.original);
    }
  } else {
    console.log("Discarding event as not compliant");
  }
}
