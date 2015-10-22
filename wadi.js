// Whole-script strict mode syntax
"use strict";

var request = require('request');
var GitHub = require("github");
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

screen.title = 'my window title';

// Create a box for activities.
var activityBox = blessed.box({
  top: 0,
  left: 'center',
  width: '95%',
  height: '70%',
  content: '{bold}Activity{/bold}!',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'black',
    bg: 'white',
  }
});

// Create a box for bugzilla bugs.
var bugBox = blessed.box({
  top: '74%',
  left: 'center',
  width: '95%',
  height: '25%',
  content: '{bold}Bugs{/bold}!',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'black',
    bg: 'white',
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
    timeout: 5000
});

github.authenticate({
    type: "oauth",
    token: process.env.SEKRIT
});

// go find all the bugs we are tracking for WADI

// TODO get all history https://bugzilla.mozilla.org/rest/bug/707428/history

request("http://bugzilla.mozilla.org/rest/bug/1201717", function(error, response, body) {
    var tracker = JSON.parse(body);
    var depends_on_list = tracker.bugs[0].depends_on;

    // loop through the list of tracked bug ID's
    for (var bugIndex in depends_on_list) {
        var bugID = depends_on_list[bugIndex];

        // and for each tracked bug ID, go find info for that bug

        request("http://bugzilla.mozilla.org/rest/bug/" + depends_on_list[bugIndex], function(error, response, body) {
            var trackedBug = JSON.parse(body).bugs[0];

            // add info about that tracked bug to the table
            // NOTE: do not update the display now, it will get updated later
            var assignee = 'nobody';
            if (trackedBug.assigned_to != 'nobody@mozilla.org') {
                assignee = trackedBug.assigned_to;
            }

            bugBox.insertBottom(util.format("%s {red-fg}%s{/} %s %s", trackedBug.id, assignee, trackedBug.status, trackedBug.summary));
            screen.render();
        });
    }

});

// go find all the activity for wadi repo's

// TODO: combine multiple event streams sort by date
function addEventsFromOghliner() {
    github.events.getFromRepo( { 'user': 'mozilla', 'repo': 'oghliner', per_page: 100 }, function(err, activities) {
        try {
            if (err) {
                throw new Error(err.message);
            }

            for (var activityIndex in activities) {
                var anActivity = activities[activityIndex];

                var activityDescription = anActivity.type;
                var activityActor = '';

                if (anActivity.type == 'IssueCommentEvent') {
                    activityActor = anActivity.payload.comment.user.login;
                    activityDescription = anActivity.payload.comment.body;
                } else if (anActivity.type == 'IssuesEvent') {
                    activityActor = anActivity.payload.issue.user.login;
                    activityDescription = anActivity.payload.issue.body;
                } else if (anActivity.type == 'PullRequestEvent') {
                    activityActor = anActivity.payload.pull_request.user.login;
                    activityDescription = anActivity.payload.pull_request.title;
                } else if (anActivity.type == 'PullRequestReviewCommentEvent') {
                    activityActor = anActivity.payload.comment.user.login;
                    activityDescription = anActivity.payload.comment.body;
                } else if (anActivity.type == 'PushEvent') {
                    activityActor = anActivity.payload.commits[0].author.email;
                    activityDescription = anActivity.payload.commits[0].message;
                } else if (anActivity.type == 'CreateEvent') {
                    activityActor = '';
                    activityDescription = anActivity.payload.description;
                }

                if (anActivity.type) {
                    activityBox.insertBottom(util.format("%s {red-fg}%s{/} %s", anActivity.created_at.substring(0,10), activityActor.substring(0, 10).lpad(' ', 12), activityDescription.replace(/(\r\n|\n|\r)/gm," ").substring(0,150)));
                    screen.render();
                }
            }
        }
        catch(e) {
            console.log('cannot parse events json', e);
            console.log(e.stack);
        }
    });
}

addEventsFromOghliner();
