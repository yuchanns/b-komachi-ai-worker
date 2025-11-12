import { Hono } from "hono/tiny"
import { WEBHOOK, HOOK_PREFIX } from "../constants"
import { Bindings } from "../bindings"
import { createBot, createAI, createTTS } from "../services"
import { authorize } from "../middleware"
import {
    translate,
    getHelpMessage,
    handleDailyTips,
    getUserAIBackend,
    setUserAIBackend,
    getAvailableBackends,
    formatModelMenu,
    AI_BACKENDS,
    AIBackend,
    createI18nForUser,
    I18n,
    setUserLanguage,
} from "../lib"
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

    // Get user ID and language code for AI backend and language selection
    const userId = update.message?.from?.id || update.callback_query?.from?.id
    const telegramLanguageCode = update.message?.from?.language_code || update.callback_query?.from?.language_code
    const ai = await createAI(c, userId)

    // Create i18n instance for the user with auto-detection
    const i18n = await createI18nForUser(db, userId, telegramLanguageCode)

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
                text: getHelpMessage(i18n),
                parse_mode: "Markdown",
            })
        } else if (update.message?.text?.startsWith("/lang")) {
            // Handle /lang command
            const { chat, from, text } = update.message
            if (!from) {
                return new Response("Ok")
            }

            const args = text?.split(/\s+/)
            const langCode = args?.[1]

            if (!langCode) {
                // Show current language and available languages
                const message = i18n.t("language.current") + i18n.t("language.available") + i18n.t("language.switch_hint")
                await bot.sendMessage({
                    chat_id: chat.id,
                    text: message,
                    parse_mode: "Markdown",
                })
            } else if (I18n.isValidLocale(langCode)) {
                // Set user's preferred language (normalize the code)
                const locale = I18n.normalizeLocale(langCode)!
                await setUserLanguage(db, from.id, locale)

                // Switch i18n instance to new language for confirmation message
                i18n.switch(locale)

                await bot.sendMessage({
                    chat_id: chat.id,
                    text: i18n.t("language.switched"),
                    parse_mode: "Markdown",
                })
            } else {
                await bot.sendMessage({
                    chat_id: chat.id,
                    text: i18n.t("language.invalid", { code: langCode }),
                    parse_mode: "Markdown",
                })
            }
        } else if (update.message?.text?.startsWith("/model")) {
            // Handle /model command
            const { chat, from, text } = update.message
            if (!from) {
                return new Response("Ok")
            }

            const args = text?.split(/\s+/)
            const command = args?.[1]?.toLowerCase()

            if (!command) {
                // Show current model and available models
                const currentBackend = await getUserAIBackend(db, from.id)
                const menu = formatModelMenu(c.env, currentBackend, i18n)
                await bot.sendMessage({
                    chat_id: chat.id,
                    text: menu,
                    parse_mode: "Markdown",
                })
            } else if (AI_BACKENDS.includes(command as AIBackend)) {
                // Set user's preferred backend
                const backend = command as AIBackend
                const available = getAvailableBackends(c.env)

                if (!available.includes(backend)) {
                    await bot.sendMessage({
                        chat_id: chat.id,
                        text: i18n.t("model.not_configured", { backend }),
                        parse_mode: "Markdown",
                    })
                    return new Response("Ok")
                }

                await setUserAIBackend(db, from.id, backend)
                await bot.sendMessage({
                    chat_id: chat.id,
                    text: i18n.t("model.switched", { backend }),
                    parse_mode: "Markdown",
                })
            } else {
                const available = getAvailableBackends(c.env).join(", ")
                await bot.sendMessage({
                    chat_id: chat.id,
                    text: i18n.t("model.invalid", { backend: command, available }),
                    parse_mode: "Markdown",
                })
            }
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
                        text: i18n.t("quiz.not_enough_words", { min: 1, current: 0 }),
                    })
                    return new Response("Ok")
                }

                if (allWords.length < 5) {
                    await bot.sendMessage({
                        chat_id: chat.id,
                        text: i18n.t("quiz.not_enough_words", { min: 5, current: allWords.length }),
                    })
                    return new Response("Ok")
                }

                // Get high-priority words (high weight = more mistakes)
                const priorityWords = await getUserVocabularyForQuiz(db, from.id, 10)

                await bot.sendMessage({
                    chat_id: chat.id,
                    text: i18n.t("quiz.generating"),
                })

                const questions = await generateQuiz({ bot, ai, tts }, priorityWords, i18n)

                if (questions.length === 0) {
                    await bot.sendMessage({
                        chat_id: chat.id,
                        text: i18n.t("quiz.generation_error"),
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
        await handleDailyTips(
            update,
            me.result.username,
            db,
            async (chatId, text, parseMode) => {
                await bot.sendMessage({
                    chat_id: chatId,
                    text: text,
                    parse_mode: parseMode as "Markdown" | "HTML" | undefined,
                })
            },
            i18n
        )
    } catch (error) {
        console.error("Error handling update:", error)
        if (update.message) {
            await bot.sendMessage({
                chat_id: update.message.chat.id,
                text: i18n.t("error.general", { message: String(error) }),
            })
        }
    }
    return new Response("Ok")
})

export default hook
