// dashboard.js

// Whole-script strict mode syntax
"use strict";

var blessed = require('blessed');
var screen = null;
var util = require('util');
var bugBox = null;
var activityBox = null;

// add lpad to string
String.prototype.lpad = function(padString, length) {
  var str = this;
  while (str.length < length)
    str = padString + str;
  return str;
}

function initializeBlessedDashboard() {
  // Create a screen object.
  screen = blessed.screen({
    smartCSR: true
  });

  screen.title = 'WADI activity';

  // Create a box for activities.
  activityBox = blessed.box({
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
  bugBox = blessed.box({
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
}

function formatForEventBox(inRepoName, anActivity) {
  var activityDescription = anActivity.type;
  var activityActor = '';
  var formattingString = "%s %s %s %s";

  if (anActivity.actor) {
    activityActor = anActivity.actor.login;
  }

  if (anActivity.type == 'IssueCommentEvent') {
    formattingString = "{cyan-fg}%s %s %s %s{/}";
    activityDescription = '"' + anActivity.payload.comment.body + '"';
  } else if (anActivity.type == 'IssuesEvent') {
    activityDescription = 'Issue ' + anActivity.payload.issue.body;
  } else if (anActivity.type == 'PullRequestEvent') {
    activityDescription = 'PR ' + anActivity.payload.pull_request.title;
    formattingString = "{bold}%s %s %s %s{/}";
  } else if (anActivity.type == 'PullRequestReviewCommentEvent') {
    activityDescription = 'Review ' + anActivity.payload.comment.body;
  } else if (anActivity.type == 'PushEvent') {
    formattingString = "{blue-fg}%s %s %s %s{/}";
    activityDescription = 'Push ' + anActivity.payload.commits[0].message;
  } else if (anActivity.type == 'CreateEvent') {
    activityDescription = 'Create ' + anActivity.payload.description;
  } else if (anActivity.type == 'WatchEvent') {
    activityDescription = 'Watch ' + inRepoName;
  }

  if (anActivity.type) {
    var formattedString = util.format(
      formattingString,
      inRepoName.substring(0, 10).lpad(' ', 12),
      anActivity.created_at.substring(0,10),
      activityActor.substring(0, 10).lpad(' ', 12),
      activityDescription.replace(/(\r\n|\n|\r)/gm," ").substring(0,50)
    );

  } else if (anActivity["x-ratelimit-limit"]) {
    var formattedString = 'rate limit ' + anActivity["x-ratelimit-remaining"] + ' ' + anActivity["x-ratelimit-limit"];
  }

  return formattedString;  
}

function formatForBugBox(trackedBug) {
  var assignee = 'nobody';

  if (trackedBug.assigned_to != 'nobody@mozilla.org') {
    assignee = trackedBug.assigned_to;
  }

  return util.format("%s %s %s %s",
    (''+trackedBug.id).lpad(' ', 7),
    assignee.substring(0, 15).lpad(' ', 17),
    trackedBug.status.lpad(' ', 10),
    trackedBug.summary.substring(0,50)
  );
}

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
module.exports.formatForEventBox = formatForEventBox;
module.exports.formatForBugBox = formatForBugBox;
module.exports.initializeBlessedDashboard = initializeBlessedDashboard;

