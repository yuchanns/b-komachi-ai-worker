import { Message } from "../clients"
import { Injector } from "../types"

const promptToTranslate = (text: string) => {
	return [
		{
			role: "system", content:
				`你是一个英语翻译引擎，请翻译给出的单词，只需要翻译不需要解释。`
				+ `如果你认为单词拼写错误，直接修正成最可能的正确拼写，不需要解释。`
				+ `如果它是一个句子，给出翻译。`
				+ `给出单词原始形态、`
				+ `对应的美式音标、`
				+ `所有含义（含词性）、`
				+ `英中双语示例，每种含义至少一条例句，总例句至少三条、`
				+ `所有词根和前后缀`
				+ `派生单词、`
				+ `近义单词、`
				+ `形似单词。`
		},
		{ role: "assistant", content: "好的，我明白了，请给我这个单词。" },
		{ role: "user", content: `单词是: ${text} ` }
	]
}

export const isMentioned = (m: Message) => {
	for (const entity of m.entities ?? []) {
		if (entity.type != "mention") {
			continue
		}
		return true
	}
	return false
}

export const translate = async (
	{
		chat: { id: chat_id },
		message_id: reply_to_message_id,
		text: rawText,
	}: Message,
	{
		bot, ai, tts,
	}: Injector,
) => {
	const {
		result: { message_id },
	} = await bot.sendMessage({
		chat_id,
		reply_to_message_id,
		text: "正在查询，请稍候..."
	})
	const me = await bot.getMe()
	const text = rawText?.
		replace(`@${me.result.username}`, "") ?? ""
	const params = {
		messages: promptToTranslate(text),
		temperature: 0.3
	}
	let chunkText = ""
	await ai.chat(params, async (r, done) => {
		chunkText += r?.choices[0]?.delta?.content ?? ""
		if ((!done && chunkText.length % 50 != 0) || chunkText.length == 0) {
			return
		}
		await bot.editMessageText({
			chat_id, message_id, text: chunkText
		})
	})
	const voice = await tts.textToSpeech({ text })
	await bot.sendVoice({
		chat_id, reply_to_message_id, voice,
	})
	return
}

