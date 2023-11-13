/**
 * https://github.com/cvzi/telegram-bot-cloudflare
 */

const TOKEN = ENV_BOT_TOKEN // Get it from @BotFather https://core.telegram.org/bots#6-botfather
const WEBHOOK = '/endpoint'
const SECRET = ENV_BOT_SECRET // A-Z, a-z, 0-9, _ and -
const AZURE_URL = ENV_AZURE_URL
const AZURE_API_KEY = ENV_AZURE_API_KEY
const AZURE_API_VERSION = ENV_AZURE_API_VERSION
const TTS_ENDPOINT = ENV_AZURE_TTS_ENDPOINT
const TTS_KEY = ENV_AZURE_TTS_KEY

/**
 * Wait for requests to the worker
 */
addEventListener('fetch', event => {
	const url = new URL(event.request.url)
	if (url.pathname === WEBHOOK) {
		event.respondWith(handleWebhook(event))
	} else if (url.pathname === '/registerWebhook') {
		event.respondWith(registerWebhook(event, url, WEBHOOK, SECRET))
	} else if (url.pathname === '/unRegisterWebhook') {
		event.respondWith(unRegisterWebhook(event))
	} else {
		event.respondWith(new Response('No handler for this request'))
	}
})

/**
 * Handle requests to WEBHOOK
 * https://core.telegram.org/bots/api#update
 */
async function handleWebhook(event) {
	// Check secret
	if (event.request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== SECRET) {
		return new Response('Unauthorized', { status: 403 })
	}

	// Read request body synchronously
	const update = await event.request.json()
	// Deal with response asynchronously
	event.waitUntil(onUpdate(update))

	return new Response('Ok')
}

/**
 * Handle incoming Update
 * https://core.telegram.org/bots/api#update
 */
async function onUpdate(update) {
	if ('message' in update) {
		await onMessage(update.message)
	}
}

function getTranslatorPrompts(text) {
	return [
		{
			"role": "system", "content": `
你是一个英语翻译引擎，请翻译给出的单词，只需要翻译不需要解释。
如果你认为单词拼写错误，直接修正成最可能的正确拼写，不需要解释。
如果它是一个句子，给出翻译。
给出单词原始形态、
、
对应的美式音标、
所有含义（含词性）、
英中双语示例，每种含义至少一条例句，总例句至少三条、
所有词根和前后缀
派生单词、
近义单词、
形似单词。
    `},
		{ "role": "assistant", "content": "好的，我明白了，请给我这个单词。" },
		{ "role": "user", "content": `单词是: ${text}` }
	]
}

async function translateEnStream(text, cb) {
	const prompts = getTranslatorPrompts(text)
	return await sendOpenAIStream(prompts, cb)
}

async function translateEn(text) {
	const prompts = getTranslatorPrompts(text)
	const response = await sendOpenAIJson(prompts)
	return response.choices[0]?.message?.content ?? JSON.stringify(response)
}

/**
 * Handle incoming Message
 * https://core.telegram.org/bots/api#message
 */
async function onMessage(message) {
	const entities = message.entities ?? []
	let isMention = false
	for (const entity of entities) {
		if (entity.type != "mention") {
			continue
		}
		isMention = true
		break
	}
	if (!isMention) {
		return
	}
	const { result: { username } } = await getMe()
	const text = message.text.replace(`@${username}`, '')
	const response = await sendPlainText(message.chat.id, "正在查询，请稍候...", message.message_id)
	const updateMessageId = response?.result?.message_id
	if (!updateMessageId) {
		return
	}
	// const content = await translateEn(text)
	// await sendPlainText(message.chat.id, content, message.message_id)
	let chunkText = ""
	await translateEnStream(text, async function (chunk, done) {
		chunkText += chunk
		if (!done && chunkText.length % 50 != 0) {
			return
		}
		await updatePlainText(message.chat.id, chunkText, updateMessageId)
		return
	})
	const audioBlob = await sendTTS(text)
	return await sendVoice(message.chat.id, audioBlob, message.message_id)
}

async function getMe() {
	return (await fetch(apiUrl('getMe'))).json()
}

/**
 * Send plain text message
 * https://core.telegram.org/bots/api#sendmessage
 */
async function sendPlainText(chatId, text, messageId = null) {
	let body = {
		chat_id: chatId,
		text
	}
	if (messageId) {
		body["reply_to_message_id"] = messageId
	}
	return (await fetch(apiUrl('sendMessage', body))).json()
}

async function updatePlainText(chatId, text, messageId) {
	let body = {
		chat_id: chatId,
		text,
		message_id: messageId
	}
	return (await fetch(apiUrl('editMessageText', body))).json()
}

async function sendVoice(chatId, audioBlob, messageId = null) {
	const formData = new FormData()
	formData.append('chat_id', chatId)
	formData.append('voice', audioBlob)
	if (messageId) {
		formData.append('reply_to_message_id', messageId)
	}
	return (await fetch(apiUrl('sendVoice'), {
		method: 'POST',
		body: formData
	})).json()
}

async function sendTTS(text) {
	const request = new Request(ttsUrl(), {
		method: 'POST',
		headers: {
			'Content-Type': 'application/ssml+xml',
			'Ocp-Apim-Subscription-Key': TTS_KEY,
			'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3',
			'User-Agent': 'B-Komachi-Ai'
		},
		body: `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
    <voice name='en-US-MonicaNeural' lang='en-US' gender='Female'>${text}</voice>
  </speak>`,
	})
	const response = await fetch(request)
	return response.blob()
}

async function sendOpenAI(messages, stream) {
	const body = JSON.stringify({
		messages,
		temperature: 0.3,
		stream
	})
	const request = new Request(openaiUrl(), {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"api-key": AZURE_API_KEY
		},
		body
	})
	return await fetch(request)
}

async function readStream(reader, cb) {
	const decoder = new TextDecoder()
	let decoded = ""
	const prefix = "data: "
	while (true) {
		const { value, done } = await reader.read();
		if (done) {
			await cb("", true)
			return;
		}
		decoded += decoder.decode(value, { stream: true })
		let lineEndIndex
		while ((lineEndIndex = decoded.indexOf('\n')) !== -1) {
			const line = decoded.slice(0, lineEndIndex);
			decoded = decoded.slice(lineEndIndex + 1);
			if (line == "") {
				continue
			}
			if (!line.startsWith(prefix)) {
				return
			}
			const data = line.slice(prefix.length)
			if (data == "[DONE]") {
				await cb("", true)
				return
			}
			const content = JSON.parse(data)?.choices[0]?.delta?.content
			if (content) {
				await cb(content, false)
			}
		}
	}
}

async function sendOpenAIStream(messages, cb) {
	const response = await sendOpenAI(messages, true)
	const reader = response.body.getReader()
	return await readStream(reader, cb)
}

async function sendOpenAIJson(messages) {
	return (await sendOpenAI(messages, false)).json()
}
/**
 * Set webhook to this worker's url
 * https://core.telegram.org/bots/api#setwebhook
 */
async function registerWebhook(event, requestUrl, suffix, secret) {
	// https://core.telegram.org/bots/api#setwebhook
	const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`
	const r = await (await fetch(apiUrl('setWebhook', { url: webhookUrl, secret_token: secret }))).json()
	return new Response('ok' in r && r.ok ? 'Ok' : JSON.stringify(r, null, 2))
}

/**
 * Remove webhook
 * https://core.telegram.org/bots/api#setwebhook
 */
async function unRegisterWebhook(event) {
	const r = await (await fetch(apiUrl('setWebhook', { url: '' }))).json()
	return new Response('ok' in r && r.ok ? 'Ok' : JSON.stringify(r, null, 2))
}

/**
 * Return url to telegram api, optionally with parameters added
 */
function apiUrl(methodName, params = null) {
	let query = ''
	if (params) {
		query = '?' + new URLSearchParams(params).toString()
	}
	return `https://api.telegram.org/bot${TOKEN}/${methodName}${query}`
}

/**
 * Return url to azure openai api
 */
function openaiUrl() {
	return `${AZURE_URL}/chat/completions?api-version=${AZURE_API_VERSION}`
}

/**
 * Return url to azure tts api
 */
function ttsUrl() {
	return `${TTS_ENDPOINT}/cognitiveservices/v1`
}
