// dashboard.js

// Whole-script strict mode syntax
"use strict";

var blessed = require('blessed');
var screen = null;
var util = require('util');
var bugBox = null;
var activityBox = null;
var logBox = null;

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
    height: '69%',
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

  // Create a box for logging.
  logBox = blessed.box({
    top: '70%',
    left: '50%',
    width: '49%',
    height: '30%',
    content: '{bold}Log{/bold}!',
    tags: true,
    scrollable: true,
    alwaysScroll: true,
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
  screen.append(logBox);

  // Quit on Escape, q, or Control-C.
  screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    return process.exit(0);
  });

  screen.render();
}

function formatForEventBox(inRepoName, anActivity) {
  var activityDescription = anActivity.type;
  var activityActor = '';
  var formattingString = ["%s", "%s", "%s", "%s"];

  if (anActivity.actor) {
    activityActor = anActivity.actor.login;
  }

  if (anActivity.type == 'IssueCommentEvent') {
    formattingString[3] = "{cyan-fg}%s {/}";
    activityDescription = '"' + anActivity.payload.comment.body + '"';
  } else if (anActivity.type == 'IssuesEvent') {
    activityDescription = 'Issue ' + anActivity.payload.issue.body;
  } else if (anActivity.type == 'PullRequestEvent') {
    activityDescription = 'PR ' + anActivity.payload.pull_request.title;
    formattingString[3] = "{bold}%s{/}";
  } else if (anActivity.type == 'PullRequestReviewCommentEvent') {
    activityDescription = 'Review ' + anActivity.payload.comment.body;
  } else if (anActivity.type == 'GollumEvent') {
    activityDescription = 'Wiki update';
  } else if (anActivity.type == 'PushEvent') {
    formattingString[3] = "{blue-fg}%s{/}";
    activityDescription = 'Push ' + anActivity.payload.commits[0].message;
  } else if (anActivity.type == 'CreateEvent') {
    activityDescription = 'Create ' + anActivity.payload.description;
  } else if (anActivity.type == 'WatchEvent') {
    activityDescription = 'Watch ' + inRepoName;
  }

  if (inRepoName == 'platatus') {
    formattingString[0] = "{blue-fg}%s{/}"
  } else if (inRepoName == 'oghliner') {
    formattingString[0] = "{red-fg}%s{/}"
  }

  if (anActivity.type) {
    if (parseInt(anActivity.created_at.substring(9,10)) % 2) {
      formattingString[1] = '{yellow-fg}%s{/}';
    }

    var formattedString = util.format(
      formattingString.join(' '),
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

function formatForBugBox(inBugInfo) {
  var assignee = 'nobody';
  var attachmentString = '';

  if (inBugInfo.data.assigned_to != 'nobody@mozilla.org') {
    assignee = inBugInfo.data.assigned_to;
  }

  if (inBugInfo.patches) {
    attachmentString = inBugInfo.patches.map(function(p) {
      if (p.is_obsolete) {
        return 'o';
      } else if (p.flags && p.flags[0]) {
        return p.flags[0].status;
      } else {
        return 'u';
      }
    }).join(',');
  }

  var formatString = "%s %s {blue-fg}%s{/} %s";

  if (inBugInfo.data.status == 'NEW') {
    formatString = "%s %s {red-fg}%s{/} %s";
  } else {
    // moo
  }

  return util.format(formatString,
    (''+inBugInfo.data.id).lpad(' ', 7),
    assignee.substring(0, 15).lpad(' ', 17),
    inBugInfo.data.status.lpad(' ', 10),
    (attachmentString + inBugInfo.data.summary).substring(0,50)
  );
}

function redrawEvents(inEvents) {
  if (! activityBox) {
    return;
  }

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

function redrawBugs(inBugInfo) {
  if (! bugBox) {
    return;
  }

  bugBox.setContent('{bold}' + Object.keys(inBugInfo).length + ' Bugs{/bold}!');

  var keys = Object.keys(inBugInfo);

  keys.sort();
  keys.reverse();

  for (var index = 0; index <  keys.length; index++) {
    var aKey = keys[index];
    if (inBugInfo[aKey].summary) {
      bugBox.insertBottom(inBugInfo[aKey].summary);
    }
  }

  screen.render();
}

function logString(aString) {
  logBox.insertBottom(aString);
  logBox.setScrollPerc(100);
  screen.render();
}

module.exports.redrawEvents = redrawEvents;
module.exports.redrawBugs = redrawBugs;
module.exports.formatForEventBox = formatForEventBox;
module.exports.formatForBugBox = formatForBugBox;
module.exports.initializeBlessedDashboard = initializeBlessedDashboard;
module.exports.logString = logString;

