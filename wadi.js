var request = require('request');

var blessed = require('blessed');
var contrib = require('blessed-contrib');

// set up a grid with two rows and one column

var screen = blessed.screen();
var grid = new contrib.grid({rows: 2, cols: 2, screen: screen});

// create a line graph

var line = grid.set(0, 0, 1, 2, contrib.line, {
    style: {
	line: "yellow",
	text: "green",
	baseline: "black"
    },
    xLabelPadding: 3,
    xPadding: 5
});

var data = {
    x: [],
    y: []
};

// initialize the line graph with random data

for (var index = 0; index < 50; index++) {
    data.x.push('t'+index);
    data.y.push(Math.floor(Math.random() * 10));
}

screen.append(line);
line.setData([data]);

// create a table for bugzilla bugs

var bugList = grid.set(1, 0, 1, 2, contrib.table, {
    keys: true,
    fg: 'white',
    label: 'wadi bugs',
    columnWidth: [10, 10, 150]
});

var bugListData = {
    headers: ['id', 'status', 'title'],
    data: [ ]
};

screen.append(bugList);
bugList.setData(bugListData);

// create table for github activity

var githubActivity = grid.set(0, 1, 1, 1, contrib.table, {
    keys: true,
    fg: 'white',
    label: 'github activity',
    columnWidth: [20, 150]
})

var githubActivityData = {
    headers: ['id', 'title'],
    data: [ ]
};

screen.append(githubActivity);
githubActivity.setData(githubActivityData);

// make sure its possible to exit

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    return process.exit(0);
});

// first screen render

screen.render();

// go find all the bugs we are tracking for WADI

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
            bugListData.data.push([trackedBug.id, trackedBug.status, trackedBug.summary]);
            bugList.setData(bugListData);
        });
    }

});

// go find all the activity for wadi repo's

var githubApiOptions = {
  url: 'https://api.github.com/repos/mozilla/wadi/events',
  headers: {
    'User-Agent': 'wfwalker'
  }
};

request(githubApiOptions, function(error, response, body) {
    try {
        var activities = JSON.parse(body);
        for (var activityIndex in activities) {
            var anActivity = activities[activityIndex];
            githubActivityData.data.push([anActivity.created_at, anActivity.type]);
            githubActivity.setData(githubActivityData);
        }
    }
    catch(e) {
        console.log('cannot parse events json', e);
    }
});


// on a recurring basis, update the display of random values and re-render

setInterval(function() {
    line.setLabel(new Date().toString());

    data.y.shift();
    data.y.push(Math.floor(Math.random() * 10));

    line.setData([data]);

    screen.render();
}, 5000);