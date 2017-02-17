//This module handles the twitch API requests
var Request = require("sdk/request").Request;
//Interface definition
exports.getCurrentGames = getCurrentGames;
exports.getCurrentStreamsByGame = getCurrentStreamsByGame;
exports.searchFavs = searchFavs;
exports.searchStreamers = searchStreamers;
exports.searchGames = searchGames;
exports.getChannel = getChannel;
exports.getFollowedChannels = getFollowedChannels;
exports.getCurrentStreams = getCurrentStreams;

var httpHeaders = {
	'Accept': "application/vnd.twitchtv.v3+json",
	'Client-ID': "t163mfex6sggtq6ogh0fo8qcy9ybpd6"
};
	

function getCurrentGames(callbackFunc, offset) {
	var request = Request({
        url: "https://api.twitch.tv/kraken/games/top?offset="+offset+"&limit=25", 
        onComplete: callbackFunc,
		headers: httpHeaders
    });
	request.get();
}

function getCurrentStreamsByGame(callbackFunc, game, offset) {
	game.replace(" ", "+");
	var request = Request({
		url: "https://api.twitch.tv/kraken/streams?game="+game+"&offset="+offset+"&limit=25",
		onComplete: callbackFunc,
		headers: httpHeaders
	});
	request.get();
}

function searchStreamers(callbackFunc, searchText) {
	var request = Request({
		url: "https://api.twitch.tv/kraken/search/streams?q="+searchText,
		onComplete: callbackFunc,
		headers: httpHeaders
	});
	request.get();
}

function searchGames(callbackFunc, searchText) {

	var request = Request({
		url: "https://api.twitch.tv/kraken/search/games?q="+searchText+"&type=suggest&live=true",
		onComplete: callbackFunc,
		headers: httpHeaders
	});
	request.get();
}

function searchFavs(callbackFunc, favList) {
	
	for( var key in favList) {
		key.replace(" ", "");
		var request = Request({
			url: "https://api.twitch.tv/kraken/streams/"+key,
			onComplete: callbackFunc,
			headers: httpHeaders
		});
		request.get();
	}
}

function getChannel(callbackFunc, name) {
	var request = Request({
		url: "https://api.twitch.tv/kraken/channels/"+name,
		onComplete: callbackFunc,
		headers: httpHeaders
	});
	request.get();
}

function getFollowedChannels(callbackFunc, name, offset) {
	var request = Request({
		url: "https://api.twitch.tv/kraken/users/"+name+"/follows/channels?offset="+offset+"&limit=25&sortby=created_at&direction=DESC",
		onComplete: callbackFunc,
		headers: httpHeaders
	});
	request.get();
}

function getCurrentStreams(callbackFunc, offset) {
	var request = Request({
		url: "https://api.twitch.tv/kraken/streams?offset="+offset+"&limit=25",
		onComplete: callbackFunc,
		headers: httpHeaders
	});
	request.get();
}
