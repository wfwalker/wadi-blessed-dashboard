var dashboard = require('./dashboard.js');
var wadi = require('./wadi.js');

gHomeScreenStats = {};

// go find all the activity for wadi repo's

dashboard.initializeBlessedDashboard();

wadi.setDashboard(dashboard);

function trackWADIRepositories() {
  allEvents = {};
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

wadi.npmDownloads('oghliner', gHomeScreenStats);
wadi.getStargazers('mozilla', 'oghliner', 1, gHomeScreenStats);
wadi.getStargazers('mozilla', 'platatus', 1, gHomeScreenStats);
wadi.getStargazers('mozilla', 'serviceworker-cookbook', 1, gHomeScreenStats);

trackWADIRepositories();
setInterval(trackWADIRepositories, 300000);