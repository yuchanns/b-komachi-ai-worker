import { Hono } from "hono"
import { Update } from "../clients"
import { WEBHOOK, HOOK_PREFIX } from "../consts"
import { Env } from "../types"
import { createBot, createOpenAI, createTTS } from "../utils"
import { authorize } from "./middlewares"
import { isMentioned, translate } from "../layers"

const app = new Hono<Env>().use(WEBHOOK, authorize())

app.get('/registerWebhook', async (c) => {
	const u = new URL(c.req.url)
	const url = `${u.protocol}//${u.hostname}${HOOK_PREFIX}${WEBHOOK}`
	const r = await createBot(c)
		.setWebhook({ url, secret_token: c.env.ENV_BOT_SECRET })
	return new Response(r.ok ? 'Ok' : r.description ?? '')
})

app.get('/unRegisterWebhook', async (c) => {
	const r = await createBot(c)
		.setWebhook({ url: "", secret_token: "" })
	return new Response(r.ok ? 'Ok' : r.description ?? '')
})

app.get(WEBHOOK, async (c) => {
	const update: Update = await c.req.json()
	if (update.message && isMentioned(update.message)) {
		const bot = createBot(c)
		const ai = createOpenAI(c)
		const tts = createTTS(c)
		await translate(update.message, { bot, ai, tts })
	}
	return new Response('Ok')
})


export const hookRoute = app
