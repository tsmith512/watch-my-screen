import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('Watch My Screen worker', () => {
	it('serves the screen-sharing page', async () => {
		const response = await SELF.fetch('https://example.com/');
		expect(response.status).toBe(200);
		expect(await response.text()).toContain('Watch My Screen');
	});

	it('does not create a live input with a GET request', async () => {
		const response = await SELF.fetch('https://example.com/api/live-inputs');
		expect(response.status).toBe(404);
	});
});
