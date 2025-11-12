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

// Generate quiz questions from user vocabulary
const promptToGenerateQuiz = (words: string[]) => {
    const wordList = words.join(", ")
    return [
        {
            role: "system",
            content: `你是一个专业的英语词汇测验生成器。请生成多样化的测验问题，包含以下几种题型：

1. **词义选择** (meaning): 询问单词的中文含义，提供4个选项
2. **填空题** (fill_blank): 给出带有明确空白标记（___）的句子，选择正确的单词。例如："The ___ is very beautiful." 
3. **同义词/反义词** (synonym): 选择同义词或反义词，提供4个选项
4. **英译中翻译** (translation_input): 给出包含单词的英文句子，让用户输入中文翻译（不需要options，isInputBased为true）
5. **中译英翻译** (translation_cn_to_en): 给出中文句子，让用户输入包含指定单词的英文翻译（不需要options，isInputBased为true）
6. **词形变化** (word_form): 根据语境选择正确的词形（时态、单复数等），提供4个选项

每个问题的 JSON 格式：

选择题格式（meaning, fill_blank, synonym, word_form）：
{
    "type": "题型类型",
    "word": "测试的单词（英文）",
    "question": "问题文本（中文）",
    "correct_answer": "正确答案",
    "options": ["选项1", "选项2", "选项3", "选项4"],
    "correct_index": 0-3,
    "explanation": "答案解释（可选）",
    "isInputBased": false
}

翻译题格式（translation_input, translation_cn_to_en）：
{
    "type": "translation_input" 或 "translation_cn_to_en",
    "word": "测试的单词（英文）",
    "question": "问题文本（中文）",
    "correct_answer": "参考答案",
    "options": [],
    "correct_index": -1,
    "explanation": "答案解释（可选）",
    "isInputBased": true
}

要求：
- 题型要多样化，不要全是同一种类型
- **填空题必须在句子中使用下划线（___）标记空白位置，让用户明确知道填空位置**
- 翻译题使用isInputBased模式，让用户输入答案而非选择
- 选择题选项要有迷惑性但明确可辨
- 问题要清晰、符合实际使用场景
- 只返回 JSON 数组，不要其他文本`,
        },
        {
            role: "user",
            content: `为这些英文单词生成 5 道测验题：${wordList}

请生成多样化的题型组合，例如：
- 1道词义选择题
- 1道填空题（必须包含 ___ 标记）
- 1道同义词题
- 1道英译中翻译题（isInputBased: true）
- 1道中译英翻译题（isInputBased: true）

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
        let questions: QuizQuestion[] = JSON.parse(cleanContent)

        // Normalize questions - ensure isInputBased is set correctly based on type
        questions = questions.map((q) => {
            const isTranslationType = q.type === "translation_input" || q.type === "translation_cn_to_en"
            return {
                ...q,
                isInputBased: isTranslationType ? true : q.isInputBased || false,
                options: isTranslationType && (!q.options || q.options.length === 0) ? [] : q.options,
                correct_index: isTranslationType ? -1 : q.correct_index,
            }
        })

        // Validate and take up to 5 questions
        const validQuestions = questions.filter((q) => {
            if (!q.type || !q.word || !q.question || !q.correct_answer) {
                return false
            }
            // For input-based questions (translation), options can be empty
            if (q.isInputBased) {
                return q.options !== undefined && q.correct_index === -1
            } else {
                return q.options && q.options.length === 4 && q.correct_index >= 0 && q.correct_index < 4
            }
        })

        console.log(`Generated ${questions.length} questions, ${validQuestions.length} valid`)
        return validQuestions.slice(0, 5)
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
    } else {
        // Create inline keyboard with answer options for multiple choice
        // Safety check: ensure options exist and have items
        if (!question.options || question.options.length === 0) {
            console.error("Question has no options but is not input-based:", question)
            throw new Error("Multiple choice question must have options")
        }

        const keyboard: InlineKeyboardMarkup = {
            inline_keyboard: question.options.map((option, index) => [
                {
                    text: `${String.fromCharCode(65 + index)}. ${option}`,
                    callback_data: `quiz:${questionIndex}:${index}`,
                },
            ]),
        }

        await bot.sendMessage({
            chat_id,
            text: questionText + `请选择正确答案：`,
            parse_mode: "Markdown",
            reply_markup: keyboard,
        })
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
            await sendQuizQuestion(inj, chat_id, quiz.questions[nextIndex], nextIndex, quiz.questions.length)
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
            await sendQuizQuestion(inj, chat_id, quiz.questions[nextIndex], nextIndex, quiz.questions.length)
        }
    }
}

// Clean up expired quiz states using Drizzle ORM
export const cleanupExpiredQuizzes = async (db: D1Database) => {
    const drizzle = createDrizzleClient(db)
    await drizzle.delete(quizState).where(lt(quizState.expiresAt, Date.now()))
}
