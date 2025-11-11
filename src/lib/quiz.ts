import { Injector } from "../bindings"
import { InlineKeyboardMarkup } from "../services/telegram"

// Store vocabulary for a user
export const storeVocabulary = async (db: D1Database, userId: number, word: string) => {
    // Insert or ignore if word already exists (case-insensitive)
    await db
        .prepare(
            `INSERT INTO vocabulary (user_id, word, timestamp) 
             VALUES (?, ?, ?) 
             ON CONFLICT(user_id, word) DO NOTHING`
        )
        .bind(userId, word.trim(), Date.now())
        .run()

    // Keep only last 100 words per user
    await db
        .prepare(
            `DELETE FROM vocabulary 
             WHERE user_id = ? 
             AND id NOT IN (
                 SELECT id FROM vocabulary 
                 WHERE user_id = ? 
                 ORDER BY timestamp DESC 
                 LIMIT 100
             )`
        )
        .bind(userId, userId)
        .run()
}

// Get user's vocabulary
export const getUserVocabulary = async (db: D1Database, userId: number): Promise<string[]> => {
    const result = await db
        .prepare(
            `SELECT word FROM vocabulary 
             WHERE user_id = ? 
             ORDER BY timestamp DESC`
        )
        .bind(userId)
        .all<{ word: string }>()

    return result.results?.map((row) => row.word) || []
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
            content: `You are a vocabulary quiz generator. Generate quiz questions in JSON format.
Each question should have:
- word: the vocabulary word
- correct_meaning: the correct definition
- options: an array of 4 possible meanings (including the correct one)
- correct_index: the index (0-3) of the correct answer in the options array

Return ONLY a valid JSON array with no additional text or markdown.`,
        },
        {
            role: "user",
            content: `Generate 5 multiple choice quiz questions for these words: ${wordList}. 
Each question should test the meaning of the word with 4 options. 
Make sure the wrong options are plausible but clearly different from the correct answer.
Return ONLY a JSON array, no markdown, no explanation.`,
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
        `📝 *Quiz Question ${questionIndex + 1}/${totalQuestions}*\n\n` +
        `What is the meaning of "*${question.word}*"?\n\n` +
        `Choose the correct answer:`

    await bot.sendMessage({
        chat_id,
        text: questionText,
        parse_mode: "Markdown",
        reply_markup: keyboard,
    })
}

// Store quiz state in database
export const storeQuizState = async (db: D1Database, userId: number, questions: QuizQuestion[]) => {
    const now = Date.now()
    const expiresAt = now + 3600000 // 1 hour

    await db
        .prepare(
            `INSERT INTO quiz_state (user_id, questions, answers, created_at, expires_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(user_id) DO UPDATE SET
                 questions = excluded.questions,
                 answers = excluded.answers,
                 created_at = excluded.created_at,
                 expires_at = excluded.expires_at`
        )
        .bind(userId, JSON.stringify(questions), JSON.stringify(Array(questions.length).fill(-1)), now, expiresAt)
        .run()
}

// Handle quiz answer callback
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

    // Parse callback data: quiz:questionIndex:selectedIndex
    const parts = data.split(":")
    if (parts.length !== 3 || parts[0] !== "quiz") {
        await bot.answerCallbackQuery({
            callback_query_id: callbackQueryId,
            text: "Invalid quiz data",
        })
        return
    }

    const questionIndex = parseInt(parts[1])
    const selectedIndex = parseInt(parts[2])

    // Get stored quiz data
    const result = await db
        .prepare(
            `SELECT questions, answers FROM quiz_state 
             WHERE user_id = ? 
             AND expires_at > ?`
        )
        .bind(userId, Date.now())
        .first<{ questions: string; answers: string }>()

    if (!result) {
        await bot.answerCallbackQuery({
            callback_query_id: callbackQueryId,
            text: "Quiz expired. Please start a new quiz.",
            show_alert: true,
        })
        return
    }

    const quiz: { questions: QuizQuestion[]; answers: number[] } = {
        questions: JSON.parse(result.questions),
        answers: JSON.parse(result.answers),
    }
    const question = quiz.questions[questionIndex]

    if (!question) {
        await bot.answerCallbackQuery({
            callback_query_id: callbackQueryId,
            text: "Question not found",
        })
        return
    }

    // Check answer
    const isCorrect = selectedIndex === question.correct_index
    quiz.answers[questionIndex] = isCorrect ? 1 : 0

    // Update stored quiz
    await db
        .prepare(
            `UPDATE quiz_state 
             SET answers = ? 
             WHERE user_id = ?`
        )
        .bind(JSON.stringify(quiz.answers), userId)
        .run()

    // Update message with result
    let resultText =
        `📝 *Quiz Question ${questionIndex + 1}/${quiz.questions.length}*\n\n` + `What is the meaning of "*${question.word}*"?\n\n`

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

    resultText += `\n${isCorrect ? "🎉 Correct!" : `❌ Wrong! The correct answer is: ${question.options[question.correct_index]}`}`

    await bot.editMessageText({
        chat_id,
        message_id,
        text: resultText,
        parse_mode: "Markdown",
    })

    await bot.answerCallbackQuery({
        callback_query_id: callbackQueryId,
        text: isCorrect ? "✅ Correct!" : "❌ Wrong!",
    })

    // Check if all questions answered
    const allAnswered = quiz.answers.every((a) => a !== -1)
    if (allAnswered) {
        const score = quiz.answers.reduce((sum, a) => sum + a, 0)
        const total = quiz.questions.length

        await bot.sendMessage({
            chat_id,
            text: `🎊 *Quiz Complete!*\n\nYour score: ${score}/${total} (${Math.round((score / total) * 100)}%)`,
            parse_mode: "Markdown",
        })

        // Clean up quiz data
        await db.prepare(`DELETE FROM quiz_state WHERE user_id = ?`).bind(userId).run()
    } else {
        // Send next unanswered question
        const nextIndex = quiz.answers.findIndex((a) => a === -1)
        if (nextIndex !== -1) {
            setTimeout(async () => {
                await sendQuizQuestion(inj, chat_id, quiz.questions[nextIndex], nextIndex, quiz.questions.length)
            }, 2000)
        }
    }
}

// Clean up expired quiz states (can be called periodically)
export const cleanupExpiredQuizzes = async (db: D1Database) => {
    await db.prepare(`DELETE FROM quiz_state WHERE expires_at <= ?`).bind(Date.now()).run()
}
