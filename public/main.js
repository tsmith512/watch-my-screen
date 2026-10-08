import negotiateConnectionWithClientOffer from './negotiateConnectionWithClientOffer.js';

const startButton = document.querySelector('#start');
const stopButton = document.querySelector('#stop');
const status = document.querySelector('#status');
const playerSection = document.querySelector('#player-section');
const player = document.querySelector('#player');
const shareSection = document.querySelector('#share-section');
const shareLink = document.querySelector('#share-link');

let liveInput;
let displayStream;
let peerConnection;
let stopping = false;

function setStatus(message) {
	status.textContent = message;
}

async function createLiveInput() {
	const response = await fetch('/api/live-inputs', { method: 'POST' });
	if (!response.ok) throw new Error(`Could not create live input: ${await response.text()}`);

	liveInput = await response.json();
	shareLink.href = liveInput.playerUrl;
	shareLink.textContent = liveInput.playerUrl;
	shareSection.hidden = false;
}

async function publish(stream) {
	peerConnection = new RTCPeerConnection({
		iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
		bundlePolicy: 'max-bundle',
	});

	for (const track of stream.getVideoTracks()) {
		peerConnection.addTransceiver(track, { direction: 'sendonly' });
	}

	await negotiateConnectionWithClientOffer(peerConnection, liveInput.whip);
}

async function startSharing() {
	startButton.disabled = true;
	setStatus('Choose a display to share.');

	try {
		displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
		displayStream.getVideoTracks()[0].addEventListener('ended', stopSharing, { once: true });

		if (!liveInput) {
			setStatus('Creating live input.');
			await createLiveInput();
		}

		setStatus('Starting broadcast.');
		await publish(displayStream);
		player.src = `${liveInput.playerUrl}?autoplay=true&muted=true&controls=true`;
		playerSection.hidden = false;
		stopButton.disabled = false;
		setStatus('Sharing your display.');
	} catch (error) {
		await stopSharing();
		setStatus(error instanceof Error ? error.message : 'Unable to start screen sharing.');
	} finally {
		if (!peerConnection) startButton.disabled = false;
	}
}

async function stopSharing() {
	if (stopping) return;
	stopping = true;

	peerConnection?.close();
	peerConnection = undefined;
	displayStream?.getTracks().forEach((track) => track.stop());
	displayStream = undefined;
	player.removeAttribute('src');
	playerSection.hidden = true;
	startButton.disabled = false;
	stopButton.disabled = true;
	setStatus(liveInput ? 'Broadcast stopped. The same live input is ready to reuse.' : 'Ready to share a display.');
	stopping = false;
}

startButton.addEventListener('click', startSharing);
stopButton.addEventListener('click', stopSharing);
