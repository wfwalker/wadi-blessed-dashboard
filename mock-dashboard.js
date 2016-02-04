// another-dashboard.js

// Whole-script strict mode syntax
"use strict";

function initialize() {
  console.log('initialize');
}

function formatForEventBox(inRepoName, anActivity) {
  return anActivity;
}

function formatForBugBox(inBugInfo) {
  return inBugInfo;
}

function redrawEvents(inEvents) {
}

function redrawBugs(inBugInfo) {
}

function logString(aString) {
  console.log(aString);
}

module.exports.redrawEvents = redrawEvents;
module.exports.redrawBugs = redrawBugs;
module.exports.formatForEventBox = formatForEventBox;
module.exports.formatForBugBox = formatForBugBox;
module.exports.initialize = initialize;
module.exports.logString = logString;

