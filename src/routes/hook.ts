import { Hono } from 'hono';
import { WEBHOOK, HOOK_PREFIX } from '../constants';
import { Bindings } from '../bindings';
import { createBot, createAI, createTTS } from '../services';
import { authorize } from '../middleware';
import { translate } from '../lib';
import { Update } from '@yuchanns/flamebot/dist/types';

const hook = new Hono<{ Bindings: Bindings }>();

hook.use(WEBHOOK, authorize());

hook.get('/registerWebhook', async (c) => {
	const u = new URL(c.req.url);
	const url = `${u.protocol}//${u.hostname}${HOOK_PREFIX}${WEBHOOK}`;
	const r = await createBot(c).setWebhook({ url, secret_token: c.env.ENV_BOT_SECRET });
	return new Response(r.ok ? 'Ok' : r.description ?? '');
});

hook.get('/unRegisterWebhook', async (c) => {
	const r = await createBot(c).setWebhook({ url: '', secret_token: '' });
	return new Response(r.ok ? 'Ok' : r.description ?? '');
});

hook.post(WEBHOOK, async (c) => {
	const update: Update = await c.req.json();
	const bot = createBot(c);
	const me = await bot.getMe();
	if (update.message?.entities?.some((val) => val.type == 'mention') && update.message.text?.includes(`@${me.result.username}`)) {
		const tts = createTTS(c);
		const ai = createAI(c);
		try {
			await translate(update.message, { bot, ai, tts });
		} catch (error) {
			await bot.sendMessage({
				chat_id: update.message.chat.id,
				text: `${error}`,
			});
		}
	}
	return new Response('Ok');
});

export default hook;
