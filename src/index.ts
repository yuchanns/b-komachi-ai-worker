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
async function handleWebhook (event) {
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
async function onUpdate (update) {
  if ('message' in update) {
    await onMessage(update.message)
  } else if ('inline_query' in update) {
    await onInlineQuery(update.inline_query)
  }
}

async function translateEn(text) {
  const response = await sendOpenAI([
    {"role": "system", "content": `
你是一个英语翻译引擎，请翻译给出的单词，只需要翻译不需要解释。
如果你认为单词拼写错误，直接修正成最可能的正确拼写，不需要解释。
给出单词原始形态、
单词的语种、
对应的美式音标、
所有含义（含词性）、
英中双语示例，每种含义至少一条例句，总例句至少三条、
所有词根和前后缀
派生单词、
近义单词、
形似单词。
    `},
    {"role": "assistant", "content": "好的，我明白了，请给我这个单词。"},
    {"role": "user", "content": `单词是: ${text}`}
  ])
  return response.choices[0]?.message?.content ?? JSON.stringify(response)
}

/**
 * Handle incoming Message
 * https://core.telegram.org/bots/api#message
 */
async function onMessage (message) {
  await sendPlainText(message.chat.id, "正在查询，请稍候...", message.message_id)
  const content = await translateEn(message.text)
  await sendPlainText(message.chat.id, content, message.message_id)
  await sendPlainText(message.chat.id, "正在生成语音...", message.message_id)
  const audioBlob = await sendTTS(message.text)
  return await sendVoice(message.chat.id, audioBlob, message.text)
}

/**
 * Send plain text message
 * https://core.telegram.org/bots/api#sendmessage
 */
async function sendPlainText (chatId, text, messageId=null) {
  let body = {
    chat_id: chatId,
    text
  }
  if (messageId) {
    body["messageId"] = messageId
  }
  return (await fetch(apiUrl('sendMessage', body))).json()
}

async function sendVoice(chatId, audioBlob, text) {
  const formData = new FormData()
  formData.append('chat_id', chatId)
  formData.append('audio', audioBlob)
  formData.append('caption', text)
  return (await fetch(apiUrl('sendAudio'), {
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

async function sendOpenAI(messages) {
  const body = JSON.stringify({
    messages,
    temperature: 0.3
  })
  const request = new Request(openaiUrl(), {
    method: "POST",
    headers: {
     "Content-Type": "application/json",
     "api-key": AZURE_API_KEY
    },
    body
  })
  return (await fetch(request)).json()
}

/**
 * Handle incoming query
 * https://core.telegram.org/bots/api#InlineQuery
 * This will reply with a voice message but can be changed in type
 * The input file is defined in the environment variables.
 */
async function onInlineQuery (inlineQuery) {
  const results = []
  const search = inlineQuery.query
  const jsonInputFiles = await NAMESPACE.get('input_files')
  const parsedInputFiles = JSON.parse(jsonInputFiles)
  const number = Object.keys(parsedInputFiles).length
  for (let i = 0; i < number; i++) {
    const caption = parsedInputFiles[i][3]
    const title = parsedInputFiles[i][0]
    if ((caption.toLowerCase().includes(search.toLowerCase())) || title.toLowerCase().includes(search.toLowerCase())) {
      results.push({
        type: 'voice',
        id: crypto.randomUUID(),
        voice_url: parsedInputFiles[i][1],
        title: parsedInputFiles[i][0],
        voice_duration: parsedInputFiles[i][2],
        caption: parsedInputFiles[i][3],
        parse_mode: 'HTML'
      })
    }
  }
  const res = JSON.stringify(results)
  return SendInlineQuery(inlineQuery.id, res)
}

/**
 * Send result of the query
 * https://core.telegram.org/bots/api#answerinlinequery
 */

async function SendInlineQuery (inlineQueryId, results) {
  return (await fetch(apiUrl('answerInlineQuery', {
    inline_query_id: inlineQueryId,
    results
  }))).json()
}

/**
 * Set webhook to this worker's url
 * https://core.telegram.org/bots/api#setwebhook
 */
async function registerWebhook (event, requestUrl, suffix, secret) {
  // https://core.telegram.org/bots/api#setwebhook
  const webhookUrl = `${requestUrl.protocol}//${requestUrl.hostname}${suffix}`
  const r = await (await fetch(apiUrl('setWebhook', { url: webhookUrl, secret_token: secret }))).json()
  return new Response('ok' in r && r.ok ? 'Ok' : JSON.stringify(r, null, 2))
}

/**
 * Remove webhook
 * https://core.telegram.org/bots/api#setwebhook
 */
async function unRegisterWebhook (event) {
  const r = await (await fetch(apiUrl('setWebhook', { url: '' }))).json()
  return new Response('ok' in r && r.ok ? 'Ok' : JSON.stringify(r, null, 2))
}

/**
 * Return url to telegram api, optionally with parameters added
 */
function apiUrl (methodName, params = null) {
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