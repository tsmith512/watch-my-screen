export default async function negotiateConnectionWithClientOffer(peerConnection, endpoint) {
	const offer = await peerConnection.createOffer();
	await peerConnection.setLocalDescription(offer);
	const localDescription = await waitForIceGathering(peerConnection);

	if (!localDescription) throw new Error('Unable to gather ICE candidates');

	const response = await fetch(endpoint, {
		method: 'POST',
		mode: 'cors',
		headers: { 'content-type': 'application/sdp' },
		body: localDescription.sdp,
	});

	if (response.status !== 201) {
		throw new Error(`WHIP publish failed: ${response.status} ${await response.text()}`);
	}

	await peerConnection.setRemoteDescription({ type: 'answer', sdp: await response.text() });
}

function waitForIceGathering(peerConnection) {
	return new Promise((resolve) => {
		const timeout = setTimeout(() => resolve(peerConnection.localDescription), 1000);
		peerConnection.addEventListener(
			'icegatheringstatechange',
			() => {
				if (peerConnection.iceGatheringState === 'complete') {
					clearTimeout(timeout);
					resolve(peerConnection.localDescription);
				}
			},
			{ once: true },
		);
	});
}
