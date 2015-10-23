// dashboard.js

// Whole-script strict mode syntax
"use strict";

var blessed = require('blessed');
var util = require('util');

// add lpad to string
String.prototype.lpad = function(padString, length) {
  var str = this;
  while (str.length < length)
    str = padString + str;
  return str;
}

// Create a screen object.
var screen = blessed.screen({
  smartCSR: true
});

screen.title = 'WADI activity';

// Create a box for activities.
var activityBox = blessed.box({
  top: 0,
  left: 0,
  width: '49%',
  height: '99%',
  content: '{bold}Activity{/bold}!',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'black',
    bg: 'none',
  }
});

// Create a box for bugzilla bugs.
var bugBox = blessed.box({
  top: 0,
  left: '50%',
  width: '49%',
  height: '99%',
  content: '{bold}Bugs{/bold}!',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'black',
    bg: 'none',
  }
});

// Append our box to the screen.
screen.append(activityBox);
screen.append(bugBox);

// Quit on Escape, q, or Control-C.
screen.key(['escape', 'q', 'C-c'], function(ch, key) {
  return process.exit(0);
});

screen.render();

function redrawEvents(inEvents) {
  activityBox.setContent('{bold}Activity{/bold}!');

  var keys = Object.keys(inEvents);

  keys.sort();
  keys.reverse();

  for (var index = 0; index <  keys.length; index++) {
    var aKey = keys[index];
    activityBox.insertBottom(inEvents[aKey]);
  }

  screen.render();
}

function redrawBugs(inBugs) {
  bugBox.setContent('{bold}Bugs{/bold}!');

  var keys = Object.keys(inBugs);

  keys.sort();
  keys.reverse();

  for (var index = 0; index <  keys.length; index++) {
    var aKey = keys[index];
    bugBox.insertBottom(inBugs[aKey]);
  }

  screen.render();
}

module.exports.redrawEvents = redrawEvents;
module.exports.redrawBugs = redrawBugs;

