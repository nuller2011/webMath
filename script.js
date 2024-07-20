const screenShareButton = document.getElementById('screenShareButton');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const connectButton = document.getElementById('connectButton');
const peerIdInput = document.getElementById('peer-id-input');
const yourIdDisplay = document.getElementById('your-id');
const getPeerIdButton = document.getElementById('getPeerIdButton');

let localStream;
let peer;

canvas.width = 500;
canvas.height = 300;

// Initialize PeerJS
peer = new Peer();

// Get user media
navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;

    peer.on('call', call => {
        call.answer(stream); // Answer the call with our stream
        call.on('stream', remoteStream => {
            remoteVideo.srcObject = remoteStream;
        });
    });
});

getPeerIdButton.onclick = () => {
    peer.on('open', id => {
        yourIdDisplay.innerText = `Your peer ID is: ${id}`;
    });
};

connectButton.onclick = () => {
    const anotherPeerId = peerIdInput.value;
    if (anotherPeerId) {
        const call = peer.call(anotherPeerId, localStream);
        call.on('stream', remoteStream => {
            remoteVideo.srcObject = remoteStream;
        });
    }
};

// Screen sharing
screenShareButton.onclick = async () => {
    const displayStream = await navigator.mediaDevices.getDisplayMedia();
    const screenTrack = displayStream.getTracks()[0];
    peer.call(peer.id, displayStream);

    screenTrack.onended = () => {
        // Revert back to the camera stream when screen sharing ends
        peer.call(peer.id, localStream);
    };
};

// Whiteboard drawing
canvas.onmousedown = function (e) {
    ctx.moveTo(e.offsetX, e.offsetY);
    canvas.onmousemove = function (e) {
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
        peer.send({ 'drawing': { x: e.offsetX, y: e.offsetY } });
    };
};

canvas.onmouseup = function () {
    canvas.onmousemove = null;
};

peer.on('connection', conn => {
    conn.on('data', message => {
        if (message.drawing) {
            ctx.lineTo(message.drawing.x, message.drawing.y);
            ctx.stroke();
        }
    });
});
