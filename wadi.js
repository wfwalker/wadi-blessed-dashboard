// Whole-script strict mode syntax
"use strict";

// SAMPLE USAGE
// SEKRIT=xxx BSEKRIT=yyy node wadi.js

var request = require('request');
var GitHub = require("github");
var util = require('util');
var dashboard = null;
var globalTimeout = 90000;

var gBugInfo = {};

var allEvents = {};

function setDashboard(inDashboard) {
  dashboard = inDashboard;
}

function getAllEvents() {
  return allEvents;
}

function getAllBugInfo() {
  return gBugInfo;
}

function updateSummary(inBugID) {
  var tmpInfo = getBugInfo(inBugID);

  if (tmpInfo.data && (tmpInfo.data.status != 'RESOLVED') && (tmpInfo.data.status != 'VERIFIED')) {
    getBugInfo(inBugID).summary = dashboard.formatForBugBox(tmpInfo);
    dashboard.redrawBugs(gBugInfo);
  }    
}

function getBugInfo(inBugID) {
  if (! gBugInfo['' + inBugID]) {
    gBugInfo['' + inBugID] = { latest: 'unknown', summary: null, data: null, attachments: null, history: null };
  }

  return gBugInfo['' + inBugID];
}

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

function addHistoryInfo(inBugID) {
  var historyURL = "https://bugzilla.mozilla.org/rest/bug/" + inBugID + "/history?api_key=" + process.env.BSEKRIT;
  request({ uri: historyURL, strictSSL: false, timeout: globalTimeout }, function(error, response, body) {
    try {
      if (error) {
        throw new Error(error); 
      }
      if (response.statusCode != 200) {
        throw new Error('bad response ' + response.statusCode);
      }

      // try to parse the response and find the list of bugs
      var parsedResult = JSON.parse(body);

      if (parsedResult == null) {
        throw new Error('cannot parse body');
      }

      if (parsedResult.error) {
        throw new Error(parsedResult.message);
      }

      // if this attachments info includes a bug id...
      if (parsedResult.bugs[0].id) {
        // ... use it
        var tmpBugID = parsedResult.bugs[0].id;

        // ... if there's a history list 
        if (parsedResult.bugs[0].history && parsedResult.bugs[0].history.length > 0) {
          var myHistory = parsedResult.bugs[0].history;

          // store them in the global dictionary
          getBugInfo(tmpBugID).history = myHistory;

          var latest = myHistory[0].when;

          if (myHistory.length > 1) {
            latest = myHistory.reduce(function (x, y, i) {
              if (x.when > y.when) {
                return x.when;
              } else {
                return y.when;
              }
            });
          }

          getBugInfo(tmpBugID).latest = latest;

          // if we already have the bug details, go redo the summary
          if (getBugInfo(tmpBugID).data) {
            updateSummary(tmpBugID);
          }
        } else {
          dashboard.logString('no history or empty history');
        }
      }      
    }
    catch (e) {
      dashboard.logString(inBugID + ' history error: ' + e);
    }
  });
}

function addAttachmentInfo(inBugID) {
  var attachmentURL = "https://bugzilla.mozilla.org/rest/bug/" + inBugID + "/attachment?api_key=" + process.env.BSEKRIT;
  request({ uri: attachmentURL, strictSSL: false, timeout: globalTimeout }, function(error, response, body) {
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
          var myPatches = myAttachments.filter(function (a) { return a.is_patch; });

          // store them in the global dictionary
          getBugInfo(tmpBugID).attachments = myAttachments;
          getBugInfo(tmpBugID).patches = myPatches;

          // if we already have the bug details, go redo the summary
          if (getBugInfo(tmpBugID).data) {
            updateSummary(tmpBugID);
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

  request({ uri: bugDataURL, strictSSL: false, timeout: globalTimeout }, function(error, response, body) {
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

      var publicWantedList = parsedResult.bugs.map(function (a) { return a.id });
      addBugDetails(publicWantedList);
    }
    catch (e) {
      dashboard.logString('retrying multibug details error: ' + e);
      addPublicBugDetails(inBugIDList);
    }
  });
}

function npmDownloads(inPackageName, inResults) {
  request({ uri: 'https://api.npmjs.org/downloads/point/last-month/' + inPackageName, strictSSL: false, timeout: globalTimeout }, function(error, response, body) {
    var parsedResult = JSON.parse(body);
    dashboard.logString(inPackageName + ', ' + parsedResult.downloads + ' downloads last 30 days');
    inResults['npm downloads for ' + inPackageName] = parsedResult.downloads;
  });
}

function addBugDetails(inBugIDList) {
  var idList = inBugIDList.map(function(a) { return 'ids=' + a; }).join('&');
  var bugDataURL = "https://bugzilla.mozilla.org/rest/bug/?f1=bug_group&o1=isempty&include_fields=id,status,summary,assigned_to&" + idList + '&api_key=' + process.env.BSEKRIT;

  request({ uri: bugDataURL, strictSSL: false, timeout: globalTimeout }, function(error, response, body) {
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
        for(var index = 0; index < parsedResult.bugs.length; index++) {
          var trackedBug = parsedResult.bugs[index];

          // and for each unresolved bug ID, go find info for that bug
          if (trackedBug.status != 'RESOLVED') {
            addAttachmentInfo(trackedBug.id);
          }

          addHistoryInfo(trackedBug.id);
          getBugInfo(trackedBug.id).data = trackedBug;
          updateSummary(trackedBug.id);
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
  request({ uri: trackerURL, strictSSL: false, timeout: globalTimeout }, function(error, response, body) {
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

      var wanted_list = tracker.bugs[0].depends_on;
      wanted_list.push(inBugID);

      // add details for a whole list of bugs
      addPublicBugDetails(wanted_list);
    }
    catch (e) {
      dashboard.logString('cannot parse tracker ' + e);
    }
  });
}

function getStargazers(inUserName, inRepoName, inPageNum, inResults) {
  github.repos.getStargazers({ user: inUserName, repo: inRepoName, page: inPageNum, per_page: 100 }, function(err, stargazers) {
    try {
      if (err) {
        throw new Error(err.message);
      }

      if (stargazers.length < 100) {
        var stargazerCount = (inPageNum - 1) * 100 + stargazers.length;
        dashboard.logString(inUserName + '/' + inRepoName + ' has ' + stargazerCount + ' stargazers');
        inResults['stargazers for ' + inRepoName] = stargazerCount;
      } else {
        getStargazers(inUserName, inRepoName, inPageNum + 1, inResults);
      }
    }
    catch(e) {
      dashboard.logString('retrying count stars ' + e);
      getStargazers(inUserName, inRepoName, inPageNum, inResults)
    }
  });
};

function addEventsFromRepo(inUserName, inRepoName) {
  github.events.getFromRepo( { 'user': inUserName, 'repo': inRepoName, per_page: 100 }, function(err, activities) {
    try {
      if (err) {
        throw new Error(err.message);
      }

      for (var activityIndex in activities) {
        var anActivity = activities[activityIndex];
        if (anActivity['x-ratelimit-limit']) {
          console.log('rate limit info', anActivity['x-ratelimit-remaining'], '/', anActivity['x-ratelimit-limit']);
        } else if (! anActivity.type) {
          console.log('missing type', inUserName, inRepoName, JSON.stringify(anActivity));
        } else {
          allEvents[anActivity.created_at] = dashboard.formatForEventBox(inRepoName, anActivity);          
        }
      }

      dashboard.redrawEvents(allEvents);
    }
    catch(e) {
      dashboard.logString('cannot parse events json ' + e);
    }
  });
}

module.exports.setDashboard = setDashboard;
module.exports.getAllEvents = getAllEvents;
module.exports.getAllBugInfo = getAllBugInfo;

module.exports.addEventsFromRepo = addEventsFromRepo;
module.exports.addBugsTrackedBy = addBugsTrackedBy;
module.exports.npmDownloads = npmDownloads;
module.exports.getStargazers = getStargazers;
