import { Hono } from "hono"
import { WEBHOOK, HOOK_PREFIX } from "../constants"
import { Bindings } from "../bindings"
import { createBot, createAI, createTTS } from "../services"
import { authorize } from "../middleware"
import { translate } from "../lib"
import { Update } from "../services/telegram"

const hook = new Hono<{ Bindings: Bindings }>()

hook.use(WEBHOOK, authorize())

hook.get("/registerWebhook", async (c) => {
    const u = new URL(c.req.url)
    const url = `${u.protocol}//${u.hostname}${HOOK_PREFIX}${WEBHOOK}`
    const r = await createBot(c).setWebhook({ url, secret_token: c.env.ENV_BOT_SECRET })
    return new Response(r.ok ? "Ok" : (r.description ?? ""))
})

hook.get("/unRegisterWebhook", async (c) => {
    const r = await createBot(c).setWebhook({ url: "", secret_token: "" })
    return new Response(r.ok ? "Ok" : (r.description ?? ""))
})

hook.post(WEBHOOK, async (c) => {
    const update: Update = await c.req.json()
    const bot = createBot(c)
    const ai = createAI(c)
    const tts = createTTS(c)
    const db = c.env.DB

    try {
        // Handle callback queries (button clicks)
        if (update.callback_query) {
            const { id, data, message, from } = update.callback_query
            if (data && message && from) {
                const { handleQuizAnswer } = await import("../lib/quiz")
                await handleQuizAnswer({ bot, ai, tts }, id, data, message.chat.id, message.message_id, from.id, db)
            }
            return new Response("Ok")
        }

        // Handle regular messages
        const me = await bot.getMe()
        if (update.message?.text?.startsWith("/quiz")) {
            // Handle /quiz command
            const { from, chat } = update.message
            if (from) {
                const { getUserVocabulary, generateQuiz, sendQuizQuestion, storeQuizState } = await import("../lib/quiz")
                const words = await getUserVocabulary(db, from.id)

                if (words.length === 0) {
                    await bot.sendMessage({
                        chat_id: chat.id,
                        text: "You don't have any vocabulary words yet. Start by asking me about words!",
                    })
                    return new Response("Ok")
                }

                await bot.sendMessage({
                    chat_id: chat.id,
                    text: `📚 Generating quiz from your ${words.length} vocabulary words...`,
                })

                const questions = await generateQuiz({ bot, ai, tts }, words)

                if (questions.length === 0) {
                    await bot.sendMessage({
                        chat_id: chat.id,
                        text: "Failed to generate quiz. Please try again later.",
                    })
                    return new Response("Ok")
                }

                // Store quiz in D1 with 1 hour expiration
                await storeQuizState(db, from.id, questions)

                // Send first question
                await sendQuizQuestion({ bot, ai, tts }, chat.id, questions[0], 0, questions.length)
            }
        } else if (
            update.message?.entities?.some((val) => val.type == "mention") &&
            update.message.text?.includes(`@${me.result.username}`)
        ) {
            // Handle mention (vocabulary query)
            await translate(update.message, { bot, ai, tts }, db)
        }
    } catch (error) {
        console.error("Error handling update:", error)
        if (update.message) {
            await bot.sendMessage({
                chat_id: update.message.chat.id,
                text: `Error: ${error}`,
            })
        }
    }
    return new Response("Ok")
})

export default hook
