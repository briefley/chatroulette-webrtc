// Importing RTC related objects
const { RTCPeerConnection, RTCSessionDescription } = window;

// Fetching the configs for STUN and TURN Servers
const configuration = config();
let peerConnection = new RTCPeerConnection(configuration.production.RTCPeerConfiguration);
registerHandlers();

// Initialize userData object. Define the state of the user searching for a pair and pair being found or not.
const userData = {
  searching: false,
  pair: null
};

// Connect to a websocket
var socket = io.connect('http://localhost:3000', { secure: true });

function toggleConnection() {
  userData.searching = !userData.searching;
  editButtonClass(userData.searching);
  if (userData.searching) {
    requestConnection();
  } else {
    closeConnection();
  }
}

// Pettily messing with HTML and visuals to make app UX feel less horrible
function editButtonClass(bool) {
  let target = document.getElementById('search');
  const classList = target.classList;
  classList.remove("btn-primary");

  if (bool) {
    target.innerHTML = "Leave";
    return classList.add("btn-danger");
  }
  target.innerHTML = "Connect";

  classList.remove("btn-danger");
  classList.add("btn-primary");
}

/* 
  * Create an offer, set it as local description, 
  * pass to socket so it may pass it to the second user
*/
async function requestConnection() {
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(new RTCSessionDescription(offer));
  socket.emit('call', { userData: userData, offer: offer });
}

/* 
  * Close the peer connection, clear out the local pair,
  * notify the pair that connection is closed through a websocket.
  * Clear out pair's video source and initialize the new instance of
  * RTCPeerConnection, since the old one is not usable after closing.
*/
async function closeConnection() {
  peerConnection.close();
  userData.pair = null;
  socket.emit('closeConnection');
  const remoteVideo = document.getElementById("remote-video");
  remoteVideo.src = '';
  peerConnection = new RTCPeerConnection(configuration.production.RTCPeerConfiguration);
  /* Need to register these event handlers, since the RTCPeerConnection object
   * is re-initialized at this point.
  */
  registerHandlers();
}

/* 
  * Close the peer connection, clear out the local pair,
  * Clear out pair's video source and initialize the new instance of
  * RTCPeerConnection, since the old one is not usable after closing.
  * Also, trigger the search for pair once again, since this user
  * did not initiate disconnect event. (The other one dumped him lol)
*/
socket.on('connectionClosed', () => {
  peerConnection.close();
  userData.pair = null;
  userData.searching = false;
  const remoteVideo = document.getElementById("remote-video");
  remoteVideo.src = '';
  peerConnection = new RTCPeerConnection(configuration.production.RTCPeerConfiguration);
  editButtonClass(userData.searching);
  registerHandlers();
  toggleConnection();
});

/*
  * Receive the offer, set it as peerConnections remote description.
  * Create an answer, set it as local description and pass it on to a
  * pair through a websocket.
*/
socket.on('offer', async (resData) => {
  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(resData.offer)
  );
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(new RTCSessionDescription(answer));
  socket.emit('makeAnswer', answer);
});

/*
  * Once the answer is made, set it as a remote description.
*/
socket.on('answerMade', async (answer) => {
  await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
});

/*
  * Receive an ice candidate and add it to a peerConnection.
*/
socket.on('receiveIceCandidate', (candidate) => {
  peerConnection.addIceCandidate(candidate);
});

/*
  * Update the counter once the count of users
  * connected to a websocket changes.
*/
socket.on('userCount', (userCount) => {
  document.getElementById('userCount').innerHTML = userCount;
});


function registerHandlers() {
  /*
  * Get access to user's media devices (Different code for different browsers, heh, fun)
  * show the client's video in local-video element and attach it to a peerConnection
  * so the pair may receive it once connected.
  */
  if (navigator.getUserMedia === undefined) {
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then(function (stream) {
        const localVideo = document.getElementById("local-video");
        if (localVideo) {
          localVideo.srcObject = stream;
        }
        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
      })
      .catch(function (error) {
        alert(error)
      })

  } else {
    navigator.getUserMedia({ audio: true, video: true },
      stream => {
        const localVideo = document.getElementById("local-video");
        if (localVideo) {
          localVideo.srcObject = stream;
        }

        stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
      },
      function () { console.log('Web Cam is not accessible.') });
  }

  /*
    *  The ontrack event listener is a built-in event handler of the RTCPeerConnection interface in WebRTC. 
    *  It is fired when a new media stream is received from the remote peer during a WebRTC session. 
    *  This event listener is commonly used to display the remote video or audio stream on the local user's screen.
  */
  peerConnection.ontrack = function ({ streams: [stream] }) {
    const remoteVideo = document.getElementById("remote-video");
    if (remoteVideo) {
      remoteVideo.srcObject = stream;
    }
  };

/*
  * Once peerConnection discovers new ice candidate, pass it to a pair.
*/
  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('sendIceCandidate', event.candidate);
    }
  };
}