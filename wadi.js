// Whole-script strict mode syntax
"use strict";

// SAMPLE USAGE
// SEKRIT=xxx BSEKRIT=yyy node wadi.js

var request = require('request');
var GitHub = require("github");
var util = require('util');
var dashboard = require('./dashboard.js');
var globalTimeout = 90000;

var gBugInfo = {};

var allEvents = {};

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
      dashboard.logString('multibug details error: ' + e);
    }
  });
}

function npmDownloads(inPackageName) {
  request({ uri: 'https://api.npmjs.org/downloads/point/last-month/' + inPackageName, strictSSL: false, timeout: globalTimeout }, function(error, response, body) {
    var parsedResult = JSON.parse(body);
    dashboard.logString(inPackageName + ', ' + parsedResult.downloads + ' downloads last 30 days');
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
        dashboard.logString('multibug details ' + inBugIDList.length + ' ' + parsedResult.bugs.length);

        for(var index = 0; index < parsedResult.bugs.length; index++) {
          var trackedBug = parsedResult.bugs[index];

          // and for each unresolved bug ID, go find info for that bug
          if (trackedBug.status != 'RESOLVED') {
            addAttachmentInfo(trackedBug.id);
            addHistoryInfo(trackedBug.id);
          }

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

function getStargazers(inUserName, inRepoName, inPageNum) {
  github.repos.getStargazers( { user: inUserName, repo: inRepoName, page: inPageNum, per_page: 100 }, function(err, stargazers) {
    if (stargazers.length < 100) {
      var stargazerCount = (inPageNum - 1) * 100 + stargazers.length;
      dashboard.logString(inUserName + '/' + inRepoName + ' has ' + stargazerCount + ' stargazers');
    } else {
      getStargazers(inUserName, inRepoName, inPageNum + 1);
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
        try {
          allEvents[anActivity.created_at] = dashboard.formatForEventBox(inRepoName, anActivity);
        }
        catch (e) {
          allEvents[anActivity.created_at] = 'ERROR ' + e;
        }
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

function trackWADIRepositories() {
  allEvents = {};
  addEventsFromRepo('mozilla', 'oghliner');
  addEventsFromRepo('mozilla', 'platatus');
  addEventsFromRepo('mozilla', 'serviceworker-cookbook');
  addEventsFromRepo('mozilla', 'progressive-apps-hq');
  addEventsFromRepo('marco-c', 'wp-web-push');
  addEventsFromRepo('darkwing', 'wp-sw-cache');
  addEventsFromRepo('marco-c', 'web-push');
  addEventsFromRepo('marco-c', 'mercurius');
}

addBugsTrackedBy(1201717); // web app developer initiative tracker
addBugsTrackedBy(1059784); // Ship Service Workers on desktop on the release channel
addBugsTrackedBy(1207262); // Ship Service Workers on Android on the release channel
addBugsTrackedBy(1003097); // Worker debugging
addBugsTrackedBy(1156054); // Implement Push API on Android
addBugsTrackedBy(1201571); // Tracking bug for Push Notifications 

npmDownloads('oghliner');
getStargazers('mozilla', 'oghliner', 1);

trackWADIRepositories();
setInterval(trackWADIRepositories, 300000);
