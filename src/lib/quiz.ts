import { Injector } from "../bindings"
import { InlineKeyboardMarkup } from "../services/telegram"
import { createDrizzleClient } from "../db"
import { vocabulary, quizState } from "../db/schema"
import { eq, desc, lt, sql } from "drizzle-orm"

// Store vocabulary for a user using Drizzle ORM
export const storeVocabulary = async (db: D1Database, userId: number, word: string) => {
    const drizzle = createDrizzleClient(db)

    // Insert with default weight or ignore if word already exists (case-insensitive)
    try {
        await drizzle.insert(vocabulary).values({
            userId,
            word: word.trim(),
            timestamp: Date.now(),
            weight: 1.0,
            correctCount: 0,
            incorrectCount: 0,
            lastReviewed: null,
        })
    } catch (error) {
        // Ignore duplicate key errors due to UNIQUE constraint
        if (error instanceof Error && !error.message.includes("UNIQUE")) {
            throw error
        }
    }
    // No longer limit to 100 words - keep all vocabulary
}

// Get user's vocabulary for quiz - prioritize high weight words
export const getUserVocabularyForQuiz = async (db: D1Database, userId: number, limit: number = 5): Promise<string[]> => {
    const drizzle = createDrizzleClient(db)

    // Get words ordered by weight (descending) to prioritize words with more mistakes
    const result = await drizzle
        .select({ word: vocabulary.word })
        .from(vocabulary)
        .where(eq(vocabulary.userId, userId))
        .orderBy(desc(vocabulary.weight), desc(vocabulary.timestamp))
        .limit(limit)

    return result.map((row) => row.word)
}

// Get user's vocabulary count
export const getUserVocabulary = async (db: D1Database, userId: number): Promise<string[]> => {
    const drizzle = createDrizzleClient(db)

    const result = await drizzle
        .select({ word: vocabulary.word })
        .from(vocabulary)
        .where(eq(vocabulary.userId, userId))
        .orderBy(desc(vocabulary.timestamp))

    return result.map((row) => row.word)
}

// Update word weight based on quiz answer
export const updateWordWeight = async (db: D1Database, userId: number, word: string, isCorrect: boolean) => {
    const drizzle = createDrizzleClient(db)

    // Get current word data
    const wordData = await drizzle
        .select()
        .from(vocabulary)
        .where(sql`${vocabulary.userId} = ${userId} AND LOWER(${vocabulary.word}) = LOWER(${word})`)
        .limit(1)

    if (wordData.length === 0) return

    const current = wordData[0]

    // Calculate new weight
    // Correct answer: decrease weight (minimum 0.1)
    // Incorrect answer: increase weight (add 0.5 each time)
    let newWeight = current.weight
    if (isCorrect) {
        newWeight = Math.max(0.1, newWeight - 0.3)
    } else {
        newWeight = newWeight + 0.5
    }

    // Update statistics
    await drizzle
        .update(vocabulary)
        .set({
            weight: newWeight,
            correctCount: isCorrect ? current.correctCount + 1 : current.correctCount,
            incorrectCount: isCorrect ? current.incorrectCount : current.incorrectCount + 1,
            lastReviewed: Date.now(),
        })
        .where(sql`${vocabulary.userId} = ${userId} AND LOWER(${vocabulary.word}) = LOWER(${word})`)
}

// Quiz question type with multiple question types
export interface QuizQuestion {
    type: "meaning" | "fill_blank" | "synonym" | "translation" | "word_form"
    word: string
    question: string // The actual question text
    correct_answer: string
    options: string[]
    correct_index: number
    explanation?: string // Optional explanation for the answer
}

// Generate quiz questions from user vocabulary
const promptToGenerateQuiz = (words: string[]) => {
    const wordList = words.join(", ")
    return [
        {
            role: "system",
            content: `你是一个专业的英语词汇测验生成器。请生成多样化的测验问题，包含以下几种题型：

1. **词义选择** (meaning): 询问单词的中文含义
2. **填空题** (fill_blank): 给出句子和语境，选择正确的单词
3. **同义词/反义词** (synonym): 选择同义词或反义词
4. **句子翻译** (translation): 包含该单词的英文句子翻译成中文
5. **词形变化** (word_form): 根据语境选择正确的词形（时态、单复数等）

每个问题的 JSON 格式：
{
    "type": "题型类型",
    "word": "测试的单词（英文）",
    "question": "问题文本（中文）",
    "correct_answer": "正确答案",
    "options": ["选项1", "选项2", "选项3", "选项4"],
    "correct_index": 0-3,
    "explanation": "答案解释（可选）"
}

要求：
- 题型要多样化，不要全是同一种类型
- 选项要有迷惑性但明确可辨
- 问题要清晰、符合实际使用场景
- 只返回 JSON 数组，不要其他文本`,
        },
        {
            role: "user",
            content: `为这些英文单词生成 5 道测验题：${wordList}

请生成多样化的题型组合，例如：
- 2道词义选择题
- 1道填空题  
- 1道同义词题
- 1道句子翻译题

确保题目难度适中，适合英语学习者。
只返回 JSON 数组，不要 markdown 格式。`,
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
                (q) =>
                    q.type &&
                    q.word &&
                    q.question &&
                    q.correct_answer &&
                    q.options &&
                    q.options.length === 4 &&
                    q.correct_index >= 0 &&
                    q.correct_index < 4
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

    // Get question type emoji
    const typeEmoji = {
        meaning: "📖",
        fill_blank: "✍️",
        synonym: "🔄",
        translation: "🌐",
        word_form: "📝",
    }

    const questionText =
        `${typeEmoji[question.type] || "📝"} *测验题目 ${questionIndex + 1}/${totalQuestions}*\n\n` +
        `${question.question}\n\n` +
        `请选择正确答案：`

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

    // Update word weight based on answer
    await updateWordWeight(db, userId, question.word, isCorrect)

    // Update stored quiz using Drizzle ORM
    await drizzle
        .update(quizState)
        .set({
            answers: JSON.stringify(quiz.answers),
        })
        .where(eq(quizState.userId, userId))

    // Update message with result
    const typeEmoji = {
        meaning: "📖",
        fill_blank: "✍️",
        synonym: "🔄",
        translation: "🌐",
        word_form: "📝",
    }

    let resultText =
        `${typeEmoji[question.type] || "📝"} *测验题目 ${questionIndex + 1}/${quiz.questions.length}*\n\n` + `${question.question}\n\n`

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

    // Add explanation if available
    if (question.explanation) {
        resultText += `\n\n💡 ${question.explanation}`
    }

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
