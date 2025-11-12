import { Hono } from "hono"
import { WEBHOOK, HOOK_PREFIX } from "../constants"
import { Bindings } from "../bindings"
import { createBot, createAI, createTTS } from "../services"
import { authorize } from "../middleware"
import { translate, HELP_MESSAGE, handleDailyTips } from "../lib"
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

    // Check if DB is properly configured
    if (!db) {
        console.error("D1 Database (DB) is not configured. Please set up D1 database binding in wrangler.toml")
        if (update.message) {
            await bot.sendMessage({
                chat_id: update.message.chat.id,
                text: "⚠️ Database not configured. Please contact the administrator.",
            })
        }
        return new Response("Database not configured", { status: 500 })
    }

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

        if (update.message?.text?.startsWith("/help")) {
            // Handle /help command
            const { chat } = update.message
            await bot.sendMessage({
                chat_id: chat.id,
                text: HELP_MESSAGE,
                parse_mode: "Markdown",
            })
        } else if (update.message?.text?.startsWith("/quiz")) {
            // Handle /quiz command
            const { from, chat } = update.message
            if (from) {
                const { getUserVocabulary, getUserVocabularyForQuiz, generateQuiz, sendQuizQuestion, storeQuizState } = await import(
                    "../lib/quiz"
                )
                const allWords = await getUserVocabulary(db, from.id)

                if (allWords.length === 0) {
                    await bot.sendMessage({
                        chat_id: chat.id,
                        text: "你还没有词汇记录。先向我询问一些单词吧！",
                    })
                    return new Response("Ok")
                }

                if (allWords.length < 5) {
                    await bot.sendMessage({
                        chat_id: chat.id,
                        text: `你当前有 ${allWords.length} 个词汇，至少需要 5 个单词才能开始测验。继续学习更多单词吧！`,
                    })
                    return new Response("Ok")
                }

                // Get high-priority words (high weight = more mistakes)
                const priorityWords = await getUserVocabularyForQuiz(db, from.id, 10)

                await bot.sendMessage({
                    chat_id: chat.id,
                    text: `📚 正在从你的 ${allWords.length} 个词汇中生成测验...\n💡 本次测验将优先复习需要加强的单词`,
                })

                const questions = await generateQuiz({ bot, ai, tts }, priorityWords)

                if (questions.length === 0) {
                    await bot.sendMessage({
                        chat_id: chat.id,
                        text: "生成测验失败，请稍后再试。",
                    })
                    return new Response("Ok")
                }

                // Store quiz in D1 with 1 hour expiration
                await storeQuizState(db, from.id, questions)

                // Send first question
                await sendQuizQuestion({ bot, ai, tts }, chat.id, questions[0], 0, questions.length)
            }
        } else if (update.message?.reply_to_message && update.message.text && update.message.from) {
            // Handle text input replies (for translation questions)
            const { handleQuizTextAnswer } = await import("../lib/quiz")
            await handleQuizTextAnswer({ bot, ai, tts }, update.message.text, update.message.chat.id, update.message.from.id, db)
        } else if (
            update.message?.entities?.some((val) => val.type == "mention") &&
            update.message.text?.includes(`@${me.result.username}`)
        ) {
            // Handle mention (vocabulary query)
            await translate(update.message, { bot, ai, tts }, db)
        }

        // Handle daily tips workflow at the end (unified check for all interactions)
        await handleDailyTips(update, me.result.username, db, async (chatId, text, parseMode) => {
            await bot.sendMessage({
                chat_id: chatId,
                text: text,
                parse_mode: parseMode as "Markdown" | "HTML" | undefined,
            })
        })
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
