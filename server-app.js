var dashboard = require('./mock-dashboard.js');
var wadi = require('./wadi.js');

var express = require('express');
var expressHandlebars  = require('express-handlebars');

// go find all the activity for wadi repo's

var gRepositories = [
  { user: 'mozilla', repo: 'oghliner' },
  { user: 'mozilla', repo: 'platatus' },
  { user: 'mozilla', repo: 'serviceworker-cookbook' },
  { user: 'mozilla', repo: 'progressive-apps-hq' },
  { user: 'marco-c', repo: 'wp-web-push' },
  { user: 'marco-c', repo: 'web-push' },
  { user: 'marco-c', repo: 'mercurius' },
  { user: 'darkwing', repo: 'wp-sw-cache' },
];

wadi.setDashboard(dashboard);

function trackWADIRepositories() {
  gRepositories.forEach(function (r) {
      wadi.addEventsFromRepo(r.user, r.repo);
  });
}

wadi.addBugsTrackedBy(1201717); // web app developer initiative tracker
wadi.addBugsTrackedBy(1059784); // Ship Service Workers on desktop on the release channel
wadi.addBugsTrackedBy(1207262); // Ship Service Workers on Android on the release channel
wadi.addBugsTrackedBy(1003097); // Worker debugging
wadi.addBugsTrackedBy(1156054); // Implement Push API on Android
wadi.addBugsTrackedBy(1201571); // Tracking bug for Push Notifications 

gHomeScreenStats = {};

wadi.npmDownloads('oghliner', gHomeScreenStats);

gRepositories.forEach(function(r) {
  wadi.getStargazers(r.user, r.repo, 1, gHomeScreenStats);
});

trackWADIRepositories();
setInterval(trackWADIRepositories, 300000);

var server = express();

server.engine('handlebars', expressHandlebars({
  defaultLayout: 'main',
  helpers: {
    toJSON : function(object) {
      return JSON.stringify(object);
    },
    truncate : function(inString, inLength) {
      if (inString) {
        return inString.substring(0, inLength);
      } else {
        return inString;
      }
    },
  }
}));

server.set('view engine', 'handlebars');

server.get('/home', function (req, res) {
    console.log(JSON.stringify(gHomeScreenStats));
    res.render('home', {stats: gHomeScreenStats});
});

server.get('/bugs', function (req, res) {
  var bugDictionary = wadi.getAllBugInfo();
  var keys = Object.keys(bugDictionary);
  var bugArray = keys.map(function (k) { return bugDictionary[k]; });
  var sortedBugs = bugArray.sort(function(x, y) {
    if (x.latest < y.latest) {
      return 1;
    } else if (x.latest > y.latest) {
      return -1;
    } else {
      return 0;
    }
  });

  res.render('bugs', {bugs: sortedBugs});
});

server.get('/events', function (req, res) {
  var events = wadi.getAllEvents();
  var keys = Object.keys(wadi.getAllEvents());

  keys.sort();
  keys.reverse();

  var sortedEvents = keys.map(function (k) { return events[k]; } );

  res.render('events', {events: sortedEvents});
});

server.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});