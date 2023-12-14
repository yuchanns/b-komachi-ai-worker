import toml from "markty-toml"
import { Message } from "../clients"
import { Injector } from "../types"
import { Analyze } from "./types"

const types = ["word", "phrase", "sentence"]

const promptToDifferenciate = (text: string) => {
	return [
		{
			role: "system", content: `作为用户的代表，你需要扮演一个英语文本分类工具，任务是对用户提交的英语文本进行准确分类。`
				+ `分类标准为以下三类：${JSON.stringify(types)}。你需要对每个输入进行评估，然后将其归入适当的类别。`
				+ `下面是具体的操作指南：`
				+ `- 如果输入的是一个单独的单词，你应该回复 "word"。`
				+ `- 如果输入的是一个词组但不是完整的句子，你应该回复 "phrase"。`
				+ `- 如果输入的是一个完整的句子，你应该回复 "sentence"。`
				+ `请确保你的回答简洁明了，直接给出分类结果，不需要提供额外的解释或评论。下面是几个例子来帮助你理解任务：`
				+ `- 输入: prevalent`
				+ `  你的输出应该是: word`
				+ `- 输入: he is a boy`
				+ `  你的输出应该是: sentence`
				+ `- 输入: real estate`
				+ `  你的输出应该是: phrase`
				+ `请遵循这些指南，确保每次回复都精准无误。`
		},
		{ role: "assistant", content: `好的，我明白了，请给我输入。` },
		{
			role: "user", content: `输入: ${text}: `
		}
	]
}

export const promptToTranslate = (text: string) => {
	return [
		{
			role: "system", content: `你现在是一个高级英语翻译引擎，负责将用户提供的英文句子进行翻译，并按照以下明确的步骤来操作：`
				+ `1. 直接对句子进行翻译，不需要提供任何额外的解释或说明。`
				+ `2. 如果用户提供的句子存在语法错误，应自动修正为你认为最可能正确的语法形式，并且无需向用户指出拼写错误。`
				+ `3. 列举句子当中使用的所有语法和句式，并且为每个句式提供至少一个中英文双语的例句，确保整体提供至少三个例句。`
				+ `在执行这些指令时，请确保你提供的翻译内容既精确又全面，并且以清晰、组织良好的 toml 格式来展示所有信息。`
				+ `例如:`
				+ `输入: The little girl, who is crying as if her heart would break, said, when I spoken to her, that she was very sad because she had not saw her mother for two hours.`
				+ `你的输出应该是:`
				+ `[sentence]`
				+ `origin = "The little girl, who is crying as if her heart would break, said, when I spoken to her, that she was very sad because she had not saw her mother for two hours."`
				+ `text = "那个小女孩哭得伤心欲绝，当我跟她说话时，她说她很难过，因为两个小时没见到她妈妈了。"`
				+ `[[grammar]]`
				+ `type = "名词短语"`
				+ `text = "The little girl"`
				+ `example_sentence = "The tall boy with the red hat"`
				+ `example_translation = "戴着红帽子的高个男孩"`
				+ `[[grammar]]`
				+ `type = "定语从句"`
				+ `text = "who is crying as if her heart would break"`
				+ `example_sentence = "which is known for its beautiful beaches"`
				+ `example_translation = "以其美丽的海滩而闻名"`
				+ `[[grammar]]`
				+ `type = "动词短语"`
				+ `text = "said, when I spoke to her"`
				+ `example_sentence = "has been working on this project for months"`
				+ `example_translation = "已经在这个项目上工作了几个月"`
		},
		{ role: "assistant", content: "好的，我明白了，请给我输入。" },
		{ role: "user", content: `输入: ${text} ` }
	]
}

export const promptToAnalyze = (text: string) => {
	return [
		{
			role: "system", content: `你现在是一个高级英语翻译引擎，负责将用户提供的英文单词进行翻译，并按照以下明确的步骤来操作：`
				+ `1. 直接对单词进行翻译，不需要提供任何额外的解释或说明。`
				+ `2. 如果用户提供的单词存在拼写错误，应自动修正为你认为最可能正确的单词形式，并且无需向用户指出拼写错误。`
				+ `3. 你需要提供其原始形态，并附上相应的美式音标。`
				+ `4. 列举单词的所有含义，包括词性，并且为每个含义提供至少一个中英文双语的例句，确保整体提供至少三个例句。`
				+ `5. 罗列单词相关的词根、前缀和后缀。`
				+ `6. 提供与该单词相关的派生词。`
				+ `7. 列出单词的近义词。`
				+ `8. 列出形似单词。`
				+ `在执行这些指令时，请确保你提供的翻译内容既精确又全面，并且以清晰、组织良好的 toml 格式来展示所有信息。`
				+ `例如:`
				+ `输入: like`
				+ `你的输出应该是:`
				+ `[word]`
				+ `text = "like" # 单词原型`
				+ `[pronunciation]`
				+ `ipa = "/laɪk/" # 美式发音`
				+ `[[meaning]] # 含义`
				+ `part_of_speech = "v." # 动词`
				+ `definitions = [`
				+ `"喜欢",`
				+ `"喜爱",`
				+ `] # 定义`
				+ `[[meaning]] # 含义`
				+ `part_of_speech = "prep." # 介词`
				+ `definitions = [`
				+ `"像",`
				+ `"如同",`
				+ `] # 定义`
				+ `[[example]] # 例句`
				+ `sentence = "I really like chocolate ice cream." # 例句`
				+ `translation = "我真的很喜欢巧克力冰淇淋" # 翻译`
				+ `[[example]] # 例句`
				+ `sentence = "She looks like her mother." # 例句`
				+ `translation = "她长得像她的母亲" # 翻译`
				+ `[[example]] # 例句`
				+ `sentence = "I like your idea" # 例句`
				+ `translation = "我喜欢你的想法" # 翻译`
				+ `[origin] # 起源`
				+ `etymology = "源自古英语“lician”，意为“爱、喜欢”。"`
				+ `[related]`
				+ `prefixes = [] # 前缀`
				+ `suffixes = ["-ly"] # 后缀`
				+ `roots = ["lik-"] # 词根`
				+ `[[derivatives]] # 派生词`
				+ `word = "dislike"`
				+ `meaning = ["不喜欢", "厌恶"]`
				+ `[[derivatives]] # 派生词`
				+ `word = "alike"`
				+ `meaning = ["相似的", "相同的", "相似地", "相同地"]`
				+ `[[derivatives]] # 派生词`
				+ `word = "unlike"`
				+ `meaning = ["不像", "与...不同"]`
				+ `[[synonyms]] # 同义词`
				+ `word = "love"`
				+ `meaning = ["爱", "情感"]`
				+ `[[synonyms]] # 同义词`
				+ `word = "enjoy"`
				+ `meaning = ["享受", "喜爱"]`
				+ `[[synonyms]] # 同义词`
				+ `word = "adore"`
				+ `meaning = ["崇拜", "爱慕"]`
				+ `[[synonyms]] # 同义词`
				+ `word = "appreciate"`
				+ `meaning = ["欣赏", "感激", "重视"]`
				+ `[[homophones]] # 形似词`
				+ `word = "hike"`
				+ `meaning = ["远足", "徒步"]`
				+ `[[homophones]] # 形似词`
				+ `word = "bike"`
				+ `meaning = ["自行车"]`
		},
		{ role: "assistant", content: "好的，我明白了，请给我输入。" },
		{ role: "user", content: `输入: ${text} ` }
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

export const differenciate = async (inj: Injector, text: string) => {
	const params = {
		messages: promptToDifferenciate(text),
		temperature: 0.3,
	}
	const response = await inj.ai.chat(params)
	return types.find(typ => response?.
		choices[0]?.message.content.includes(typ))
}

const _translate = async (
	inj: Injector, text: string, chat_id: number,
	message_id: number, reply_to_message_id: number,
) => {
	const { ai, bot, tts } = inj
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
}

export const gen_md_analyze = (parsed: Analyze) => {
	let text = ""
	if (parsed.word?.text !== undefined) {
		text += `*${parsed.word.text}*\n`
	}
	if (parsed.pronunciation?.ipa !== undefined) {
		text += `美式 __${parsed.pronunciation.ipa}__\n`
	}
	if (parsed.meaning !== undefined) {
		for (let { part_of_speech, definitions } of parsed.meaning) {
			text += `_[${part_of_speech}]_ ${definitions.join(",")}\n`
		}
	}
	if (parsed.example !== undefined) {
		text += `*例句*\n`
		for (let { sentence, translation } of parsed.example) {
			text += `${sentence}\n||${translation}||\n`
		}
	}
	if (parsed.origin?.etymology !== undefined) {
		text += `*词源*\n${parsed.origin.etymology}\n`
	}
	if (parsed.related !== undefined) {
		text += `[词根] ${parsed.related.roots.join(",")}\n`
			+ `[前缀] ${parsed.related.prefixes.join(",")}\n`
			+ `[后缀] ${parsed.related.suffixes.join(",")}\n`
	}
	if (parsed.derivatives !== undefined) {
		text += `*派生*\n`
		for (let { word, meaning } of parsed.derivatives) {
			text += `_${word}_ ${meaning.join(",")}\n`
		}
	}
	if (parsed.synonyms !== undefined) {
		text += `*近义*\n`
		for (let { word, meaning } of parsed.synonyms) {
			text += `_${word}_ ${meaning.join(",")}\n`
		}
	}
	if (parsed.homophones !== undefined) {
		text += `*形似*\n`
		for (let { word, meaning } of parsed.homophones) {
			text += `_${word}_ ${meaning.join(",")}\n`
		}
	}
	return text
}

const _analyze = async (
	inj: Injector, text: string, chat_id: number,
	message_id: number, reply_to_message_id: number,
) => {
	const { ai, bot, tts } = inj
	const params = {
		messages: promptToAnalyze(text),
		temperature: 0.3
	}
	let chunkText = ""
	await ai.chat(params, async (r, done) => {
		chunkText += r?.choices[0]?.delta?.content ?? ""
		if ((!done && chunkText.length % 50 != 0) || chunkText.length == 0) {
			return
		}
		let parsed: Analyze
		try {
			parsed = toml(chunkText) as Analyze
		} catch (error) {
			return
		}
		if (!parsed) {
			return
		}
		const text = gen_md_analyze(parsed)
		await bot.editMessageText({
			chat_id, message_id, text, parse_mode: "MarkdownV2"
		})
	})
	const voice = await tts.textToSpeech({ text })
	await bot.sendVoice({
		chat_id, reply_to_message_id, voice,
	})
}

export const translate = async (
	{
		chat: { id: chat_id },
		message_id: reply_to_message_id,
		text: rawText,
	}: Message,
	inj: Injector,
) => {
	const {
		result: { message_id },
	} = await inj.bot.sendMessage({
		chat_id,
		reply_to_message_id,
		text: "正在查询，请稍候..."
	})
	const me = await inj.bot.getMe()
	const text = rawText?.
		replace(`@${me.result.username}`, "") ?? ""
	const typ = await differenciate(inj, text)
	if (typ == "word" || typ == "phrase") {
		await _analyze(inj, text, chat_id, message_id, reply_to_message_id)
	} else {
		// FIXME: issue of typ out of range
		await _translate(inj, text, chat_id, message_id, reply_to_message_id)
	}
	return
}

