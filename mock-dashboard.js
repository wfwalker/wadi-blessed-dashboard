// another-dashboard.js

// Whole-script strict mode syntax
"use strict";

function initialize() {
  console.log('initialize');
}

function formatForEventBox(inRepoName, anActivity) {
  console.log('formatForEventBox');
  return anActivity;
}

function formatForBugBox(inBugInfo) {
  console.log('formatForBugBox', inBugInfo);
  return inBugInfo;
}

function redrawEvents(inEvents) {
  console.log('redrawEvents', inEvents.length);
}

function redrawBugs(inBugInfo) {
  console.log('redrawBugs', Object.keys(inBugInfo).length);
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

