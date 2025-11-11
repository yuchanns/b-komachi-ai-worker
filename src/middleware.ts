import { createMiddleware } from 'hono/factory';
import { Bindings } from './bindings';

export const authorize = () => {
	return createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
		if (
			c.req.raw.headers.get('X-Telegram-Bot-Api-Secret-Token') !== c.env.ENV_BOT_SECRET &&
			c.req.query('secret') !== c.env.ENV_BOT_SECRET
		) {
			return new Response('Unauthorized', { status: 403 });
		}
		await next();
	});
};
