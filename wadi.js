// Whole-script strict mode syntax
"use strict";

var request = require('request');
var GitHub = require("github");
var util = require('util');
var dashboard = require('./dashboard.js');

var allEvents = {};
var allBugSummaries = {};
var allBugData = {};
var allAttachmentData = {};

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

function addAttachmentInfo(inBugID) {
  var attachmentURL = "https://bugzilla.mozilla.org/rest/bug/" + inBugID + "/attachment";
  request({ uri: attachmentURL, timeout: 30000 }, function(error, response, body) {
    try {
      if (error) {
        throw new Error(error); 
      }
      var parsedResult = JSON.parse(body);
      var attachmentBugList = Object.keys(parsedResult.bugs);

      if (attachmentBugList.length > 0) {
        var tmpBugID = attachmentBugList[0];
        if (parsedResult.bugs[tmpBugID].length > 0) {
          allAttachmentData[tmpBugID] = parsedResult.bugs[tmpBugID];
          allBugSummaries[tmpBugID] = dashboard.formatForBugBox(allBugData[tmpBugID], parsedResult.bugs[tmpBugID]);
          dashboard.redrawBugs(allBugSummaries, allBugData, allAttachmentData);
          dashboard.logString(tmpBugID, parsedResult.bugs[tmpBugID]);
        }
      }      
    }
    catch (e) {
      dashboard.logString(inBugID + ' attachment error: ' + e);
    }
  });
}

function addBugDetails(inBugID) {
  var bugDataURL = "https://bugzilla.mozilla.org/rest/bug/" + inBugID + "?include_fields=id,status,summary,assigned_to";
  request({ uri: bugDataURL, timeout: 30000 }, function(error, response, body) {
    try {
      if (error) {
        throw new Error(error); 
      }

      var parsedResult = JSON.parse(body);

      if (parsedResult.bugs) {
        var trackedBug = parsedResult.bugs[0];
        allBugData['' + trackedBug.id] = trackedBug;

        allBugSummaries['' + trackedBug.id] = dashboard.formatForBugBox(trackedBug, allAttachmentData[trackedBug.id]);
        dashboard.redrawBugs(allBugSummaries, allBugData, allAttachmentData);
      } else {
        // missing buglist!
        allBugSummaries['' + inBugID] = inBugID + ' missing bug info';   
        dashboard.logString(inBugID + ' missing bug info');
      }
    }
    catch (e) {
      allBugSummaries['' + inBugID] = inBugID + ' details error: ' + e;   
      dashboard.logString(inBugID + ' details error: ' + e);
    }
  });
}

function addBugsTrackedBy(inBugID) {
  request("https://bugzilla.mozilla.org/rest/bug/" + inBugID + "?include_fields=id,depends_on", function(error, response, body) {
    if (error) {
      throw new Error(error); 
    }

    try {
      var tracker = JSON.parse(body);
      var depends_on_list = tracker.bugs[0].depends_on;

      // loop through the list of tracked bug ID's
      for (var bugIndex in depends_on_list) {
        var bugID = depends_on_list[bugIndex];

        // and for each tracked bug ID, go find info for that bug
        addAttachmentInfo(bugID);
        addBugDetails(bugID);
      }      
    }
    catch (e) {
      dashboard.logString('cannot parse tracker ' + e);
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
      dashboard.logString('cannot parse events json ' + e);
      dashboard.logString(e.stack);
    }
  });
}

// go find all the activity for wadi repo's

dashboard.initializeBlessedDashboard();

dashboard.logString('starting');

addEventsFromRepo('oghliner');
addEventsFromRepo('platatus');
addEventsFromRepo('serviceworker-cookbook');

addBugsTrackedBy(1201717);
addBugsTrackedBy(1059784);

dashboard.logString('done starting');

