var favList = {};
var settings = {};
//Adds a game to the current games list
function addGameToList(gameObj) {
	var html = jsonToDOM(["li", {class: "stream-link"}, 
							["a", {class:"link", href: ""},
								["img", {src: gameObj.game.logo.small, class:"gameLogo"}],
								["span", {class:"status"}, gameObj.game.name],
								["span", {class:"viewers", style: "display: none;"}, gameObj.viewers]
							]
						], document, {});
	$("#games-list").append(html);
	
	$(html).children(".link").click(function(event) {
		var clickTarget = event.target;
		if(clickTarget.nodeName == "SPAN" || clickTarget.nodeName == "IMG") {
			clickTarget = clickTarget.parentNode;
		}
		
		clickTarget = clickTarget.getElementsByClassName("status")[0];
		self.port.emit("gameClick", clickTarget.innerHTML);
		event.preventDefault();
		event.stopPropagation();
	});
	$(".wrapper").animate({
		height: $("#games").css("height")
	}, 10);
}
self.port.on("addGame", addGameToList);

//Removes all content from the list
function resetGamesList() {
	$("#games-list").empty();
	if( $("#games").css("left") != "0" ) {
		return;
	}
	$(".wrapper").animate({
		height: $("#games").css("left") != "0" ?
			$("#games").css("height") :
			$("#streams").css("height"),
		left: parseInt($("#games").css('left'),10) == 0 ?
			$("#games").outerWidth()+5 :
			"0px"
	}, 1000);
}
self.port.on("resetGames", resetGamesList);

//Clicked on next games
function nextGamesClick(event) {
	//Get more games
	//Target is the more div
	var offset = event.target.getAttribute("next-offset");
	self.port.emit("getMoreGames", offset);
	event.stopPropagation();
	event.preventDefault();
}

function setNextGamesURL(offset) {
	var nextLink = document.getElementById("next-link-games");
	nextLink.firstChild.setAttribute("next-offset", offset) //link
}
self.port.on("nextGamesURL", setNextGamesURL);

function addStreamToList(stream, favourites) {
	var popout_url = "",
		gameName = "";
	if( settings.popout == true) {
		popout_url = stream.channel.url + "/popout";
	} else {
		popout_url = stream.channel.url;
	}
	var html = jsonToDOM(["li", {class: "stream-link"}, 
							["a", {class:"link", href: popout_url},
								["img", {src: stream.channel.logo, class:"gameLogo"}],
								["span", {class:"status"}, stream.channel.status],
								["span", {class:"display_name"}, stream.channel.display_name],
								["span", {class:"name", style:"display: none;"}, stream.channel.name],
								["span", {class:"viewers"}, stream.viewers]
							]
						], document, {});
	if(favourites) { //On the favourites tab
		
		console.log("Game: "+ gameName + " grouped: " + settings.grouped);
		if (settings.grouped) {
			gameName = stream.channel.game;
			gameName = gameName.replace(/([^A-Za-z0-9-_])/g, "_");
			if ($("#game-"+gameName).length > 0) {
				insertToList(html, $("#game-"+gameName));
			} else {
				var domList = jsonToDOM(['ul', {id: "game-"+gameName}], document, {});
				$("#favStreamersList").append(domList);
				$("#game-"+gameName).prepend( jsonToDOM( ['span', {class:"allTitle"}, stream.channel.game], document, {}));
				insertToList(html, $("#game-"+gameName));
				console.log("created " + $("#favStreamersList").html());
			}
		} else {
			insertToList(html, $("#favStreamersList"));
			$("#onlineTitle").show();
		}
		$("#favStreamersList").show();

	} else if (favList[stream.channel.name] == true || favList[stream.channel.name] == false) {
		$("#favouritesList").append(html);
	} else {
		$("#streams-list").append(html);
	}
	if( settings.status == true) {
		$(html).find(".display_name").hide();
		$(html).find(".status").show();
	} else {
		$(html).find(".display_name").show();
		$(html).find(".status").hide();
	}
	$(html).children(".link").click(function(event) {
		self.port.emit("click-link", $(this).attr("href"));
		event.preventDefault();
		event.stopPropagation();
	});
	
	$(html).find("img").click(changeFavouriteState);
	
}
self.port.on("addStream", addStreamToList);

function addOfflineFavToList(stream) {
	var html = jsonToDOM(["li", {class: "stream-link"}, 
							["a", {class:"link", href: "#"},
								["img", {src: stream.logo, class:"gameLogo"}],
								["span", {class:"status"}, stream.name],
								["span", {class:"display_name"}, stream.name],
								["span", {class:"name", style:"display: none;"}, stream.name],
								["span", {class:"viewers"}, ""]
							]
						], document, {});
	$("#offlineTitle").show();
	if( settings.status == true) {
		$(html).find(".display_name").hide();
		$(html).find(".status").show();
	} else {
		$(html).find(".display_name").show();
		$(html).find(".status").hide();
	}
	$(html).find("img").click(changeFavouriteState);
	insertToList(html, $("#offlineFavsList"));
}

self.port.on("offlineFav", addOfflineFavToList);
self.port.on("streams-complete", function() {
	//At the end of the streams we know the size
	$(".wrapper").animate({
		height: $("#streams").css("height")
	}, 10);
});

function resetStreamsList(gameName) {
	$("#streams-list").empty();
	$("#favouritesList").empty();
	$("#gameName").html(gameName);
	
	if( $(".wrapper").css("left") != "0px" ) {
		//Do nothing. We're already on streams side
	} else {
		$(".wrapper").animate({
			left: parseInt($("#games").css('left'),10) == 0 ?
				-$("#games").outerWidth()-5 :
				"0px"
		}, {
			duration: 1000,
			queue: false
		});
		$("html, body").animate({
			scrollTop: $("html, body").offset().top
		}, {
			queue: false,
			duration: 1000
		});
	}

}
self.port.on("resetStreams", resetStreamsList);

//Clicked on more games
function nextStreamsClick(event) {
	//Get more games
	//Target is the more div
	var offset = event.target.getAttribute("next-offset");
	var gameName = $("#gameName").html();
	self.port.emit("getMoreStreams", offset, gameName);
	setTimeout(function() {
		$(".wrapper").animate({
			height: $("#streams").css("height")
		}, 10);
	}, 600);
	event.stopPropagation();
	event.preventDefault();
}

function setNextStreamsURL(offset) {
	var nextLink = document.getElementById("next-link-streams");
	nextLink.firstChild.setAttribute("next-offset", offset); //link
}
self.port.on("nextStreamsURL", setNextStreamsURL);

function resetFavsList() {
	$("#favStreamersList").empty();
	$("#offlineFavsList").empty();
	$("#onlineTitle").hide();
	$("#offlineTitle").hide();
}
self.port.on("resetFavs", resetFavsList);

function changeFavouriteState(event) {
//Add favourites from here
	var li = $(this).parents("li")[0];
	var name = $(li).find(".name").html();

	var ulParent = $(li).parent();
	if( $(ulParent).attr("id") == "streams-list") {
		//Non favourite
		//Make it a favourite
		self.port.emit("fav", name);
		insertToList(li, $("#favouritesList"));
	} else {
		//Favourite
		//Make it regular
		self.port.emit("unfav", name);
		insertToList(li, $("#streams-list"));
	}
	
	event.preventDefault();
	event.stopPropagation();
}

function insertToList(li, listul) {
	children = $(listul).children();
	var currentViewers = parseInt($(li).find(".viewers").html(), 10);
	
	if(children.length == 0) {
		$(listul).append(li);
		return;
	}
	for(var i=0; i<children.length; i++) {
		var child = children[i];
		var viewers = parseInt($(child).find(".viewers").html(), 10);

		if( currentViewers > viewers ) { //New element has more viewers
			$(li).insertBefore(child);
			break;
		}
		if( i == children.length-1 ) {
			//Last run
			$(listul).append(li);
		}
	}
	//If we get here then it is the final place
	//Inserted
}


self.port.on("favList", function(incFavList) {
	favList = incFavList;
});

self.port.on("settings", function(incSettings) {
	settings = incSettings;
	if(settings.notif == true) {
		$("#notifSetting").prop('checked', true);
	}
	if(settings.popout == true) {
		$("#popoutSetting").prop('checked', true);
	}
	if(settings.status == true) {
		$("#descripSetting").prop('checked', true);
	}
	if(settings.showFlagged == true) {
		$("#flaggedSetting").prop('checked', true);
	}
	if(settings.grouped == true) {
		$("#groupingSetting").prop('checked', true);
	}
});

self.port.on("logo", function(logo) {
	document.getElementById("logo").src = logo;
});

self.port.on("show", function() {
	if( parseInt($(".wrapper").css("left"),10) != 0 ) {
		var game = $("#gameName").html();
		self.port.emit("gameClick", game);
	} else {
		self.port.emit("reloadGames");
	}
});

self.port.on("foundChannel", function(found, name) {
	if (found) {
		if (favList[name] === true || favList[name] === false) {
			$("#favSearchStatus").text("Already a favourite");
		} else {
			self.port.emit("fav", name);
			$("#favSearchStatus").text("Added " + name);
			self.port.emit("getFavourites");
		}
	} else {
		$("#favSearchStatus").text(name + " not found");
	}
	$("#favSearchStatus").show();
	$("#favSearchStatus").fadeOut(3000);
	$("#favSearchText").val('');
});

$("#next-link-games").click(nextGamesClick);
$("#next-link-streams").click(nextStreamsClick);
$('#tab-container').easytabs({animate: false});

$(".back").click(function(event) {
	$(".wrapper").animate({
	  height: $("#games").css("height"),
	  left: "0px"
	}, 1000);
	event.preventDefault();
	event.stopPropagation();
});

$("#favsLink").click(function(event) {
	self.port.emit("getFavourites");
});
$("#allLink").click(function() {
	//Ensure we get the right size, and it is done in the animation queue
	if( $(".wrapper").css("left") != "0px" ) {
		$(".wrapper").animate({
			height: $("#streams").css("height")
		}, 1);
	} else {
		$(".wrapper").animate({
			height: $("#games").css("height")
		}, 1);
	}
});

$("#streamSearch").click(function(event) {
	var text = $("#searchText").val();
	self.port.emit("searchStreamers", text);
});

$("#streamReload").click(function(event) {
	$("#searchText").val("");
	var game = $("#gameName").html();
	self.port.emit("gameClick", game);
	$(".wrapper").animate({
		height: $("#streams").css("height")
	}, 10);
});

$("#searchText").bind("keypress", function(event) {
	var key=event.keyCode || event.which;
	if (key==13) {
		var text = $("#searchText").val();
		self.port.emit("searchStreamers", text);
	}
});

$("#gameSearchText").bind("keypress", function(event) {
	var key=event.keyCode || event.which;
	if (key==13) {
		var text = $("#gameSearchText").val();
		self.port.emit("searchGames", text);
	}
});

$("#favSearchText").bind("keypress", function(event) {
	var key=event.keyCode || event.which;
	if (key==13) {
		var text = $("#favSearchText").val();
		self.port.emit("findChannel", text);
	}
});

$("#gameSearch").click(function(event) {
	var text = $("#gameSearchText").val();
	self.port.emit("searchGames", text);
});

$("#gameReload").click(function(event) {
	$("#gameSearchText").val("");
	self.port.emit("reloadGames");
});

$("#popoutSetting").click( function(event) {
	if ( $(this).is (':checked')) {
		self.port.emit("popoutSetting", true);
		storage.popout = true;
	} else {
		self.port.emit("popoutSetting", false);
		storage.popout = false;
	}
});

$("#notifSetting").click( function(event) {
	if ( $(this).is (':checked')) {
		self.port.emit("notifSetting", true);
	} else {
		self.port.emit("notifSetting", false);
	}
});

$("#descripSetting").click( function(event) {
	if ( $(this).is (':checked')) {
		self.port.emit("statusSetting", true);
	} else {
		self.port.emit("statusSetting", false);
	}
});

$("#flaggedSetting").click( function(event) {
	if ( $(this).is (':checked')) {
		self.port.emit("flaggedSetting", true);
	} else {
		self.port.emit("flaggedSetting", false);
	}
});

$("#groupingSetting").click( function(event) {
	if ( $(this).is (':checked')) {
		self.port.emit("groupingSetting", true);
	} else {
		self.port.emit("groupingSetting", false);
	}
});

$("#clearFavs").click(function() {
	if( confirm("Are you sure you want to delete your favourites?") ) {
		favList = {};
		self.port.emit("clearFavList");
	}
});

$("#channelSearch").click(function() {
	var text = $("#favSearchText").val();
	self.port.emit("findChannel", text);
});


$(function(){
    $.contextMenu({
        selector: '#streams-list li', 
        callback: function(key, options) {
			var name = $(this).find(".name").text();
            if (key === "chat") {
				self.port.emit("popout_chat", name);
			} else if (key === "fav") {
				$(this).find("img").click();
			}
        },
        items: {
            "chat": {name: "Open popout chat"},
			"fav": {name: "Add to favourites"}
        }
    }),
	$.contextMenu({
        selector: '#favouritesList, #favStreamersList li', 
        callback: function(key, options) {
			var name = $(this).find(".name").text();
            if (key === "chat") {
				self.port.emit("popout_chat", name);
			} else if (key === "unfav") {
				$(this).find("img").click();
			}
        },
        items: {
            "chat": {name: "Open popout chat"},
			"unfav": {name: "Remove from favourites"}
        }
    });
});




//Convert JSON DOM to real DOM: https://developer.mozilla.org/en-US/docs/XUL/School_tutorial/DOM_Building_and_HTML_Insertion?redirectlocale=en-US&redirectslug=XUL_School%2FDOM_Building_and_HTML_Insertion
jsonToDOM.namespaces = {
    html: "http://www.w3.org/1999/xhtml",
    xul: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul"
};
jsonToDOM.defaultNamespace = jsonToDOM.namespaces.html;
function jsonToDOM(xml, doc, nodes) {
    function namespace(name) {
        var m = /^(?:(.*):)?(.*)$/.exec(name);
        return [jsonToDOM.namespaces[m[1]], m[2]];
    }

    function tag(name, attr) {
        if (Array.isArray(name)) {
            var frag = doc.createDocumentFragment();
            Array.forEach(arguments, function (arg) {
                if (!Array.isArray(arg[0]))
                    frag.appendChild(tag.apply(null, arg));
                else
                    arg.forEach(function (arg) {
                        frag.appendChild(tag.apply(null, arg));
                    });
            });
            return frag;
        }

        var args = Array.slice(arguments, 2);
        var vals = namespace(name);
        var elem = doc.createElementNS(vals[0] || jsonToDOM.defaultNamespace,
                                       vals[1]);

        for (var key in attr) {
            var val = attr[key];
            if (nodes && key == "key")
                nodes[val] = elem;

            vals = namespace(key);
            if (typeof val == "function")
                elem.addEventListener(key.replace(/^on/, ""), val, false);
            else
                elem.setAttributeNS(vals[0] || "", vals[1], val);
        }
        args.forEach(function(e) {
            elem.appendChild(typeof e == "object" ? tag.apply(null, e) :
                             e instanceof Node    ? e : doc.createTextNode(e));
        });
        return elem;
    }
    return tag.apply(null, xml);
}
