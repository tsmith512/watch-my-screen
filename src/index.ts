import { AutoRouter, error, json, type IRequest } from 'itty-router';

interface StreamLiveInput {
	uid: string;
	webRTC: { url: string };
	webRTCPlayback: { url: string };
}

interface StreamApiResponse {
	success: boolean;
	errors: { code: number; message: string }[];
	result: StreamLiveInput;
}

interface CleanupMessage {
	liveInputId: string;
}

const router = AutoRouter<IRequest, [Env]>();

router.get('/', (request, env) => env.ASSETS.fetch(request));

router.post('/api/live-inputs', async (_request, env) => {
	const response = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs`,
		{
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				meta: { name: `watch-my-screen-${Date.now()}` },
				defaultCreator: 'stream',
			}),
		},
	);

	if (!response.ok) {
		console.error({ event: 'stream_api_error', status: response.status, response: await response.text() });
		return error(502, `Stream API error: ${response.status}`);
	}

	const data = (await response.json()) as StreamApiResponse;
	if (!data.success) {
		const message = data.errors?.[0]?.message ?? 'Unknown Stream API error';
		console.error({ event: 'stream_api_error', errors: data.errors });
		return error(502, message);
	}

	const { uid, webRTC, webRTCPlayback } = data.result;
	const delaySeconds = Number.parseInt(env.CLEANUP_DELAY_SECONDS, 10) || 43200;

	try {
		await env.CLEANUP_QUEUE.send({ liveInputId: uid } satisfies CleanupMessage, { delaySeconds });
		console.log({ event: 'live_input_created', liveInputId: uid, delaySeconds });
	} catch (queueError) {
		console.error({
			event: 'cleanup_message_enqueue_failed',
			liveInputId: uid,
			error: queueError instanceof Error ? queueError.message : String(queueError),
		});

		try {
			await deleteLiveInput(env, uid);
		} catch (deleteError) {
			console.error({
				event: 'cleanup_enqueue_compensation_delete_failed',
				liveInputId: uid,
				error: deleteError instanceof Error ? deleteError.message : String(deleteError),
			});
		}
		return error(502, 'Failed to schedule live input cleanup');
	}

	const playerUrl = `${new URL(webRTCPlayback.url).origin}/${uid}/iframe`;
	return json({ whip: webRTC.url, playerUrl, liveInputId: uid });
});

async function deleteLiveInput(env: Env, liveInputId: string): Promise<Response> {
	return fetch(
		`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream/live_inputs/${liveInputId}`,
		{ method: 'DELETE', headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}` } },
	);
}

async function handleCleanupQueue(batch: MessageBatch<CleanupMessage>, env: Env): Promise<void> {
	for (const message of batch.messages) {
		const { liveInputId } = message.body;

		try {
			const response = await deleteLiveInput(env, liveInputId);
			if (!response.ok && response.status !== 404) {
				console.error({
					event: 'queue_delete_failed',
					liveInputId,
					messageId: message.id,
					attempt: message.attempts,
					status: response.status,
					response: await response.text(),
				});
				message.retry();
				continue;
			}

			console.log({ event: 'queue_delete_success', liveInputId, messageId: message.id });
			message.ack();
		} catch (queueError) {
			console.error({
				event: 'queue_delete_error',
				liveInputId,
				messageId: message.id,
				attempt: message.attempts,
				error: queueError instanceof Error ? queueError.message : String(queueError),
			});
			message.retry();
		}
	}
}

export default {
	fetch: router.fetch,
	queue: handleCleanupQueue,
} satisfies ExportedHandler<Env, CleanupMessage>;
