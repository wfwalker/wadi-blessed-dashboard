// Whole-script strict mode syntax
"use strict";

var request = require('request');
var GitHub = require("github");
var util = require('util');
var dashboard = require('./dashboard.js');

var allEvents = {};
var allBugSummaries = {};
var allAttachments = {};

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

    // loop through the list of tracked bug ID's
    for (var bugIndex in depends_on_list) {
      var bugID = depends_on_list[bugIndex];

      // and for each tracked bug ID, go find info for that bug

      // request("http://bugzilla.mozilla.org/rest/bug/" + depends_on_list[bugIndex] + "/attachment", function(error, response, body) {
      //   try {
      //     var parsedResult = JSON.parse(body);  
      //     if (parsedResult.bugs[depends_on_list[bugIndex]]) {
      //       var attachmentContent = parsedResult.bugs[depends_on_list[bugIndex]];
      //       allAttachments[depends_on_list[bugIndex]] = attachmentContent;
      //       // console.log(bugID, attachmentContent);
      //       allBugSummaries['' + trackedBug.id] = dashboard.formatForBugBox(trackedBug, attachmentContent);
      //       dashboard.redrawBugs(allBugSummaries);            
      //     }      
      //   }
      //   catch (e) {
      //   }
      // });

      request("http://bugzilla.mozilla.org/rest/bug/" + depends_on_list[bugIndex] + "?include_fields=id,status,summary,assigned_to", function(error, response, body) {
        try {
          var parsedResult = JSON.parse(body);

          if (parsedResult.bugs) {
            var trackedBug = parsedResult.bugs[0];

            if (trackedBug.status == 'RESOLVED' || trackedBug.status == 'VERIFIED') {
              // do nothing
            } else {
              allBugSummaries['' + trackedBug.id] = dashboard.formatForBugBox(trackedBug);
              dashboard.redrawBugs(allBugSummaries);
            }
          } else {
            // missing buglist!
            allBugSummaries['' + bugID] = bugID + ' missing bug info';   
          }
        }
        catch (e) {
          allBugSummaries['' + bugID] = bugID + ' error ' + e;   
          dashboard.redrawBugs(allBugSummaries);
        }
      });
    }
  });
}

function addEventsFromRepo(inRepoName) {
  github.events.getFromRepo( { 'user': 'mozilla', 'repo': inRepoName, per_page: 100 }, function(err, activities) {
    try {
      if (err) {
        throw new Error(err.message);
      }

      for (var activityIndex in activities) {
        var anActivity = activities[activityIndex];
        allEvents[anActivity.created_at] = dashboard.formatForEventBox(inRepoName, anActivity);
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

dashboard.initializeBlessedDashboard();
