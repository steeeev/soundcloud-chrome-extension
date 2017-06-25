// Initialization --------------------------------------------------------------
$.getJSON("../config.json", function(data) {
  console.log('initialized');
  SC.initialize({
    client_id: data["soundcloud_client_id"]
  });
});
chrome.storage.sync.clear();
var stream = null;
// -----------------------------------------------------------------------------
function sendMessage(port, msg, details) {
  port.postMessage({
    message: message,
    content: details
  });
}

function displayCurrentSong(port) {
  // chrome.storage.sync.get("currentTracks", function(tracks) {
  //   console.log('getting sstored tracks');
  //   port.postMessage({
  //     message: "search-results",
  //     content: Object.values(tracks)
  //   });
  // });
  displayCurrentTrack(port);
  chrome.tabs.query({
    "url": "*://soundcloud.com/*"
  }, function(soundcloudTabs) {
    if (soundcloudTabs.length > 0) {
      var currentlyPlaying = null;
      // TODO: try to not have to look thru all the tabs every time. Caching?
      var audibleTabs = soundcloudTabs.filter(function(t) {
        return t.audible == true;
      });
      if (audibleTabs.length == 0) {
        return;
      }
      currentlyPlaying = audibleTabs[0];
      console.log(currentlyPlaying);
      port.postMessage({
        "message": "display-current-track",
        "content": currentlyPlaying
      });
    }
  });
}

function displayTracks(port, tracks) {
  port.postMessage({
    message: "display-tracks",
    content: tracks
  });
}

function displayPreviousSearch(port) {
  chrome.storage.sync.get(["previousSearch"], function(obj) {
    if ((chrome.runtime.lastError == null) && ('previousSearch' in obj)) {
      SC.get('/tracks', obj.previousSearch).then(function(res) {
        console.log("previous search is: ")
        console.log(obj.previousSearch);
        displayTracks(port, res);
      });
    }
  });
}

function displayCurrentTrack(port) {
  chrome.storage.sync.get(["currentTrack"], function(obj) {
    if (chrome.runtime.lastError == null &&
      ('currentTrack' in obj) &&
      (!$.isEmptyObject(obj.currentTrack))) {
      console.log("current track is: ");
      console.log(obj);
      port.postMessage({
        message: "display-current-track",
        content: obj.currentTrack
      });
    }
  });
}
chrome.runtime.onSuspend.addListener(function() {
  console.log("reloaded the extension");
});

chrome.runtime.onConnect.addListener(function(port) {
  console.log("Connected to " + port.name);

  displayCurrentSong(port);
  displayPreviousSearch(port);

  port.onMessage.addListener(function(msg) {
    console.log("<MESSAGE INCOMING FROM POPUP>");
    console.log("Port action: " + msg.message);
    console.log("Content: " + msg.content);
    console.log("<END OF MESSAGE>");

    var content = msg.content;
    var message = msg.message;
    switch (message) {
      case "play-song":
          var track = content;
          SC.stream('/tracks/' + track.id).then(function(player) {
            player.on('state-change', function(state) {
              console.log('state changed ' + state);
            })
            player.on('finish', function() {
              chrome.storage.sync.set({
                'currentTrack': {}
              });
            })
            player.on('buffering_start', function() {
              console.log('buffering start');
            })
            player.on('buffering_end', function() {
              console.log('end buffering');
            })

            player.play();

            stream = player;
          });
          chrome.storage.sync.set({
            "currentTrack": track
          });
          displayCurrentSong(port);
          break;
      case "search":
          var searchString = content;
          var searchInfo = {
            q: searchString,
            linked_partitioning: 1
          }
          SC.get("/tracks", {
            q: searchString,
            linked_partitioning: 1
          }).then(function(res) {
            console.log("Search info: ");
            console.log(searchInfo);
            chrome.storage.sync.set({
              "previousSearch": searchInfo
            });
            displayTracks(port, res);
          });
      case "pause":
        if (!!stream) {
          stream.pause();
        }
        break;
      case "next":
          break;
      case "prev":
          break;
      case "get-reposts":
          break;
      default:
          break;
    }
  });
});

// --------- KEYBOARD SHORTCUT LISTENERS -------------------------------------
function switchToTabInWindow(tabId, windowId) {
    var windowUpdateInfo = { "focused": true };
    chrome.windows.update(windowId, windowUpdateInfo);

    var tabUpdateInfo = { "active": true };
    chrome.tabs.update(tabId, tabUpdateInfo);
}

function setPrevPageInfo(tabId, windowId) {
    var newPrevInfo = {
      "prevTabId": tabId,
      "prevWindowId": windowId
    };
    chrome.storage.sync.set(newPrevInfo);
}


chrome.commands.onCommand.addListener(function(command) {
  switch (command) {
    case "open-soundcloud":
      var activeTabInfo = {
        "lastFocusedWindow": true,
        "active": true
      };
      chrome.tabs.query(activeTabInfo, function(tabs) {
        if (tabs.length > 0) {
          // only set previous info if the page you are looking at is a
          // "tabbable" window. For example, a develepor tools window. TODO: look more into this.
          setPrevPageInfo(tabs[0].id, tabs[0].windowId);
        }
      });
      var query = {
        "url": "*://soundcloud.com/*"
      }
      chrome.tabs.query(query, function(soundcloudTabs) {
        if (soundcloudTabs.length == 0) {
          chrome.tabs.create({
            url: "https://soundcloud.com"
          });
        } else {
          var tabToSwitchTo = null;
          // TODO: try to not have to look thru all the tabs every time. Caching?
          var audibleTabs = soundcloudTabs.filter(function(t) {
            return t.audible == true;
          });
          if (audibleTabs.length > 0) {
            tabToSwitchTo = audibleTabs[0];
          } else {
            tabToSwitchTo = soundcloudTabs[0];
          }
          // TODO: only update if not on tabToSwitchTo
          switchToTabInWindow(tabToSwitchTo.id, tabToSwitchTo.windowId);
        }
      });
      break;
    case "previous-location":
      var prevInfo = ["prevTabId", "prevWindowId"];
      chrome.storage.sync.get(prevInfo, function(prevInfo) {
        if (chrome.runtime.lastError == null) {
          switchToTabInWindow(prevInfo.prevTabId, prevInfo.prevWindowId);
        }
      });
    default:
      break;
  }
});
