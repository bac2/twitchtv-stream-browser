//This module handles the twitch API requests
var Request = require("sdk/request").Request;
//Interface definition
exports.getCurrentGames = getCurrentGames;
exports.getCurrentStreamsByGame = getCurrentStreamsByGame;
exports.searchFavs = searchFavs;
exports.searchStreamers = searchStreamers;
exports.searchGames = searchGames;

function getCurrentGames(callbackFunc, offset) {
	var request = Request({
        url: "https://api.twitch.tv/kraken/games/top?offset="+offset+"&limit=25", 
        onComplete: callbackFunc
    });
	request.get();
}

function getCurrentStreamsByGame(callbackFunc, game, offset) {
	game.replace(" ", "+");
	var request = Request({
		url: "https://api.twitch.tv/kraken/streams?game="+game+"&offset="+offset+"&limit=25",
		onComplete: callbackFunc
	});
	request.get();
}

function searchStreamers(callbackFunc, searchText) {
	var request = Request({
		url: "https://api.twitch.tv/kraken/search/streams?q="+searchText,
		onComplete: callbackFunc
	});
	request.get();
}

function searchGames(callbackFunc, searchText) {

	var request = Request({
		url: "https://api.twitch.tv/kraken/search/games?q="+searchText+"&type=suggest&live=true",
		onComplete: callbackFunc
	});
	request.get();
}

function searchFavs(callbackFunc, favList) {
	
	for( var key in favList) {
		key.replace(" ", "");
		var request = Request({
			url: "https://api.twitch.tv/kraken/streams/"+key,
			onComplete: callbackFunc
		});
		request.get();
	}
}


	