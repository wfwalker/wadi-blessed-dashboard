// Whole-script strict mode syntax
"use strict";

var request = require('request');
var GitHub = require("github");
var util = require('util');
var dashboard = require('./dashboard.js');
var globalTimeout = 90000;

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
    timeout: globalTimeout
  });

github.authenticate({
  type: "oauth",
  token: process.env.SEKRIT
});

// go find all the bugs we are tracking for WADI

// TODO get all history https://bugzilla.mozilla.org/rest/bug/707428/history
// TODO get attachments look for review status https://bugzilla.mozilla.org/rest/bug/707428/attachment

function addAttachmentInfo(inBugID) {
  var attachmentURL = "https://bugzilla.mozilla.org/rest/bug/" + inBugID + "/attachment?api_key=" + process.env.BSEKRIT;
  request({ uri: attachmentURL, timeout: globalTimeout }, function(error, response, body) {
    try {
      if (error) {
        throw new Error(error); 
      }
      if (response.statusCode != 200) {
        throw new Error('bad response ' + response.statusCode);
      }

      // try to parse the response and find the list of bugs
      var parsedResult = JSON.parse(body);

      if (parsedResult.error) {
        throw new Error(parsedResult.message);
      }

      var attachmentBugList = Object.keys(parsedResult.bugs);

      // if this attachments info includes a non-empty list of bugs ...
      if (attachmentBugList.length > 0) {
        // ... use the first one
        var tmpBugID = attachmentBugList[0];

        // ... if that first bug has a non-zero list of attachments 
        if (parsedResult.bugs[tmpBugID].length > 0) {
          var myAttachments = parsedResult.bugs[tmpBugID];

          // store them in the global dictionary
          allAttachmentData['' + tmpBugID] = myAttachments;

          var myPatches = myAttachments.filter(function (a) { return a.is_patch; });

          if (myPatches.length > 0) {
            dashboard.logString(tmpBugID + ' PATCHES');
          }

          // if we already have the bug details, go redo the summary
          if (allBugData['' + tmpBugID]) {
            allBugSummaries['' + tmpBugID] = dashboard.formatForBugBox(allBugData['' + tmpBugID], parsedResult.bugs['' + tmpBugID]);
            dashboard.redrawBugs(allBugSummaries, allBugData, allAttachmentData);            
          }
        }
      }      
    }
    catch (e) {
      dashboard.logString(inBugID + ' attachment error: ' + e);
    }
  });
}

function addPublicBugDetails(inBugIDList) {
  var idList = inBugIDList.join(',');
  var bugDataURL = "https://bugzilla.mozilla.org/rest/bug?bug_id=" + idList + "&bug_id_type=anyexact&f1=bug_group&o1=isempty&api_key=" + process.env.BSEKRIT;

  // TODO: filter the depends_on_list like this:
  // https://bugzilla.mozilla.org/rest/bug?bug_id=1186856,1188822,1189659,1200677,1201498,120166,1173240&bug_id_type=anyexact&f1=bug_group&o1=isempty      

  request({ uri: bugDataURL, timeout: globalTimeout }, function(error, response, body) {
    try {
      if (error) {
        throw new Error(error); 
      }

      var parsedResult = JSON.parse(body);

      if (parsedResult.error) {
        throw new Error(parsedResult.message);
      }

      if (response.statusCode != 200) {
        throw new Error('bad response ' + response.statusCode);
      }

      addBugDetails(parsedResult.bugs.map(function (a) { return a.id }));
    }
    catch (e) {
      dashboard.logString('multibug details error: ' + e);
    }
  });
}

function addBugDetails(inBugIDList) {
  var idList = inBugIDList.map(function(a) { return 'ids=' + a; }).join('&');
  var bugDataURL = "https://bugzilla.mozilla.org/rest/bug/?f1=bug_group&o1=isempty&include_fields=id,status,summary,assigned_to&" + idList + '&api_key=' + process.env.BSEKRIT;

  request({ uri: bugDataURL, timeout: globalTimeout }, function(error, response, body) {
    try {
      if (error) {
        throw new Error(error); 
      }

      var parsedResult = JSON.parse(body);

      if (parsedResult.error) {
        throw new Error(parsedResult.message);
      }

      if (response.statusCode != 200) {
        throw new Error('bad response ' + response.statusCode);
      }

      if (parsedResult.bugs) {
        dashboard.logString('multibug details ' + inBugIDList.length + ' ' + parsedResult.bugs.length);

        for(var index = 0; index < parsedResult.bugs.length; index++) {
          var trackedBug = parsedResult.bugs[index];

          allBugData['' + trackedBug.id] = trackedBug;
          allBugSummaries['' + trackedBug.id] = dashboard.formatForBugBox(trackedBug, allAttachmentData['' + trackedBug.id]);
          dashboard.redrawBugs(allBugSummaries, allBugData, allAttachmentData);
        }
      } else {
        dashboard.logString('multibug missing bug info ' + response.statusCode);
      }
    }
    catch (e) {
      dashboard.logString('multibug details error: ' + e);
    }
  });
}

function addBugsTrackedBy(inBugID) {
  var trackerURL = "https://bugzilla.mozilla.org/rest/bug/" + inBugID + "?f1=bug_group&o1=isempty&include_fields=id,depends_on&api_key=" + process.env.BSEKRIT;
  request({ uri: trackerURL, timeout: globalTimeout }, function(error, response, body) {
    if (error) {
      throw new Error(error); 
    }
    if (response.statusCode != 200) {
      throw new Error('bad response ' + response.statusCode);
    }

    try {
      var tracker = JSON.parse(body);

      if (tracker.error) {
        throw new Error(tracker.message);
      }

      var depends_on_list = tracker.bugs[0].depends_on;

      // add details for a whole list of bugs
      addPublicBugDetails(tracker.bugs[0].depends_on);

      // loop through the list of tracked bug ID's
      for (var bugIndex in depends_on_list) {
        var bugID = depends_on_list[bugIndex];

        // and for each tracked bug ID, go find info for that bug
        addAttachmentInfo(bugID);
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

addEventsFromRepo('oghliner');
addEventsFromRepo('platatus');
addEventsFromRepo('serviceworker-cookbook');

addBugsTrackedBy(1201717);
addBugsTrackedBy(1059784);

dashboard.logString('one ' + process.env.SEKRIT);
dashboard.logString('two ' + process.env.BSEKRIT);

