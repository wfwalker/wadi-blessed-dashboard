// Whole-script strict mode syntax
"use strict";

var request = require('request');
var blessed = require('blessed');
var contrib = require('blessed-contrib');
var GitHubAPI = require("github");

var github = new GitHubAPI({
    // required 
    version: "3.0.0",
    // optional 
    debug: true,
    protocol: "https",
    host: "api.github.com", // should be api.github.com for GitHub 
    timeout: 5000
});

// set up a grid with two rows and one column

var screen = blessed.screen();
var grid = new contrib.grid({rows: 2, cols: 2, screen: screen});

// create a table for bugzilla bugs

var bugList = grid.set(0, 0, 2, 1, contrib.table, {
    keys: true,
    fg: 'white',
    label: 'wadi bugs',
    columnWidth: [10, 20, 10, 150],
    columnSpacing: 3
});

var bugListData = {
    headers: ['id', 'assignee', 'status', 'title'],
    data: [ ]
};

screen.append(bugList);
bugList.setData(bugListData);

// create table for github activity

var githubActivity = grid.set(0, 1, 2, 1, contrib.table, {
    keys: true,
    fg: 'white',
    label: 'github activity',
    columnWidth: [10, 10, 150],
    columnSpacing: 3
});

var githubActivityData = {
    headers: ['date', 'actor', 'title'],
    data: [ ]
};

screen.append(githubActivity);
githubActivity.setData(githubActivityData);

// make sure its possible to exit

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    return process.exit(0);
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
            var assignee = '';
            if (trackedBug.assigned_to != 'nobody@mozilla.org') {
                assignee = trackedBug.assigned_to;
            }

            bugListData.data.push([trackedBug.id, assignee, trackedBug.status, trackedBug.summary]);
            bugList.setData(bugListData);
        });
    }

});

// go find all the activity for wadi repo's

// TODO: combine multiple event streams sort by date

github.events.getFromRepo( { 'user': 'mozilla', 'repo': 'oghliner' }, function(err, activities) {
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
                githubActivityData.data.push([anActivity.created_at.substring(0,10), activityActor, activityDescription]);
                githubActivity.setData(githubActivityData);                
            }
        }
    }
    catch(e) {
        console.log('cannot parse events json', e);
        console.log(e.stack);
    }
});


// on a recurring basis, update the display of random values and re-render

setInterval(function() {
    screen.render();
}, 5000);