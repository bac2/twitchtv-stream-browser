// The main module of the twitchtv-stream-browser Add-on.


var tabs = require("sdk/tabs");
var self = require("sdk/self");
var ss = require("sdk/simple-storage");
var timers = require("sdk/timers");
var notifications = require("sdk/notifications");
var twitchAPI = require("./twitchAPI");
var twitchLogoUrl = "./twitch64.png";

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
	ss.storage.settings.grouping = true;
	ss.storage.settings.sound = false;
}

//Make a panel
var popup = require("sdk/panel").Panel({
    width:390,
    height:600,
    contentURL: self.data.url("all-games_new.html"),
	contentScriptFile: [self.data.url("js/jquery-1.9.1.js"), self.data.url("js/jquery.easytabs.min.js"), self.data.url("js/jquery.contextMenu.js"), self.data.url("js/jquery.tooltipster.min.js"), self.data.url("all-games-content.js")],
	onHide: handleHide,
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
var queued_notifications = [];
var timer;
function notify(display_name, name) {
	queued_notifications.push(name);
	timers.clearTimeout(timer);
	timer = timers.setTimeout(function () {
		var notif_text = queued_notifications.join(", ");
		
		if (queued_notifications.length > 1) {
			notif_text += " are now online!";
		} else {
			notif_text += " is now online!";
		}
		notifications.notify({
			title: "Twitch.tv stream browser",
			text: notif_text,
			iconURL: self.data.url(twitchLogoUrl)
		});
		queued_notifications = [];
		
		if (ss.storage.settings.sound) {
			require("sdk/page-worker").Page({
				contentScript: "new Audio('notif_sound.mp3').play()",
				contentURL: self.data.url("blank.html"),
			});
		}
	}, 500);
	ss.storage.favList[name] = false;

}


//Open the stream but hide our popup
popup.port.on("click-link", function(link) {
    tabs.open(link);
    popup.hide();
});

function parseGamesAndAppend(response) {
	if (response.status != 200) {
		console.error("Error: [" + response.status + "]");
		stream = {"viewers": 0, "game": {"name":"No Favourites", "status": "An error has occurred. Try again later.", "display_name": "An error has occurred. Try again later.", "url": "", "logo": {'small':self.data.url(twitchLogoUrl)}}};
		popup.port.emit("addGame", stream, false);
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
		console.error("Error: [" + response.status + "]");
		stream = {"viewers": 0, "channel": {"name":"No Favourites", "status": "An error has occurred. Try again later.", "display_name": "An error has occurred. Try again later.", "url": "", "logo": self.data.url(twitchLogoUrl)}};
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

function parseCurrentStreamsAndAppend(response) {
	if (response.status != 200) {
		console.error("Error: [" + response.status + "] when calling getCurrentStreams");
	}
	
	var nextURL = response.json._links.next;
	popup.port.emit("nextCurrentStreamsURL", nextURL);
	var streams = response.json.streams;
	if (streams == []) {
		//No more streams
		popup.port.emit("currentStreams-complete");
		return;
	}
	
	for (var i = 0; i < streams.length; i++) {
		var stream = streams[i];
		popup.port.emit("addCurrentStream", stream);
	}
	popup.port.emit("currentStreams-complete");
}

function updateFavs() {
	popup.port.emit("resetFavs");
	var onlineCount = 0;
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
			onlineCount += 1;
			popup.port.emit("updateFavs", onlineCount);
		} else {
			var name = response.json._links.self.split("/");
			name = name[name.length-1];
			ss.storage.favList[name] = true;
			stream = { 'name': name, 'logo':self.data.url(twitchLogoUrl) };
			popup.port.emit("offlineFav", stream);
		}
	}, ss.storage.favList);
	if(Object.keys(ss.storage.favList).length == 0) {
		stream = {"viewers": "", "channel": {"name":"No Favourites", "game":"Error", "status": "You have no favourites. Add some by clicking on a streamer's picture.", "display_name": "You have no favourites. Add some by clicking on a streamer's picture.", "url": "", "logo": self.data.url(twitchLogoUrl)}};
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
popup.port.on("getCurrentStreams", function(offset) {
	twitchAPI.getCurrentStreams(parseCurrentStreamsAndAppend, offset);
});

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
popup.port.on("soundSetting", function(val) {
	ss.storage.settings.sound = val;
	popup.port.emit("settings", ss.storage.settings);
});

popup.port.on("clearFavList", function() {
	ss.storage.favList = {};
});
popup.port.on("importFollowers", importFollowers);

function importFollowers(name, offset, added) {
	twitchAPI.getFollowedChannels(function (response) {
		if( typeof response.json.status != 'undefined' && response.json.status != 200 ) {
			console.error("Error: [" + response.json.status + "] " + response.json.message);
			return;
		}
		var follows = response.json.follows;
		for (var i=0; i<follows.length; i++) {
			var item = follows[i];
			var channelName = item.channel.name;
			
			if (!ss.storage.favList.hasOwnProperty(name)) {
				ss.storage.favList[channelName] = true;
				popup.port.emit("favList", ss.storage.favList);
				added += 1;
			}
		}
		// Get more if they exist
		console.log("About to check for more followers: " + offset + "/" + response.json._total);
		if (response.json._total > (offset + 25)) {
			console.log("Checking name " + name + " with offset " + offset);
			importFollowers(name, offset + 25, added);
		} else {
			popup.port.emit("import_success", added);
		}
	}, name, offset);
}

popup.port.on("popout_chat", function(name) {
	url = "http://www.twitch.tv/chat/embed?channel="+name+"&popout_chat=true";
	tabs.open(url);
//	var window = open(url, {
//		name: name + " - Twitch Chat",
//		features: {
//			width: 400,
//			height: 800,
//			popup: false,
//			resizable: true,
//		}
//	});
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
updateFavs();

var { ToggleButton } = require('sdk/ui/button/toggle');


var wid = ToggleButton({
	id: "twitchToggle",
	label: "Twitch.tv Stream Browser",
	icon: { 
		"32": "./twitch48.png",
		"64": "./twitch64.png"
	},
	onChange: openPopup,
});
wid.state.checked = true;
function openPopup(state) {
	if (state.checked) {
		popup.show({
			position: wid
		});
	}
}
function handleHide(state) {
	wid.state('window', {checked:false});
}

popup.port.on("gameClick", function(gameName) {
	popup.port.emit("favList", ss.storage.favList);
	popup.port.emit("resetStreams", gameName);
	twitchAPI.getCurrentStreamsByGame(parseStreamsAndAppend, gameName, 0);
		
});
popup.port.emit("favList", ss.storage.favList);
popup.port.emit("settings", ss.storage.settings);
popup.port.emit("logo", self.data.url("twitch48.png"));
