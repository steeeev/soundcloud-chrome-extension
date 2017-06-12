// chrome.runtime.onMessage.addListener(function(msg, sender, response) {
//   console.log(msg);
// });

function getPopupSearch() {
  return {
    "general": $("#general").val(),
    "artist": $("#artist").val(),
    "genre": $("#genre").val()
  }
}

var port = chrome.runtime.connect({
  "name": "soundcloud query port"
});

$("#testButton").on('click', function() {
  port.postMessage(getPopupSearch());
});

port.onMessage.addListener(function(msg, sender, response) {
  console.log(msg);
});
