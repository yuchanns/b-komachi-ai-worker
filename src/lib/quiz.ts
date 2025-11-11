import { Injector } from "../bindings"
import { InlineKeyboardMarkup } from "../services/telegram"
import { createDrizzleClient } from "../db"
import { vocabulary, quizState } from "../db/schema"
import { eq, desc, lt, sql } from "drizzle-orm"

// Store vocabulary for a user using Drizzle ORM
export const storeVocabulary = async (db: D1Database, userId: number, word: string) => {
    const drizzle = createDrizzleClient(db)

    // Insert or ignore if word already exists (case-insensitive)
    try {
        await drizzle.insert(vocabulary).values({
            userId,
            word: word.trim(),
            timestamp: Date.now(),
        })
    } catch (error) {
        // Ignore duplicate key errors due to UNIQUE constraint
        if (error instanceof Error && !error.message.includes("UNIQUE")) {
            throw error
        }
    }

    // Keep only last 100 words per user
    const userWords = await drizzle
        .select({ id: vocabulary.id })
        .from(vocabulary)
        .where(eq(vocabulary.userId, userId))
        .orderBy(desc(vocabulary.timestamp))
        .limit(100)

    if (userWords.length === 100) {
        const keepIds = userWords.map((w) => w.id)
        await drizzle.delete(vocabulary).where(sql`${vocabulary.userId} = ${userId} AND ${vocabulary.id} NOT IN ${keepIds}`)
    }
}

// Get user's vocabulary using Drizzle ORM
export const getUserVocabulary = async (db: D1Database, userId: number): Promise<string[]> => {
    const drizzle = createDrizzleClient(db)

    const result = await drizzle
        .select({ word: vocabulary.word })
        .from(vocabulary)
        .where(eq(vocabulary.userId, userId))
        .orderBy(desc(vocabulary.timestamp))

    return result.map((row) => row.word)
}

// Quiz question type
export interface QuizQuestion {
    word: string
    correct_meaning: string
    options: string[]
    correct_index: number
}

// Generate quiz questions from user vocabulary
const promptToGenerateQuiz = (words: string[]) => {
    const wordList = words.join(", ")
    return [
        {
            role: "system",
            content: `你是一个词汇测验生成器。请生成 JSON 格式的测验问题。
每个问题应该包含：
- word: 词汇单词（保持英文原词）
- correct_meaning: 正确的中文释义
- options: 包含4个可能的中文释义的数组（包括正确答案）
- correct_index: 正确答案在 options 数组中的索引（0-3）

只返回一个有效的 JSON 数组，不要有其他文本或 markdown 格式。`,
        },
        {
            role: "user",
            content: `为这些英文单词生成 5 道选择题：${wordList}。
每道题应该测试单词的中文含义，提供 4 个中文选项。
确保错误选项听起来合理但与正确答案明显不同。
只返回 JSON 数组，不要 markdown，不要解释。`,
        },
    ]
}

export const generateQuiz = async (inj: Injector, words: string[]): Promise<QuizQuestion[]> => {
    if (words.length === 0) {
        return []
    }

    // Select random words (up to 10) for quiz
    const selectedWords = words.sort(() => Math.random() - 0.5).slice(0, Math.min(10, words.length))

    const params = {
        messages: promptToGenerateQuiz(selectedWords),
        temperature: 0.7,
    }

    const response = await inj.ai.chat(params)
    const content = response?.choices[0]?.message.content || "[]"

    try {
        // Clean up potential markdown formatting
        const cleanContent = content
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim()
        const questions: QuizQuestion[] = JSON.parse(cleanContent)

        // Validate and take up to 5 questions
        return questions
            .filter(
                (q) => q.word && q.correct_meaning && q.options && q.options.length === 4 && q.correct_index >= 0 && q.correct_index < 4
            )
            .slice(0, 5)
    } catch (error) {
        console.error("Failed to parse quiz questions:", error, content)
        return []
    }
}

// Send a quiz question with inline keyboard
export const sendQuizQuestion = async (
    inj: Injector,
    chat_id: number,
    question: QuizQuestion,
    questionIndex: number,
    totalQuestions: number
) => {
    const { bot } = inj

    // Create inline keyboard with answer options
    const keyboard: InlineKeyboardMarkup = {
        inline_keyboard: question.options.map((option, index) => [
            {
                text: `${String.fromCharCode(65 + index)}. ${option}`,
                callback_data: `quiz:${questionIndex}:${index}`,
            },
        ]),
    }

    const questionText =
        `📝 *测验题目 ${questionIndex + 1}/${totalQuestions}*\n\n` + `"*${question.word}*" 的中文意思是什么？\n\n` + `请选择正确答案：`

    await bot.sendMessage({
        chat_id,
        text: questionText,
        parse_mode: "Markdown",
        reply_markup: keyboard,
    })
}

// Store quiz state in database using Drizzle ORM
export const storeQuizState = async (db: D1Database, userId: number, questions: QuizQuestion[]) => {
    const drizzle = createDrizzleClient(db)
    const now = Date.now()
    const expiresAt = now + 3600000 // 1 hour

    await drizzle
        .insert(quizState)
        .values({
            userId,
            questions: JSON.stringify(questions),
            answers: JSON.stringify(Array(questions.length).fill(-1)),
            createdAt: now,
            expiresAt,
        })
        .onConflictDoUpdate({
            target: quizState.userId,
            set: {
                questions: JSON.stringify(questions),
                answers: JSON.stringify(Array(questions.length).fill(-1)),
                createdAt: now,
                expiresAt,
            },
        })
}

// Handle quiz answer callback using Drizzle ORM
export const handleQuizAnswer = async (
    inj: Injector,
    callbackQueryId: string,
    data: string,
    chat_id: number,
    message_id: number,
    userId: number,
    db: D1Database
) => {
    const { bot } = inj
    const drizzle = createDrizzleClient(db)

    // Parse callback data: quiz:questionIndex:selectedIndex
    const parts = data.split(":")
    if (parts.length !== 3 || parts[0] !== "quiz") {
        await bot.answerCallbackQuery({
            callback_query_id: callbackQueryId,
            text: "无效的测验数据",
        })
        return
    }

    const questionIndex = parseInt(parts[1])
    const selectedIndex = parseInt(parts[2])

    // Get stored quiz data using Drizzle ORM
    const result = await drizzle
        .select()
        .from(quizState)
        .where(sql`${quizState.userId} = ${userId} AND ${quizState.expiresAt} > ${Date.now()}`)
        .limit(1)

    if (!result || result.length === 0) {
        await bot.answerCallbackQuery({
            callback_query_id: callbackQueryId,
            text: "测验已过期，请开始新的测验。",
            show_alert: true,
        })
        return
    }

    const quizData = result[0]
    const quiz: { questions: QuizQuestion[]; answers: number[] } = {
        questions: JSON.parse(quizData.questions),
        answers: JSON.parse(quizData.answers),
    }
    const question = quiz.questions[questionIndex]

    if (!question) {
        await bot.answerCallbackQuery({
            callback_query_id: callbackQueryId,
            text: "题目未找到",
        })
        return
    }

    // Check answer
    const isCorrect = selectedIndex === question.correct_index
    quiz.answers[questionIndex] = isCorrect ? 1 : 0

    // Update stored quiz using Drizzle ORM
    await drizzle
        .update(quizState)
        .set({
            answers: JSON.stringify(quiz.answers),
        })
        .where(eq(quizState.userId, userId))

    // Update message with result
    let resultText = `📝 *测验题目 ${questionIndex + 1}/${quiz.questions.length}*\n\n` + `"*${question.word}*" 的中文意思是什么？\n\n`

    question.options.forEach((option, index) => {
        const prefix = String.fromCharCode(65 + index)
        if (index === selectedIndex) {
            if (isCorrect) {
                resultText += `✅ ${prefix}. ${option}\n`
            } else {
                resultText += `❌ ${prefix}. ${option}\n`
            }
        } else if (index === question.correct_index) {
            resultText += `✅ ${prefix}. ${option}\n`
        } else {
            resultText += `${prefix}. ${option}\n`
        }
    })

    resultText += `\n${isCorrect ? "🎉 回答正确！" : `❌ 回答错误！正确答案是：${question.options[question.correct_index]}`}`

    await bot.editMessageText({
        chat_id,
        message_id,
        text: resultText,
        parse_mode: "Markdown",
    })

    await bot.answerCallbackQuery({
        callback_query_id: callbackQueryId,
        text: isCorrect ? "✅ 正确！" : "❌ 错误！",
    })

    // Check if all questions answered
    const allAnswered = quiz.answers.every((a) => a !== -1)
    if (allAnswered) {
        const score = quiz.answers.reduce((sum, a) => sum + a, 0)
        const total = quiz.questions.length

        await bot.sendMessage({
            chat_id,
            text: `🎊 *测验完成！*\n\n你的得分：${score}/${total} (${Math.round((score / total) * 100)}%)`,
            parse_mode: "Markdown",
        })

        // Clean up quiz data using Drizzle ORM
        await drizzle.delete(quizState).where(eq(quizState.userId, userId))
    } else {
        // Send next unanswered question immediately (no setTimeout in Workers)
        const nextIndex = quiz.answers.findIndex((a) => a === -1)
        if (nextIndex !== -1) {
            await sendQuizQuestion(inj, chat_id, quiz.questions[nextIndex], nextIndex, quiz.questions.length)
        }
    }
}

// Clean up expired quiz states using Drizzle ORM
export const cleanupExpiredQuizzes = async (db: D1Database) => {
    const drizzle = createDrizzleClient(db)
    await drizzle.delete(quizState).where(lt(quizState.expiresAt, Date.now()))
}
