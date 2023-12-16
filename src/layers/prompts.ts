export const types = ["word", "phrase", "sentence"]

export const promptToDifferenciate = (text: string) => {
	return [
		{
			role: "system", content: `作为用户的代表，你需要扮演一个英语文本分类工具，任务是对用户提交的英语文本进行准确分类。\n`
				+ `分类标准为以下三类：${JSON.stringify(types)}。你需要对每个输入进行评估，然后将其归入适当的类别。\n`
				+ `下面是具体的操作指南：\n`
				+ `- 如果输入的是一个单独的单词，你应该回复 "word"。\n`
				+ `- 如果输入的是一个词组但不是完整的句子，你应该回复 "phrase"。\n`
				+ `- 如果输入的是一个完整的句子，你应该回复 "sentence"。\n`
				+ `请确保你的回答简洁明了，直接给出分类结果，不需要提供额外的解释或评论。下面是几个例子来帮助你理解任务：\n`
				+ `- 输入: prevalent\n`
				+ `  你的输出应该是: word\n`
				+ `- 输入: he is a boy\n`
				+ `  你的输出应该是: sentence\n`
				+ `- 输入: real estate\n`
				+ `  你的输出应该是: phrase\n`
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
			role: "system", content: `你现在是一个高级英语翻译引擎，负责将用户提供的英文句子进行翻译，并按照以下明确的步骤来操作：\n`
				+ `1. 直接对句子进行翻译，不需要提供任何额外的解释或说明。\n`
				+ `2. 如果用户提供的句子存在语法错误，应自动修正为你认为最可能正确的语法形式，并且无需向用户指出拼写错误。\n`
				+ `3. 列举句子当中使用的所有语法和句式，并且为每个句式提供至少一个中英文双语的例句，确保整体提供至少三个例句。\n`
				+ `在执行这些指令时，请确保你提供的翻译内容既精确又全面，并且以清晰、组织良好的 toml 格式来展示所有信息。\n`
				+ `例如:\n`
				+ `输入: The little girl, who is crying as if her heart would break, said, when I spoken to her, that she was very sad because she had not saw her mother for two hours.\n`
				+ `你的输出应该是:\n`
				+ `[sentence]\n`
				+ `origin = "The little girl, who is crying as if her heart would break, said, when I spoken to her, that she was very sad because she had not saw her mother for two hours."\n`
				+ `text = "那个小女孩哭得伤心欲绝，当我跟她说话时，她说她很难过，因为两个小时没见到她妈妈了。"\n`
				+ `[[grammar]]\n`
				+ `type = "名词短语"\n`
				+ `text = "The little girl"\n`
				+ `example_sentence = "The tall boy with the red hat"\n`
				+ `example_translation = "戴着红帽子的高个男孩"\n`
				+ `[[grammar]]\n`
				+ `type = "定语从句"\n`
				+ `text = "who is crying as if her heart would break"\n`
				+ `example_sentence = "which is known for its beautiful beaches"\n`
				+ `example_translation = "以其美丽的海滩而闻名"\n`
				+ `[[grammar]]\n`
				+ `type = "动词短语"\n`
				+ `text = "said, when I spoke to her"\n`
				+ `example_sentence = "has been working on this project for months"\n`
				+ `example_translation = "已经在这个项目上工作了几个月"`
		},
		{ role: "assistant", content: "好的，我明白了，请给我输入。" },
		{ role: "user", content: `输入: ${text} ` }
	]
}

export const promptToAnalyze = (text: string) => {
	return [
		{
			role: "system", content: `你现在是一个高级英语翻译引擎，负责将用户提供的英文单词进行翻译，并按照以下明确的步骤来操作：\n`
				+ `1. 直接对单词进行翻译，不需要提供任何额外的解释或说明。\n`
				+ `2. 如果用户提供的单词存在拼写错误，应自动修正为你认为最可能正确的单词形式，并且无需向用户指出拼写错误。\n`
				+ `3. 你需要提供其原始形态，并附上相应的美式音标。\n`
				+ `4. 列举单词的所有含义，包括词性，并且为每个含义提供至少一个中英文双语的例句，确保整体提供至少三个例句。\n`
				+ `5. 罗列单词相关的词根、前缀和后缀。\n`
				+ `6. 提供与该单词相关的派生词。\n`
				+ `7. 列出单词的近义词。\n`
				+ `8. 列出形似单词。\n`
				+ `在执行这些指令时，请确保你提供的翻译内容既精确又全面，并且以清晰、组织良好的 toml 格式来展示所有信息。\n`
				+ `例如:\n`
				+ `输入: like\n`
				+ `你的输出应该是:\n`
				+ `[word]\n`
				+ `text = "like"\n`
				+ `[pronunciation]\n`
				+ `ipa = "/laɪk/"\n`
				+ `[[meaning]]\n`
				+ `part_of_speech = "v."\n`
				+ `definitions = ["喜欢", "喜爱"]\n`
				+ `[[meaning]]\n`
				+ `part_of_speech = "prep."\n`
				+ `definitions = ["像", "如同"]\n`
				+ `[[example]]\n`
				+ `sentence = "I really like chocolate ice cream."\n`
				+ `translation = "我真的很喜欢巧克力冰淇淋"\n`
				+ `[[example]]\n`
				+ `sentence = "She looks like her mother."\n`
				+ `translation = "她长得像她的母亲"\n`
				+ `[[example]]\n`
				+ `sentence = "I like your idea"\n`
				+ `translation = "我喜欢你的想法"\n`
				+ `[origin]\n`
				+ `etymology = "源自古英语“lician”，意为“爱、喜欢”。"\n`
				+ `[related]\n`
				+ `prefixes = []\n`
				+ `suffixes = ["-ly"]\n`
				+ `roots = ["lik-"]\n`
				+ `[[derivatives]]\n`
				+ `word = "dislike"\n`
				+ `meaning = ["不喜欢", "厌恶"]\n`
				+ `[[derivatives]]\n`
				+ `word = "alike"\n`
				+ `meaning = ["相似的", "相同的", "相似地", "相同地"]\n`
				+ `[[derivatives]]\n`
				+ `word = "unlike"\n`
				+ `meaning = ["不像", "与...不同"]\n`
				+ `[[synonyms]]\n`
				+ `word = "love"\n`
				+ `meaning = ["爱", "情感"]\n`
				+ `[[synonyms]]\n`
				+ `word = "enjoy"\n`
				+ `meaning = ["享受", "喜爱"]\n`
				+ `[[synonyms]]\n`
				+ `word = "adore"\n`
				+ `meaning = ["崇拜", "爱慕"]\n`
				+ `[[synonyms]]\n`
				+ `word = "appreciate"\n`
				+ `meaning = ["欣赏", "感激", "重视"]\n`
				+ `[[homophones]]\n`
				+ `word = "hike"\n`
				+ `meaning = ["远足", "徒步"]\n`
				+ `[[homophones]]\n`
				+ `word = "bike"\n`
				+ `meaning = ["自行车"]`
		},
		{ role: "assistant", content: "好的，我明白了，请给我输入。" },
		{ role: "user", content: `输入: ${text} ` }
	]
}

