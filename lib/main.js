// The main module of the twitchtv-stream-browser Add-on.

var Widget = require("widget").Widget;
var window = require("window/utils");
var windows = require("sdk/windows").browserWindows;
var tabs = require("tabs");
var self = require("sdk/self");
//var Request = require("sdk/request").Request;
var ss = require("sdk/simple-storage");
var timers = require("sdk/timers");
var notifications = require("sdk/notifications");
var twitchAPI = require("./twitchAPI");
//Check for the existence of the favList
if(!ss.storage.favList) {
    ss.storage.favList = {}; 
}
//Check for the existence of the settings
if(!ss.storage.settings) {
    ss.storage.settings = {}; 
	ss.storage.settings.notif = true;
	ss.storage.settings.popout = true;
	ss.storage.settings.status = true;
}

//Make a panel
var popup = require("panel").Panel({
    width:400,
    height:600,
    contentURL: self.data.url("all-games.html"),
	contentScriptFile: [self.data.url("js/jquery-1.9.1.js"), self.data.url("js/jquery.easytabs.min.js"), self.data.url("all-games-content.js")]
});

//Shows a message when the user is out of favourites quota (not likely to happen)
ss.on("OverQuota", function() {
    console.log("Quota exceeded for favourites storage. New favourites won't be saved.");
});

//Adding and removing favourites
popup.port.on("fav", function(name) {
	ss.storage.favList[name] = true;
	popup.port.emit("favList", ss.storage.favList);
});
popup.port.on("unfav", function(name) {
    delete ss.storage.favList[name];
	popup.port.emit("favList", ss.storage.favList);
});

//Notify the user of a favourite that is now online
function notify(display_name, name) {
	notifications.notify({
                title: "Twitch.tv stream browser",
                text: display_name +" is now online!",
				iconURL: self.data.url("twitch.png")
            });
	ss.storage.favList[name] = false;
}


//Open the stream but hide our popup
popup.port.on("click-link", function(link) {
    tabs.open(link);
    popup.hide();
});

function parseGamesAndAppend(response) {
	var nextURL = response.json._links.next;
	popup.port.emit("nextGamesURL", nextURL);
	var games = response.json.top;
	if (games == []) {
		//We have reached the end...
		return;
	}
	for(var i=0; i<games.length; i++) {
		var game = games[i];
		popup.port.emit("addGame", game);
	}
}

function parseStreamsAndAppend(response) {
	var nextURL = response.json._links.next;
	popup.port.emit("nextStreamsURL", nextURL);
	var streams = response.json.streams;
	if(streams == []) {
		//We have reached the end
		return;
	}
	
	for(var i=0; i<streams.length; i++) {
		var stream = streams[i];
		popup.port.emit("addStream", stream, false);
	}
}

function updateFavs() {
	popup.port.emit("resetFavs");
	twitchAPI.searchFavs(function(response) {
		var stream = response.json.stream;
		if( stream != null ) {
			var name = stream.channel.name;
			if( ss.storage.favList[name] && ss.storage.settings.notif == true) {
				notify( stream.channel.display_name, name );
			}
			popup.port.emit("addStream", stream, true);
		} else {
			var name = response.json._links.self.split("/");
			name = name[name.length-1];
			ss.storage.favList[name] = true;
		}
	}, ss.storage.favList);
	if(Object.keys(ss.storage.favList).length == 0) {
		stream = {"viewers": 0, "channel": {"name":"No Favourites", "status": "You have no favourites. Add some by clicking on a streamer's picture.", "display_name": "You have no favourites. Add some by clicking on a streamer's picture.", "url": "", "logo": self.data.url("twitch.png")}};
		popup.port.emit("addStream", stream, true);
	}
		
	
}

popup.port.on("getMoreGames", function(offset) {
	twitchAPI.getCurrentGames(parseGamesAndAppend, offset);
});
popup.port.on("getMoreStreams", function(offset, gameName) {
	twitchAPI.getCurrentStreamsByGame(parseStreamsAndAppend, gameName, offset);
});
popup.port.on("getFavourites", updateFavs);

popup.port.on("searchStreamers", function(searchText) {
	popup.port.emit("resetStreams");
	twitchAPI.searchStreamers(parseStreamsAndAppend, searchText);
});

popup.port.on("searchGames", function(searchText) {
	popup.port.emit("resetGames");
	twitchAPI.searchGames(function(response) {
		var games = response.json.games;
		if( games == [] ) {
			return;
		}
		for(var i=0; i<games.length; i++) {
			var game = new Object();
			game.game = games[i];
			popup.port.emit("addGame", game);
		}
	}, searchText);
});

popup.port.on("reloadGames", function() {
	startGames();
});

popup.port.on("popoutSetting", function(val) {
	ss.storage.settings.popout = val;
	popup.port.emit("settings", ss.storage.settings);
});
popup.port.on("notifSetting", function(val) {
	ss.storage.settings.notif = val;
	popup.port.emit("settings", ss.storage.settings);
});
popup.port.on("statusSetting", function(val) {
	ss.storage.settings.status = val;
	popup.port.emit("settings", ss.storage.settings);
});
popup.port.on("clearFavList", function() {
	ss.storage.favList = {};
});

//MAIN
//Setup the checking of the api for new streams
function startGames() {
	popup.port.emit("resetGames");
	twitchAPI.getCurrentGames(parseGamesAndAppend, 0);
}
popup.on("show", function() {
	startGames();
});
popup.port.on("reloadGames", function() {
	startGames();
});

//Check for updates every 5 minutes
timers.setInterval(updateFavs, 300000);

var wid = Widget({
    id: "widgetID1",
    label: "Twitch.tv Stream Browser Widget",
    contentURL: self.data.url("twitch.png"),
    //contentScriptFile: self.data.url("click-listener.js"),
    panel: popup
});

popup.port.on("gameClick", function(gameName) {
	popup.port.emit("favList", ss.storage.favList);
	popup.port.emit("resetStreams", gameName);
	twitchAPI.getCurrentStreamsByGame(parseStreamsAndAppend, gameName, 0);
		
});
popup.port.emit("favList", ss.storage.favList);
popup.port.emit("settings", ss.storage.settings);
popup.port.emit("logo", self.data.url("twitch.png"));