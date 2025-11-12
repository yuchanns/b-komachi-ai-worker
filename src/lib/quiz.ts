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
    type: "meaning" | "fill_blank" | "synonym" | "translation_input" | "translation_cn_to_en" | "word_form"
    word: string
    question: string // The actual question text
    correct_answer: string
    options: string[] // Empty for input-based questions
    correct_index: number // -1 for input-based questions
    explanation?: string // Optional explanation for the answer
    isInputBased?: boolean // true for questions requiring text input
}

// Question type definitions for generating quizzes
type QuestionType = "meaning" | "fill_blank" | "synonym" | "translation_input" | "translation_cn_to_en" | "word_form"

// Predefined quiz patterns - code determines the question types
const QUIZ_PATTERNS: QuestionType[][] = [
    ["meaning", "fill_blank", "synonym", "translation_input", "translation_cn_to_en"],
    ["meaning", "translation_input", "fill_blank", "translation_cn_to_en", "synonym"],
    ["translation_input", "meaning", "synonym", "translation_cn_to_en", "fill_blank"],
]

// Generate a single quiz question of a specific type
const promptToGenerateQuestion = (word: string, type: QuestionType) => {
    const prompts = {
        meaning: {
            system: `你是一个专业的英语词汇测验生成器。请为单词"${word}"生成一道词义选择题。

要求：
- 询问单词的中文含义
- 提供4个选项（一个正确答案，三个迷惑选项）
- 迷惑选项要有一定相似性但明确可辨

返回 JSON 格式：
{
    "type": "meaning",
    "word": "${word}",
    "question": "问题文本",
    "correct_answer": "正确的中文含义",
    "options": ["正确答案", "选项2", "选项3", "选项4"],
    "correct_index": 0,
    "explanation": "可选的解释"
}

只返回 JSON，不要 markdown 格式。`,
            user: `为单词 "${word}" 生成词义选择题。`,
        },
        fill_blank: {
            system: `你是一个专业的英语词汇测验生成器。请为单词"${word}"生成一道填空题。

要求：
- 给出一个包含 ___ 标记的英文句子
- ___ 的位置应该填入单词"${word}"
- 提供4个选项（包括正确答案和3个语法上可能但语义不对的选项）

返回 JSON 格式：
{
    "type": "fill_blank",
    "word": "${word}",
    "question": "句子，例如：The ___ is very important. 应该填入哪个单词？",
    "correct_answer": "${word}",
    "options": ["${word}", "选项2", "选项3", "选项4"],
    "correct_index": 0,
    "explanation": "可选的解释"
}

只返回 JSON，不要 markdown 格式。`,
            user: `为单词 "${word}" 生成填空题，必须在句子中使用 ___ 标记。`,
        },
        synonym: {
            system: `你是一个专业的英语词汇测验生成器。请为单词"${word}"生成一道同义词或反义词选择题。

要求：
- 询问单词的同义词或反义词
- 提供4个选项

返回 JSON 格式：
{
    "type": "synonym",
    "word": "${word}",
    "question": "问题文本",
    "correct_answer": "正确答案",
    "options": ["正确答案", "选项2", "选项3", "选项4"],
    "correct_index": 0,
    "explanation": "可选的解释"
}

只返回 JSON，不要 markdown 格式。`,
            user: `为单词 "${word}" 生成同义词或反义词选择题。`,
        },
        translation_input: {
            system: `你是一个专业的英语词汇测验生成器。请为单词"${word}"生成一道英译中翻译题。

要求：
- 给出一个包含单词"${word}"的英文句子
- 让用户输入中文翻译
- 这是输入题，不需要选项

返回 JSON 格式：
{
    "type": "translation_input",
    "word": "${word}",
    "question": "请将以下英文翻译成中文：\\n\\"英文句子\\"",
    "correct_answer": "参考中文翻译",
    "options": [],
    "correct_index": -1,
    "isInputBased": true,
    "explanation": "可选的解释"
}

只返回 JSON，不要 markdown 格式。`,
            user: `为单词 "${word}" 生成英译中翻译题。`,
        },
        translation_cn_to_en: {
            system: `你是一个专业的英语词汇测验生成器。请为单词"${word}"生成一道中译英翻译题。

要求：
- 给出一个中文句子
- 要求用户使用单词"${word}"翻译成英文
- 这是输入题，不需要选项

返回 JSON 格式：
{
    "type": "translation_cn_to_en",
    "word": "${word}",
    "question": "请使用单词 \\"${word}\\" 将以下中文翻译成英文：\\n\\"中文句子\\"",
    "correct_answer": "参考英文翻译",
    "options": [],
    "correct_index": -1,
    "isInputBased": true,
    "explanation": "可选的解释"
}

只返回 JSON，不要 markdown 格式。`,
            user: `为单词 "${word}" 生成中译英翻译题。`,
        },
        word_form: {
            system: `你是一个专业的英语词汇测验生成器。请为单词"${word}"生成一道词形变化题。

要求：
- 给出一个语境
- 让用户选择正确的词形（时态、单复数等）
- 提供4个选项

返回 JSON 格式：
{
    "type": "word_form",
    "word": "${word}",
    "question": "问题文本",
    "correct_answer": "正确的词形",
    "options": ["正确答案", "选项2", "选项3", "选项4"],
    "correct_index": 0,
    "explanation": "可选的解释"
}

只返回 JSON，不要 markdown 格式。`,
            user: `为单词 "${word}" 生成词形变化题。`,
        },
    }

    const prompt = prompts[type]
    return [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
    ]
}

export const generateQuiz = async (inj: Injector, words: string[]): Promise<QuizQuestion[]> => {
    if (words.length === 0) {
        return []
    }

    // Select random words (up to 10) for quiz
    const selectedWords = words.sort(() => Math.random() - 0.5).slice(0, Math.min(10, words.length))

    // Select a quiz pattern randomly - code determines question types
    const pattern = QUIZ_PATTERNS[Math.floor(Math.random() * QUIZ_PATTERNS.length)]

    // Generate questions one by one with predetermined types
    const questions: QuizQuestion[] = []
    for (let i = 0; i < Math.min(5, selectedWords.length); i++) {
        const word = selectedWords[i]
        const type = pattern[i]

        try {
            const params = {
                messages: promptToGenerateQuestion(word, type),
                temperature: 0.7,
            }

            const response = await inj.ai.chat(params)
            const content = response?.choices[0]?.message.content || "{}"

            // Clean up potential markdown formatting
            const cleanContent = content
                .replace(/```json\n?/g, "")
                .replace(/```\n?/g, "")
                .trim()

            let question: QuizQuestion = JSON.parse(cleanContent)

            // Normalize question - ensure fields are correct based on type
            const isTranslationType = type === "translation_input" || type === "translation_cn_to_en"
            question = {
                ...question,
                type: type, // Force the type we requested
                isInputBased: isTranslationType,
                options: isTranslationType ? [] : question.options || [],
                correct_index: isTranslationType ? -1 : question.correct_index,
            }

            // Validate question
            if (question.word && question.question && question.correct_answer) {
                if (question.isInputBased) {
                    // Input-based question is valid
                    questions.push(question)
                } else if (question.options && question.options.length === 4 && question.correct_index >= 0 && question.correct_index < 4) {
                    // Multiple choice question is valid
                    questions.push(question)
                } else {
                    console.error(`Invalid question generated for word "${word}", type "${type}":`, question)
                }
            } else {
                console.error(`Incomplete question generated for word "${word}", type "${type}":`, question)
            }
        } catch (error) {
            console.error(`Failed to generate question for word "${word}", type "${type}":`, error)
            // Continue to next question even if this one fails
        }
    }

    console.log(`Generated ${questions.length} valid questions out of ${Math.min(5, selectedWords.length)} attempted`)
    return questions
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

    // Get question type emoji
    const typeEmoji = {
        meaning: "📖",
        fill_blank: "✍️",
        synonym: "🔄",
        translation_input: "🌐",
        translation_cn_to_en: "🌏",
        word_form: "📝",
    }

    const questionText =
        `${typeEmoji[question.type] || "📝"} *测验题目 ${questionIndex + 1}/${totalQuestions}*\n\n` + `${question.question}\n\n`

    // For input-based questions (translation), use ForceReply to collect text input
    if (question.isInputBased) {
        try {
            await bot.sendMessage({
                chat_id,
                text: questionText + `请直接输入你的答案：`,
                parse_mode: "Markdown",
                reply_markup: {
                    force_reply: true,
                    input_field_placeholder: "输入你的翻译...",
                    selective: true,
                },
            })
        } catch (error) {
            console.error(`Failed to send input-based question to chat ${chat_id}:`, error)
            throw error // Re-throw so caller can handle
        }
    } else {
        // Create inline keyboard with answer options for multiple choice
        // Safety check: ensure options exist and have items
        if (!question.options || question.options.length === 0) {
            const errorMsg = `Question type "${question.type}" for word "${question.word}" has no options`
            console.error(errorMsg, question)
            throw new Error(errorMsg)
        }

        const keyboard: InlineKeyboardMarkup = {
            inline_keyboard: question.options.map((option, index) => [
                {
                    text: `${String.fromCharCode(65 + index)}. ${option}`,
                    callback_data: `quiz:${questionIndex}:${index}`,
                },
            ]),
        }

        try {
            await bot.sendMessage({
                chat_id,
                text: questionText + `请选择正确答案：`,
                parse_mode: "Markdown",
                reply_markup: keyboard,
            })
        } catch (error) {
            console.error(`Failed to send multiple choice question to chat ${chat_id}:`, error)
            throw error // Re-throw so caller can handle
        }
    }
}

// Validate translation answer using AI
const validateTranslation = async (
    inj: Injector,
    userAnswer: string,
    correctAnswer: string,
    questionType: string,
    word: string
): Promise<{ isCorrect: boolean; feedback: string }> => {
    const prompt =
        questionType === "translation_cn_to_en"
            ? [
                  {
                      role: "system",
                      content: `你是一个英语翻译评分专家。请评估用户的英语翻译是否正确。

评分标准：
1. 必须包含指定的单词："${word}"
2. 意思准确、完整
3. 语法正确
4. 用词恰当

请返回JSON格式：
{
    "isCorrect": true/false,
    "feedback": "评价说明"
}`,
                  },
                  {
                      role: "user",
                      content: `参考答案：${correctAnswer}
用户翻译：${userAnswer}
指定单词：${word}

请评估用户翻译是否正确。`,
                  },
              ]
            : [
                  {
                      role: "system",
                      content: `你是一个翻译评分专家。请评估用户的中文翻译是否正确。

评分标准：
1. 意思准确、完整
2. 表达自然、流畅
3. 关键信息无遗漏

如果用户翻译与参考答案意思基本一致（允许表达方式不同），应判定为正确。

请返回JSON格式：
{
    "isCorrect": true/false,
    "feedback": "评价说明"
}`,
                  },
                  {
                      role: "user",
                      content: `参考答案：${correctAnswer}
用户翻译：${userAnswer}

请评估用户翻译是否正确。`,
                  },
              ]

    try {
        const response = await inj.ai.chat({
            messages: prompt,
            temperature: 0.3,
        })

        const content = response?.choices[0]?.message.content || '{"isCorrect": false, "feedback": "评估失败"}'
        const cleanContent = content
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim()
        const result = JSON.parse(cleanContent)

        return {
            isCorrect: result.isCorrect || false,
            feedback: result.feedback || "答案已提交",
        }
    } catch (error) {
        console.error("Failed to validate translation:", error)
        // Fall back to simple comparison if AI validation fails
        const normalizedUser = userAnswer.trim().toLowerCase()
        const normalizedCorrect = correctAnswer.trim().toLowerCase()
        return {
            isCorrect: normalizedUser === normalizedCorrect,
            feedback: "AI评估暂时不可用，使用简单匹配进行评分",
        }
    }
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
        translation_input: "🌐",
        translation_cn_to_en: "🌏",
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
            try {
                await sendQuizQuestion(inj, chat_id, quiz.questions[nextIndex], nextIndex, quiz.questions.length)
            } catch (error) {
                console.error(`Failed to send next question (index ${nextIndex}):`, error)
                // Try to notify user about the error
                try {
                    await bot.sendMessage({
                        chat_id,
                        text: `⚠️ 发送下一题时出错，测验已中止。请重新开始。\n错误: ${error instanceof Error ? error.message : String(error)}`,
                    })
                } catch (notifyError) {
                    console.error("Failed to notify user about error:", notifyError)
                }
                // Clean up quiz state since we can't continue
                await drizzle.delete(quizState).where(eq(quizState.userId, userId))
            }
        }
    }
}

// Handle text input answer for translation questions
export const handleQuizTextAnswer = async (inj: Injector, userAnswer: string, chat_id: number, userId: number, db: D1Database) => {
    const { bot } = inj
    const drizzle = createDrizzleClient(db)

    // Get stored quiz data using Drizzle ORM
    const result = await drizzle
        .select()
        .from(quizState)
        .where(sql`${quizState.userId} = ${userId} AND ${quizState.expiresAt} > ${Date.now()}`)
        .limit(1)

    if (!result || result.length === 0) {
        await bot.sendMessage({
            chat_id,
            text: "测验已过期或未开始，请使用 /quiz 开始新的测验。",
        })
        return
    }

    const quizData = result[0]
    const quiz: { questions: QuizQuestion[]; answers: number[] } = {
        questions: JSON.parse(quizData.questions),
        answers: JSON.parse(quizData.answers),
    }

    // Find the current unanswered question
    const questionIndex = quiz.answers.findIndex((a) => a === -1)
    if (questionIndex === -1) {
        await bot.sendMessage({
            chat_id,
            text: "所有题目已完成！",
        })
        return
    }

    const question = quiz.questions[questionIndex]

    // Only handle input-based questions
    if (!question.isInputBased) {
        // Ignore text input for multiple choice questions - they should click buttons
        // But let's be helpful and remind them
        await bot.sendMessage({
            chat_id,
            text: "请点击按钮选择答案，而不是输入文本。",
        })
        return
    }

    let isCorrect = false
    let validationFeedback = ""

    try {
        // Validate answer using AI
        const validation = await validateTranslation(inj, userAnswer, question.correct_answer, question.type, question.word)
        isCorrect = validation.isCorrect
        validationFeedback = validation.feedback
    } catch (error) {
        console.error("Error validating translation:", error)
        // Fallback: use simple string comparison
        const normalizedUser = userAnswer.trim().toLowerCase()
        const normalizedCorrect = question.correct_answer.trim().toLowerCase()
        isCorrect = normalizedUser === normalizedCorrect
        validationFeedback = "验证过程出现错误，使用简单匹配评分"
    }

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

    // Send result
    const typeEmoji = {
        meaning: "📖",
        fill_blank: "✍️",
        synonym: "🔄",
        translation_input: "🌐",
        translation_cn_to_en: "🌏",
        word_form: "📝",
    }

    let resultText =
        `${typeEmoji[question.type] || "📝"} *测验题目 ${questionIndex + 1}/${quiz.questions.length}*\n\n` +
        `${question.question}\n\n` +
        `你的答案：${userAnswer}\n` +
        `参考答案：${question.correct_answer}\n\n` +
        `${isCorrect ? "✅ 回答正确！" : "❌ 回答有误，请参考参考答案"}\n\n` +
        `💬 ${validationFeedback}`

    // Add explanation if available
    if (question.explanation) {
        resultText += `\n\n💡 ${question.explanation}`
    }

    await bot.sendMessage({
        chat_id,
        text: resultText,
        parse_mode: "Markdown",
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
        // Send next unanswered question immediately
        const nextIndex = quiz.answers.findIndex((a) => a === -1)
        if (nextIndex !== -1) {
            try {
                await sendQuizQuestion(inj, chat_id, quiz.questions[nextIndex], nextIndex, quiz.questions.length)
            } catch (error) {
                console.error(`Failed to send next question (index ${nextIndex}):`, error)
                // Try to notify user about the error
                try {
                    await bot.sendMessage({
                        chat_id,
                        text: `⚠️ 发送下一题时出错，测验已中止。请重新开始。\n错误: ${error instanceof Error ? error.message : String(error)}`,
                    })
                } catch (notifyError) {
                    console.error("Failed to notify user about error:", notifyError)
                }
                // Clean up quiz state since we can't continue
                await drizzle.delete(quizState).where(eq(quizState.userId, userId))
            }
        }
    }
}

// Clean up expired quiz states using Drizzle ORM
export const cleanupExpiredQuizzes = async (db: D1Database) => {
    const drizzle = createDrizzleClient(db)
    await drizzle.delete(quizState).where(lt(quizState.expiresAt, Date.now()))
}
