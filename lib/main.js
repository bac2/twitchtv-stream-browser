// The main module of the twitchtv-stream-browser Add-on.

var Widget = require("widget").Widget;
var { open } = require("window/utils");
var tabs = require("tabs");
var self = require("sdk/self");
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
	ss.storage.settings.showFlagged = false;
	ss.storage.settings.grouped = true;
}

//Make a panel
var popup = require("panel").Panel({
    width:400,
    height:600,
    contentURL: self.data.url("all-games.html"),
	contentScriptFile: [self.data.url("js/jquery-1.9.1.js"), self.data.url("js/jquery.easytabs.min.js"), self.data.url("js/jquery.contextMenu.js"), self.data.url("all-games-content.js")]
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
	if (response.status != 200) {
		console.error("Error: [" + response + "]");
		stream = {"viewers": 0, "game": {"name":"No Favourites", "status": "An error has occurred. Try again later.", "display_name": "An error has occurred. Try again later.", "url": "", "logo": {'small':self.data.url("twitch.png")}}};
		popup.port.emit("addStream", stream, false);
		return;
	}
	if (response.json.status && response.json.status != 200) {
		console.error("Error: [" + response.json.status + "] " + response.json.message);
		return;
	}
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
	if (response.status != 200) {
		console.error("Error: [" + response + "]");
		stream = {"viewers": 0, "channel": {"name":"No Favourites", "status": "An error has occurred. Try again later.", "display_name": "An error has occurred. Try again later.", "url": "", "logo": self.data.url("twitch.png")}};
		popup.port.emit("addStream", stream, false);
		return;
	}
	if(response.json.status && response.json.status != 200 ) {
		console.error("Error: [" + response.json.status + "] " + response.json.message);
		return;
	}
	var nextURL = response.json._links.next;
	popup.port.emit("nextStreamsURL", nextURL);
	var streams = response.json.streams;
	if(streams == []) {
		//We have reached the end
		popup.port.emit("streams-complete");
		return;
	}
	
	for(var i=0; i<streams.length; i++) {
		var stream = streams[i];
		popup.port.emit("addStream", stream, false);
	}
	popup.port.emit("streams-complete");
}

function updateFavs() {
	popup.port.emit("resetFavs");
	twitchAPI.searchFavs(function(response) {
		if( typeof response.json.status != 'undefined' && response.json.status != 200 ) {
			console.error("Error: [" + response.json.status + "] " + response.json.message);
			return;
		}
		var stream = response.json.stream;
		if( stream != null ) {
			var name = stream.channel.name;
			if( ss.storage.favList[name] && ss.storage.settings.notif == true) {
				notify( stream.channel.display_name, name );
			}
			if (stream.channel.abuse_reported && ss.settings.showFlagged == false) {
				//Don't show flagged streamers
				return;
			}
			popup.port.emit("addStream", stream, true);
		} else {
			var name = response.json._links.self.split("/");
			name = name[name.length-1];
			ss.storage.favList[name] = true;
			stream = { 'name': name, 'logo':self.data.url("twitch.png") };
			popup.port.emit("offlineFav", stream);
		}
	}, ss.storage.favList);
	if(Object.keys(ss.storage.favList).length == 0) {
		stream = {"viewers": "", "channel": {"name":"No Favourites", "game":"Error", "status": "You have no favourites. Add some by clicking on a streamer's picture.", "display_name": "You have no favourites. Add some by clicking on a streamer's picture.", "url": "", "logo": self.data.url("twitch.png")}};
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
		if( typeof response.json.status != 'undefined' && response.json.status != 200 ) {
			console.error("Error: [" + response.json.status + "] " + response.json.message);
			return;
		}
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
popup.port.on("flaggedSetting", function(val) {
	ss.storage.settings.showFlagged = val;
	popup.port.emit("settings", ss.storage.settings);
});
popup.port.on("groupingSetting", function(val) {
	ss.storage.settings.grouping = val;
	popup.port.emit("settings", ss.storage.settings);
});
popup.port.on("clearFavList", function() {
	ss.storage.favList = {};
});

popup.port.on("popout_chat", function(name) {
	url = "http://www.twitch.tv/chat/embed?channel="+name+"&popout_chat=true";
	var window = open(url, {
		name: name + " - Twitch Chat",
		features: {
			width: 400,
			height: 800,
			popup: false,
			resizable: true,
		}
	});
});

popup.port.on("findChannel", function(name) {
	twitchAPI.getChannel(function(response) {
		if ( typeof response.json.status != 'undefined' && (response.json.status == 404 || response.json.status == 422)) {
			popup.port.emit("foundChannel", false, name);
		} else {
			popup.port.emit("foundChannel", true, name);
		}
	}, name);
});
//MAIN
//Setup the checking of the api for new streams
function startGames() {
	popup.port.emit("resetGames");
	twitchAPI.getCurrentGames(parseGamesAndAppend, 0);
}
popup.on("show", function() {
	popup.port.emit("show");
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
