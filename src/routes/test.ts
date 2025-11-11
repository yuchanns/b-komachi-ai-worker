import { Hono } from "hono"
import { translate } from "../lib"
import { Bindings, Injector } from "../bindings"
import { createBot, createTTS, createAI } from "../services"
import { authorize } from "../middleware"
import { Chat, Message } from "@yuchanns/flamebot/dist/types"

const test = new Hono<{ Bindings: Bindings }>()

test.use("*", authorize())

test.get("/getMe", async (c) => {
    const r = await createBot(c).getMe()
    return new Response(r.ok ? "Ok" : (r.description ?? ""))
})

test.get("/tts", async (c) => {
    const text = c.req.query("text") || "A sophisticated Telegram bot Vocabulary Assistant deployed on Cloudflare Worker"
    const audioBlob = await createTTS(c).textToSpeech({ text })
    return new Response(audioBlob, {
        headers: {
            "Content-Type": "audio/mpeg",
            "Content-Disposition": "attachment; filename=tts.mp3",
        },
    })
})

test.get("/chat", async (c) => {
    const prompt = c.req.query("prompt") ?? ""
    const response = await createAI(c).chat({
        messages: [{ role: "user", content: prompt }],
        temperature: 0.2,
    })
    return c.json(response)
})

test.get("/send", async (c) => {
    const id = c.req.query("id") ?? 0
    const message_id = c.req.query("message_id") ?? 0
    const text = c.req.query("text") ?? ""
    const bot = createBot(c)
    const ai = createAI(c)
    const tts = createTTS(c)
    await translate(
        {
            chat: { id } as Chat,
            message_id,
            text,
        } as Message,
        { bot, ai, tts } as Injector
    )
    return new Response("Ok")
})

export default test
