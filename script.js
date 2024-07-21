const screenShareButton = document.getElementById('screenShareButton');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const connectButton = document.getElementById('connectButton');
const peerIdInput = document.getElementById('peer-id-input');
const yourIdDisplay = document.getElementById('your-id');

let localStream;
let peerConnection;
let dataChannel;
const peerId = generateId();
let webSocket;

yourIdDisplay.innerText = peerId;

const configuration = {
    iceServers: [
        {
            urls: 'stun:stun.l.google.com:19302'
        }
    ]
};

function generateId() {
    return Math.floor(Math.random() * 1000000).toString();
}

// Initialize local video stream
navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
    localStream = stream;
    localVideo.srcObject = stream;
});

// Initialize WebSocket connection
webSocket = new WebSocket('wss://your-server-address');

webSocket.onmessage = async (message) => {
    const signal = JSON.parse(message.data);
    await handleSignal(signal);
};

connectButton.onclick = async () => {
    const anotherPeerId = peerIdInput.value;
    if (anotherPeerId) {
        await initiateCall(anotherPeerId);
    }
};

async function initiateCall(anotherPeerId) {
    peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            sendSignal(anotherPeerId, {
                type: 'candidate',
                candidate: event.candidate
            });
        }
    };

    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    dataChannel = peerConnection.createDataChannel('whiteboard');

    dataChannel.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.drawing) {
            ctx.lineTo(message.drawing.x, message.drawing.y);
            ctx.stroke();
        }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    sendSignal(anotherPeerId, {
        type: 'offer',
        offer: offer
    });
}

async function handleSignal(signal) {
    if (signal.type === 'offer') {
        peerConnection = new RTCPeerConnection(configuration);

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                sendSignal(signal.from, {
                    type: 'candidate',
                    candidate: event.candidate
                });
            }
        };

        peerConnection.ontrack = event => {
            remoteVideo.srcObject = event.streams[0];
        };

        peerConnection.ondatachannel = event => {
            dataChannel = event.channel;
            dataChannel.onmessage = event => {
                const message = JSON.parse(event.data);
                if (message.drawing) {
                    ctx.lineTo(message.drawing.x, message.drawing.y);
                    ctx.stroke();
                }
            };
        };

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.offer));

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        sendSignal(signal.from, {
            type: 'answer',
            answer: answer
        });
    } else if (signal.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.answer));
    } else if (signal.type === 'candidate') {
        await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
}

function sendSignal(peerId, signal) {
    signal.from = peerId;
    webSocket.send(JSON.stringify(signal));
}

// Screen sharing
screenShareButton.onclick = async () => {
    const displayStream = await navigator.mediaDevices.getDisplayMedia();
    const screenTrack = displayStream.getTracks()[0];

    peerConnection.getSenders().find(sender => sender.track.kind === 'video').replaceTrack(screenTrack);

    screenTrack.onended = () => {
        peerConnection.getSenders().find(sender => sender.track.kind === 'video').replaceTrack(localStream.getVideoTracks()[0]);
    };
};

// Whiteboard drawing
canvas.onmousedown = function (e) {
    ctx.moveTo(e.offsetX, e.offsetY);
    canvas.onmousemove = function (e) {
        ctx.lineTo(e.offsetX, e.offsetY);
        ctx.stroke();
        dataChannel.send(JSON.stringify({ 'drawing': { x: e.offsetX, y: e.offsetY } }));
    };
};

canvas.onmouseup = function () {
    canvas.onmousemove = null;
};

