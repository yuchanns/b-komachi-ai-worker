import { D1Database } from "@cloudflare/workers-types"
import { eq, and } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { userInteractions } from "../db/schema"
import { Update } from "../services/telegram"
import { I18n, formatHelpMessage, formatTipsMessage } from "./i18n"

/**
 * Get help message for a user
 * @deprecated Use getHelpMessage with I18n instance instead
 */
export const HELP_MESSAGE = formatHelpMessage(new I18n("zh-CN"))

/**
 * Get help message using i18n
 */
export function getHelpMessage(i18n: I18n): string {
    return formatHelpMessage(i18n)
}

/**
 * Get today's date in YYYY-MM-DD format (UTC)
 */
export const getTodayDate = (): string => {
    const now = new Date()
    return now.toISOString().split("T")[0]
}

/**
 * Check if this is the user's first interaction today
 */
export const isFirstInteractionToday = async (db: D1Database, userId: number): Promise<boolean> => {
    const today = getTodayDate()
    const orm = drizzle(db)

    const result = await orm
        .select()
        .from(userInteractions)
        .where(and(eq(userInteractions.userId, userId), eq(userInteractions.interactionDate, today)))
        .limit(1)

    return result.length === 0
}

/**
 * Record user interaction for today
 */
export const recordUserInteraction = async (db: D1Database, userId: number): Promise<void> => {
    const today = getTodayDate()
    const orm = drizzle(db)

    try {
        await orm.insert(userInteractions).values({
            userId,
            interactionDate: today,
        })
    } catch (error) {
        // Ignore duplicate key errors (user already has interaction today)
        console.log("User interaction already recorded for today or error:", error)
    }
}

/**
 * Get a shortened tips message for daily first interaction
 * @deprecated Use getTipsMessageWithI18n instead
 */
export const getTipsMessage = (): string => {
    return formatTipsMessage(new I18n("zh-CN"))
}

/**
 * Get tips message using i18n
 */
export function getTipsMessageWithI18n(i18n: I18n): string {
    return formatTipsMessage(i18n)
}

/**
 * Interaction matcher function type
 */
export type InteractionMatcher = (update: Update, botUsername: string) => boolean

/**
 * Registry of all interaction matchers
 * Each matcher should return true if the update represents that type of interaction
 */
const interactionMatchers: InteractionMatcher[] = []

/**
 * Register a new interaction matcher
 * This should be called when defining new command handlers
 */
export const registerInteraction = (matcher: InteractionMatcher): void => {
    interactionMatchers.push(matcher)
}

/**
 * Check if the update represents any registered user interaction
 */
export const isUserInteraction = (update: Update, botUsername: string): boolean => {
    return interactionMatchers.some((matcher) => matcher(update, botUsername))
}

/**
 * Register built-in interaction matchers
 */

// Command matcher: /help, /quiz, /model, /lang, etc.
registerInteraction((update: Update) => {
    const text = update.message?.text
    if (!text) return false
    return text.startsWith("/help") || text.startsWith("/quiz") || text.startsWith("/model") || text.startsWith("/lang")
})

// Vocabulary query matcher: @bot_name word
registerInteraction((update: Update, botUsername: string) => {
    return update.message?.entities?.some((val) => val.type == "mention") && !!update.message.text?.includes(`@${botUsername}`)
})

// Quiz text answer matcher: reply to bot message
registerInteraction((update: Update) => {
    return !!(update.message?.reply_to_message && update.message.text && update.message.from)
})

/**
 * Handle daily tips workflow at the end of message processing
 * This should be called after the main interaction is handled
 */
export const handleDailyTips = async (
    update: Update,
    botUsername: string,
    db: D1Database,
    sendMessage: (chatId: number, text: string, parseMode?: string) => Promise<void>,
    i18n?: I18n
): Promise<void> => {
    // Only process regular messages (not callback queries)
    if (!update.message?.from) {
        return
    }

    // Check if this is a valid interaction
    if (!isUserInteraction(update, botUsername)) {
        return
    }

    // Check if this is the user's first interaction today
    const isFirstToday = await isFirstInteractionToday(db, update.message.from.id)
    if (!isFirstToday) {
        return
    }

    // Record the interaction
    await recordUserInteraction(db, update.message.from.id)

    // Send tips message with i18n support
    const tipsMessage = i18n ? formatTipsMessage(i18n) : getTipsMessage()
    await sendMessage(update.message.chat.id, tipsMessage, "Markdown")
}
