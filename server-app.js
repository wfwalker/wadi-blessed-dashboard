var dashboard = require('./mock-dashboard.js');
var wadi = require('./wadi.js');


// go find all the activity for wadi repo's

wadi.setDashboard(dashboard);

function trackWADIRepositories() {
  wadi.addEventsFromRepo('mozilla', 'oghliner');
  wadi.addEventsFromRepo('mozilla', 'platatus');
  wadi.addEventsFromRepo('mozilla', 'serviceworker-cookbook');
  wadi.addEventsFromRepo('mozilla', 'progressive-apps-hq');
  wadi.addEventsFromRepo('marco-c', 'wp-web-push');
  wadi.addEventsFromRepo('darkwing', 'wp-sw-cache');
  wadi.addEventsFromRepo('marco-c', 'web-push');
  wadi.addEventsFromRepo('marco-c', 'mercurius');
}

wadi.addBugsTrackedBy(1201717); // web app developer initiative tracker
wadi.addBugsTrackedBy(1059784); // Ship Service Workers on desktop on the release channel
wadi.addBugsTrackedBy(1207262); // Ship Service Workers on Android on the release channel
wadi.addBugsTrackedBy(1003097); // Worker debugging
wadi.addBugsTrackedBy(1156054); // Implement Push API on Android
wadi.addBugsTrackedBy(1201571); // Tracking bug for Push Notifications 

wadi.npmDownloads('oghliner');
wadi.getStargazers('mozilla', 'oghliner', 1);
wadi.getStargazers('mozilla', 'platatus', 1);
wadi.getStargazers('mozilla', 'serviceworker-cookbook', 1);

trackWADIRepositories();
setInterval(trackWADIRepositories, 300000);

var express = require('express');
var server = express();

server.get('/', function (req, res) {
  res.send(JSON.stringify(wadi.getAllBugInfo()));
});

server.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});