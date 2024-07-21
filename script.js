const createRoomButton = document.getElementById('createRoomButton');
const joinRoomButton = document.getElementById('joinRoomButton');
const roomIdDisplay = document.getElementById('room-id');
const roomIdInput = document.getElementById('room-id-input');
const screenShareButton = document.getElementById('screenShareButton');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');

let localStream;
let remoteStream;
let connection;
const canvasWidth = 500;
const canvasHeight = 300;

canvas.width = canvasWidth;
canvas.height = canvasHeight;

// Initialize Photon
const photonAppId = 'YOUR_PHOTON_APP_ID';  // Replace with your Photon App ID
const photonAppVersion = '1.0';
const photon = new Photon.LoadBalancing.LoadBalancingClient(
    Photon.ConnectionProtocol.Wss, photonAppId, photonAppVersion
);

// Connect to Photon
photon.connectToRegionMaster('EU');

// Get user media
navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;
});

photon.onStateChange = function (state) {
    console.log(`Photon state: ${state}`);
};

photon.onJoinRoom = function () {
    console.log('Joined room');
};

photon.onEvent = function (code, content, actorNr) {
    if (code === 1) {
        handleRemoteStream(content);
    } else if (code === 2) {
        drawOnRemoteWhiteboard(content);
    }
};

createRoomButton.onclick = () => {
    const roomId = Math.random().toString(36).substring(2, 15);
    roomIdDisplay.innerText = roomId;
    photon.joinOrCreateRoom(roomId);
    initializeConnection();
};

joinRoomButton.onclick = () => {
    const roomId = roomIdInput.value;
    if (roomId) {
        photon.joinRoom(roomId);
        initializeConnection();
    }
};

function initializeConnection() {
    connection = new RTCPeerConnection();

    connection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    localStream.getTracks().forEach(track => {
        connection.addTrack(track, localStream);
    });

    connection.onicecandidate = event => {
        if (event.candidate) {
            photon.raiseEvent(1, JSON.stringify(event.candidate));
        }
    };

    connection.createOffer()
        .then(offer => connection.setLocalDescription(offer))
        .then(() => photon.raiseEvent(1, JSON.stringify(connection.localDescription)));
}

function handleRemoteStream(message) {
    const data = JSON.parse(message);
    if (data.sdp) {
        connection.setRemoteDescription(new RTCSessionDescription(data.sdp))
            .then(() => {
                if (data.sdp.type === 'offer') {
                    connection.createAnswer()
                        .then(answer => connection.setLocalDescription(answer))
                        .then(() => photon.raiseEvent(1, JSON.stringify(connection.localDescription)));
                }
            });
    } else if (data.candidate) {
        connection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
}

// Screen sharing
screenShareButton.onclick = async () => {
    const displayStream = await navigator.mediaDevices.getDisplayMedia();
    const screenTrack = displayStream.getTracks()[0];
    connection.addTrack(screenTrack, displayStream);

    screenTrack.onended = () => {
        // Revert back to the camera stream when screen sharing ends
        localStream.getTracks().forEach(track => {
            connection.addTrack(track, localStream);
        });
    };
};

// Whiteboard drawing
canvas.onmousedown = function (e) {
    ctx.moveTo(e.offsetX, e.offsetY);
    canvas.onmousemove = function (e) {
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
        photon.raiseEvent(2, { x: e.offsetX, y: e.offsetY });
    };
};

canvas.onmouseup = function () {
    canvas.onmousemove = null;
};

function drawOnRemoteWhiteboard(data) {
    ctx.lineTo(data.x, data.y);
    ctx.stroke();
}
