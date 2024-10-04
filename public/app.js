// Import the necessary Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getDatabase, ref, set, push, onChildAdded } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCN23wFuk0ZgSi9sj3RHDx6GZieVDVKiBk",
    authDomain: "webrtc-video-call-856aa.firebaseapp.com",
    databaseURL: "https://webrtc-video-call-856aa-default-rtdb.firebaseio.com",
    projectId: "webrtc-video-call-856aa",
    storageBucket: "webrtc-video-call-856aa.appspot.com",
    messagingSenderId: "92058542",
    appId: "1:92058542:web:8a4ac9ea3d3126e388ce3f",
    measurementId: "G-PVVLVMLDG6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Variables for WebRTC
let localStream;
let remoteStream;
let peerConnection;

// HTML Elements
const usernamePrompt = document.getElementById('usernamePrompt');
const chatArea = document.getElementById('chatArea');
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startCallButton = document.getElementById('startCall');

// ICE servers configuration (STUN server for NAT traversal)
const iceServers = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Prompt for username
document.getElementById('submitUsername').onclick = () => {
    const username = document.getElementById('username').value.trim();
    if (username) {
        // Store username in Firebase
        set(ref(database, `users/${username}`), { online: true });
        usernamePrompt.classList.add('hidden');
        chatArea.classList.remove('hidden');
        startCall();
    }
};

// Start the call
async function startCall() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;

        peerConnection = new RTCPeerConnection(iceServers);

        // Add local stream tracks to peer connection
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                sendSignal({ ice: event.candidate });
            }
        };

        peerConnection.ontrack = event => {
            remoteVideo.srcObject = event.streams[0];
        };

        // Create an offer and send it
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        sendSignal({ offer });
    } catch (error) {
        console.error('Error starting call:', error);
    }
}

// Function to send signaling data
function sendSignal(data) {
    const signalingRef = ref(database, 'signaling');
    push(signalingRef, data);
}

// Function to fetch signaling data
async function fetchSignal() {
    const signalingRef = ref(database, 'signaling');
    onChildAdded(signalingRef, async (snapshot) => {
        const data = snapshot.val();

        if (data.ice) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.ice));
        } else if (data.offer) {
            if (peerConnection.signalingState === 'stable') {
                await handleOffer(data.offer);
            } else {
                console.warn('Received offer when not in stable state:', peerConnection.signalingState);
            }
        } else if (data.answer) {
            if (peerConnection.signalingState === 'have-remote-offer') {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            } else {
                console.warn('Received answer when not expecting one:', peerConnection.signalingState);
            }
        }
    });
}


// Handle incoming offer
async function handleOffer(offer) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    // Create an answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    // Send the answer back
    sendSignal({ answer });
}

// Start fetching signaling data
fetchSignal();
