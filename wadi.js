var request = require('request');

var blessed = require('blessed');
var contrib = require('blessed-contrib');

var screen = blessed.screen();
var grid = new contrib.grid({rows: 2, cols: 1, screen: screen});

var line = grid.set(0, 0, 1, 1, contrib.line, {
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

for (var index = 0; index < 50; index++) {
    data.x.push('t'+index);
    data.y.push(Math.floor(Math.random() * 10));
}

screen.append(line);
line.setData([data]);

var bugList = grid.set(1, 0, 1, 1, contrib.table, {
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

screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    return process.exit(0);
});

screen.render();

request("http://bugzilla.mozilla.org/rest/bug/1201717", function(error, response, body) {
    var tracker = JSON.parse(body);
    var depends_on_list = tracker.bugs[0].depends_on;

    for (var bugIndex in depends_on_list) {
        var bugID = depends_on_list[bugIndex];

        request("http://bugzilla.mozilla.org/rest/bug/" + depends_on_list[bugIndex], function(error, response, body) {
            var trackedBug = JSON.parse(body).bugs[0];
            bugListData.data.push([trackedBug.id, trackedBug.status, trackedBug.summary]);
            bugList.setData(bugListData);
        });
    }

});


setInterval(function() {
    line.setLabel(new Date().toString());

    data.y.shift();
    data.y.push(Math.floor(Math.random() * 10));

    line.setData([data]);

    screen.render();
}, 5000);