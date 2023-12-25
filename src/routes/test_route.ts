import { Hono } from "hono"
import { translate } from "../layers"
import { Env, Injector } from "../types"
import { createBot, createTTS, createOpenAI } from "../utils"
import { authorize } from "./middlewares"
import { Chat, Message } from "@yuchanns/flamebot/dist/types"

const app = new Hono<Env>().use("*", authorize())

app.get('/getMe', async (c) => {
	const r = await createBot(c)
		.getMe()
	return new Response(r.ok ? 'Ok' : r.description ?? '')
})

app.get('/tts', async (c) => {
	const text = c.req.query("text")
		|| "A sophisticated Telegram bot Vocabulary Assistant deployed on Cloudflare Worker"
	const audioBlob = await createTTS(c)
		.textToSpeech({ text })
	return new Response(audioBlob, {
		headers: {
			"Content-Type": "audio/mpeg",
			"Content-Disposition": "attachment; filename=tts.mp3"
		}
	})
})

app.get('/chat', async (c) => {
	const prompt = c.req.query("prompt") ?? ""
	const response = await createOpenAI(c).chat({
		messages: [
			{ role: "user", content: prompt }
		],
		temperature: 0.2,
	})
	return c.json(response)
})

app.get('/send', async (c) => {
	const id = c.req.query("id") ?? 0
	const message_id = c.req.query("message_id") ?? 0
	const text = c.req.query("text") ?? ""
	const bot = createBot(c)
	const ai = createOpenAI(c)
	const tts = createTTS(c)
	await translate(
		{
			chat: { id } as Chat,
			message_id, text,
		} as Message,
		{ bot, ai, tts } as Injector,
	)
	return new Response('Ok')
})

export const testRoute = app
