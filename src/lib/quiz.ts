import { Injector } from "../bindings"
import { InlineKeyboardMarkup } from "../services/telegram"

// Store vocabulary for a user
export const storeVocabulary = async (vocabulary: KVNamespace, userId: number, word: string) => {
    const key = `vocab:${userId}`
    const existingData = await vocabulary.get(key)
    let words: Array<{ word: string; timestamp: number }> = []

    if (existingData) {
        words = JSON.parse(existingData)
    }

    // Check if word already exists
    const wordExists = words.find((w) => w.word.toLowerCase() === word.toLowerCase())
    if (!wordExists) {
        words.push({ word, timestamp: Date.now() })
        // Keep only last 100 words
        if (words.length > 100) {
            words = words.slice(-100)
        }
        await vocabulary.put(key, JSON.stringify(words))
    }
}

// Get user's vocabulary
export const getUserVocabulary = async (vocabulary: KVNamespace, userId: number): Promise<string[]> => {
    const key = `vocab:${userId}`
    const existingData = await vocabulary.get(key)

    if (!existingData) {
        return []
    }

    const words: Array<{ word: string; timestamp: number }> = JSON.parse(existingData)
    return words.map((w) => w.word)
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

// Handle quiz answer callback
export const handleQuizAnswer = async (
    inj: Injector,
    callbackQueryId: string,
    data: string,
    chat_id: number,
    message_id: number,
    userId: number,
    vocabulary: KVNamespace
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
    const quizKey = `quiz:${userId}`
    const quizData = await vocabulary.get(quizKey)

    if (!quizData) {
        await bot.answerCallbackQuery({
            callback_query_id: callbackQueryId,
            text: "Quiz expired. Please start a new quiz.",
            show_alert: true,
        })
        return
    }

    const quiz: { questions: QuizQuestion[]; answers: number[] } = JSON.parse(quizData)
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
    await vocabulary.put(quizKey, JSON.stringify(quiz), { expirationTtl: 3600 })

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
        await vocabulary.delete(quizKey)
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
