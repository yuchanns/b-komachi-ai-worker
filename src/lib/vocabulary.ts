import toml from "markty-toml"
import { Injector, Analyze } from "../bindings"
import { promptToAnalyze, promptToDifferenciate, promptToTranslate, types } from "./prompts"
import { Message } from "@yuchanns/flamebot/dist/types"

export const differenciate = async (inj: Injector, text: string) => {
    const params = {
        messages: promptToDifferenciate(text),
        temperature: 0.3,
    }
    const response = await inj.ai.chat(params)
    return types.find((typ) => response?.choices[0]?.message.content.includes(typ))
}

const _translate = async (inj: Injector, text: string, chat_id: number, message_id: number, reply_to_message_id: number) => {
    const { ai, bot, tts } = inj
    const params = {
        messages: promptToTranslate(text),
        temperature: 0.3,
    }
    let chunkText = ""
    await ai.chat(params, async (r, done) => {
        chunkText += r?.choices[0]?.delta?.content ?? ""
        if ((!done && chunkText.length % 50 != 0) || chunkText.length == 0) {
            return
        }
        await bot.editMessageText({
            chat_id,
            message_id,
            text: chunkText,
        })
    })
    const voice = await tts.textToSpeech({ text })
    await bot.sendVoice({
        chat_id,
        reply_to_message_id,
        voice,
    })
}

export const gen_md_analyze = (parsed: Analyze) => {
    let text = ""
    if (parsed.word !== undefined) {
        text += `📚 *${parsed.word.text}*\n\n`
    }
    if (parsed.pronunciation !== undefined) {
        text += `🎧 *音标* _${parsed.pronunciation.ipa}_\n`
    }
    if (parsed.meaning !== undefined) {
        for (let { part_of_speech, definitions } of parsed.meaning) {
            if (!Array.isArray(definitions)) {
                continue
            }
            text += `_[${part_of_speech}]_ ${definitions.join(",")}\n`
        }
    }
    if (parsed.example !== undefined) {
        text += `\n💡 *例句*\n`
        for (let { sentence, translation } of parsed.example) {
            text += `- ${sentence}\n  (${translation})\n`
        }
        text += `\n`
    }
    if (parsed.origin !== undefined) {
        text += `🔍 *词源*\n- ${parsed.origin.etymology}\n`
        text += `\n`
    }
    if (parsed.related !== undefined) {
        text += `🌱 *词根*\n`
        if (Array.isArray(parsed.related.roots) && parsed.related.roots.length > 0) {
            text += `${parsed.related.roots.join(",")}\n`
        }
        if (Array.isArray(parsed.related.prefixes) && parsed.related.prefixes.length > 0) {
            text += `🚪 前缀 [${parsed.related.prefixes.join(",")}]\n`
        }
        if (Array.isArray(parsed.related.suffixes) && parsed.related.suffixes.length > 0) {
            text += `🎓 后缀 [${parsed.related.suffixes.join(",")}]\n`
        }
        text += `\n`
    }
    if (parsed.derivatives !== undefined) {
        text += `🤓 *派生*\n`
        for (let { word, meaning } of parsed.derivatives) {
            if (Array.isArray(meaning)) {
                text += `- _${word}_ ${meaning.join(",")}\n`
            }
        }
        text += `\n`
    }
    if (parsed.synonyms !== undefined) {
        text += `🧐 *近义*\n`
        for (let { word, meaning } of parsed.synonyms) {
            if (Array.isArray(meaning)) {
                text += `- _${word}_ ${meaning.join(",")}\n`
            }
        }
        text += `\n`
    }
    if (parsed.homophones !== undefined) {
        text += `🤔 *形似*\n`
        for (let { word, meaning } of parsed.homophones) {
            if (Array.isArray(meaning)) {
                text += `- _${word}_ ${meaning.join(",")}\n`
            }
        }
        text += `\n`
    }
    return text
}

export const _analyze = async (inj: Injector, text: string, chat_id: number, message_id: number, reply_to_message_id: number) => {
    const { ai, bot, tts } = inj
    const params = {
        messages: promptToAnalyze(text),
        temperature: 0.3,
    }
    let chunkText = ""
    let parsed: Analyze = {}
    await ai.chat(params, async (r, done) => {
        chunkText += r?.choices[0]?.delta?.content ?? ""
        if ((!done && chunkText.length % 50 != 0) || chunkText.length == 0) {
            return
        }
        try {
            const content = chunkText
                // OpenAI: replace [] with [[]] to avoid TOML parse fail
                .replaceAll("[]", "[[]]")
                // Gemini: replace ,] with ] to avoid TOML parse fail
                .replaceAll(",]", "]")
            parsed = toml(content) as Analyze
            const formatted = gen_md_analyze(parsed)
            await bot.editMessageText({
                chat_id,
                message_id,
                text: formatted,
                parse_mode: "Markdown",
            })
        } catch (error) {
            console.log(error)
        }
    })
    // TTS should use the corrected word
    const texts = [{ sentence: parsed.word?.text || text, translation: "" }]
    parsed.example?.forEach(({ sentence, translation }) => {
        texts.push({ sentence, translation: `(${translation})` })
    })
    await Promise.all(
        texts.map(async ({ sentence, translation }) => {
            const voice = await tts.textToSpeech({ text: sentence })
            const caption = `${sentence} ${translation}`
            await bot.sendVoice({
                chat_id,
                reply_to_message_id,
                voice,
                caption,
            })
        })
    )
}

export const translate = async ({ chat: { id: chat_id }, message_id: reply_to_message_id, text: rawText }: Message, inj: Injector) => {
    const {
        result: { message_id },
    } = await inj.bot.sendMessage({
        chat_id,
        reply_to_message_id,
        text: "正在查询，请稍候...",
    })
    const me = await inj.bot.getMe()
    const text = rawText?.replace(`@${me.result.username}`, "") ?? ""
    const typ = await differenciate(inj, text)
    if (typ == "word" || typ == "phrase") {
        await _analyze(inj, text, chat_id, message_id, reply_to_message_id)
    } else {
        // FIXME: issue of type out of range
        await _translate(inj, text, chat_id, message_id, reply_to_message_id)
    }
    return
}
