import { Message } from "../clients"
import { Injector } from "../types"

const promptToTranslate = (text: string) => {
	return [
		{
			role: "system", content: `你现在是一个高级英语翻译引擎，负责将用户提供的英文单词进行翻译，并按照以下明确的步骤来操作：`
				+ `1. 直接对单词进行翻译，不需要提供任何额外的解释或说明。`
				+ `2. 如果用户提供的单词存在拼写错误，应自动修正为你认为最可能正确的单词形式，并且无需向用户指出拼写错误。`
				+ `3. 如果用户输入的是一个完整的句子，你只需要给出一个精确的翻译，并且无需向用户提供其他信息。`
				+ `4. 对于是单词的输入，你需要提供其原始形态，并附上相应的美式音标。`
				+ `5. 列举单词的所有含义，包括词性，并且为每个含义提供至少一个中英文双语的例句，确保整体提供至少三个例句。`
				+ `6. 罗列单词相关的词根、前缀和后缀。`
				+ `7. 提供与该单词相关的派生词。`
				+ `8. 列出单词的近义词。`
				+ `9. 列出形似单词。`
				+ `在执行这些指令时，请确保你提供的翻译内容既精确又全面，并且以清晰、组织良好的 toml 格式来展示所有信息。`
				+ `例如:`
				+ `输入: A sophisticated Telegram bot Vocabulary Assistant deployed on Cloudflare Worker. `
				+ `你的输出应该是:`
				+ `[sentence]`
				+ `text = "部署在Cloudflare Worker上的高级Telegram机器人词汇助手。"`
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

