import { D1Database } from "@cloudflare/workers-types"
import { eq, and } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { userInteractions } from "../db/schema"
import { Update } from "../services/telegram"

/**
 * Help message content based on README usage section
 */
export const HELP_MESSAGE = `
📚 *B-Komachi AI 词汇助手使用指南*

*🔍 查询单词*
在群组或私聊中 @ 我并输入单词或短语：
\`@bot_name sophisticated\`

我会为你提供：
• 发音（IPA音标）
• 详细释义、例句
• 词源、派生词、同义词和相关词
• 语音朗读
• 自动保存到你的词汇历史

*📝 每日测验*
基于你的词汇历史开始测验：
\`/quiz\`

测验特点：
• 从你的词汇记录中生成选择题
• 每题提供4个选项的交互式按钮
• 即时反馈答案正确性
• 显示最终得分
• 优先复习需要加强的单词

_注意：至少需要查询几个单词才能使用测验功能_

*🤖 切换 AI 模型*
查看和切换 AI 模型：
\`/model\` - 查看可用模型
\`/model <backend>\` - 切换模型

支持的后端：azure、gemini、openai
例如：\`/model gemini\`

*💡 帮助*
随时发送 \`/help\` 查看此帮助信息

祝你学习愉快！🌟
`.trim()

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
 */
export const getTipsMessage = (): string => {
    return `
💡 *使用提示*

发送 \`/help\` 查看完整使用指南
发送 \`/quiz\` 开始词汇测验
@ 我并输入单词查询释义

祝你学习愉快！
`.trim()
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

// Command matcher: /help, /quiz, /model, etc.
registerInteraction((update: Update) => {
    const text = update.message?.text
    if (!text) return false
    return text.startsWith("/help") || text.startsWith("/quiz") || text.startsWith("/model")
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
    sendMessage: (chatId: number, text: string, parseMode?: string) => Promise<void>
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

    // Send tips message
    await sendMessage(update.message.chat.id, getTipsMessage(), "Markdown")
}
