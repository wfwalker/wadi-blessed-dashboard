// Whole-script strict mode syntax
"use strict";

var request = require('request');
var GitHub = require("github");
var blessed = require('blessed');
var util = require('util');
var dashboard = require('./dashboard.js');

var allEvents = {};
var allBugs = {};

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

var github = new GitHub({
    // required 
    version: "3.0.0",
    // optional 
    debug: false,
    protocol: "https",
    host: "api.github.com",
    timeout: 30000
  });

github.authenticate({
  type: "oauth",
  token: process.env.SEKRIT
});

// go find all the bugs we are tracking for WADI

// TODO get all history https://bugzilla.mozilla.org/rest/bug/707428/history
// TODO get attachments look for review status https://bugzilla.mozilla.org/rest/bug/707428/attachment

function addBugsTrackedBy(inBugID) {
  request("http://bugzilla.mozilla.org/rest/bug/" + inBugID + "?include_fields=id,depends_on", function(error, response, body) {
    var tracker = JSON.parse(body);
    var depends_on_list = tracker.bugs[0].depends_on;

    dashboard.redrawBugs(allBugs);

    // loop through the list of tracked bug ID's
    for (var bugIndex in depends_on_list) {
      var bugID = depends_on_list[bugIndex];

      // and for each tracked bug ID, go find info for that bug

      request("http://bugzilla.mozilla.org/rest/bug/" + depends_on_list[bugIndex] + "?include_fields=id,status,summary,assigned_to", function(error, response, body) {
        try {
          var parsedResult = JSON.parse(body);

          if (parsedResult.bugs) {
            var trackedBug = parsedResult.bugs[0];


            // add info about that tracked bug to the table
            // NOTE: do not update the display now, it will get updated later
            var assignee = 'nobody';
            if (trackedBug.assigned_to != 'nobody@mozilla.org') {
              assignee = trackedBug.assigned_to;
            }

            var formattedString = '';

            if (trackedBug.status == 'RESOLVED' || trackedBug.status == 'VERIFIED') {
              // do nothing
            } else {
              formattedString = util.format("%s %s %s %s", (''+trackedBug.id).lpad(' ', 7), assignee.substring(0, 15).lpad(' ', 17), trackedBug.status.lpad(' ', 10), trackedBug.summary.substring(0,50));
              allBugs['' + trackedBug.id] = formattedString;          
              dashboard.redrawBugs(allBugs);
            }

          }
        }
        catch (e) {
          allBugs['' + bugID] = bugID + ' error ' + e;   
          dashboard.redrawBugs(allBugs);
        }
      });

      dashboard.redrawBugs(allBugs);
    }
  });
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

function addEventsFromRepo(inRepoName) {
  github.events.getFromRepo( { 'user': 'mozilla', 'repo': inRepoName, per_page: 100 }, function(err, activities) {
    try {
      if (err) {
        throw new Error(err.message);
      }

      for (var activityIndex in activities) {
        var anActivity = activities[activityIndex];
        allEvents[anActivity.created_at] = formatForEventBox(inRepoName, anActivity);
      }
      dashboard.redrawEvents(allEvents);
    }
    catch(e) {
      console.log('cannot parse events json', e);
      console.log(e.stack);
    }
  });
}

// go find all the activity for wadi repo's

addEventsFromRepo('oghliner');
addEventsFromRepo('platatus');
addEventsFromRepo('serviceworker-cookbook');

addBugsTrackedBy(1201717);
addBugsTrackedBy(1059784);

