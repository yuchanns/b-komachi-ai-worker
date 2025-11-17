import { EdgeTTSAPI, Voice } from "./types"
import { generateConnectionId, dateToString, generateSecMsGec } from "./utils"

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
const BASE_URL = "api.msedgeservices.com/tts/cognitiveservices"
const OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3"
const BINARY_DELIM = "Path:audio\r\n"
const CHROMIUM_FULL_VERSION = "140.0.3485.14"
const CHROMIUM_MAJOR_VERSION = CHROMIUM_FULL_VERSION.split(".")[0]
const SEC_MS_GEC_VERSION = `1-${CHROMIUM_FULL_VERSION}`
const VOICE_LIST_URL = `https://${BASE_URL}/voices/list?Ocp-Apim-Subscription-Key=${TRUSTED_CLIENT_TOKEN}`

const makeConfigRequest = (outputFormat: string) => {
    const timestamp = dateToString()
    return (
        `X-Timestamp:${timestamp}\r\n` +
        `Content-Type:application/json; charset=utf-8\r\n` +
        `Path:speech.config\r\n\r\n` +
        `{"context":{"synthesis":{"audio":{"metadataoptions":{` +
        `"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},` +
        `"outputFormat":"${outputFormat}"` +
        `}}}}\r\n`
    )
}

const makeSSMLRequest = (ssml: string) => {
    const requestId = generateConnectionId()
    const timestamp = dateToString()
    return (
        `X-RequestId:${requestId}\r\n` +
        `Content-Type:application/ssml+xml\r\n` +
        `X-Timestamp:${timestamp}Z\r\n` +
        `Path:ssml\r\n\r\n` +
        ssml
    )
}

const makeSSML = (params: { input: string; voice: string; pitch: string; rate: string; volume: string }) => {
    return (
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
        `<voice name='${params.voice}'>` +
        `<prosody pitch='${params.pitch}' rate='${params.rate}' volume='${params.volume}'>` +
        `${params.input}` +
        `</prosody></voice></speak>`
    )
}

const readAudioBlob = (ws: WebSocket): Promise<Blob> => {
    const audioBuffers: Uint8Array[] = []
    const decoder = new TextDecoder()
    const dbytes = new TextEncoder().encode(BINARY_DELIM)
    return new Promise((resolve, reject) => {
        ws.addEventListener("message", (event) => {
            const m = event.data instanceof ArrayBuffer ? decoder.decode(event.data) : event.data
            if (m.includes("Path:audio") && event.data instanceof ArrayBuffer) {
                const buffer = new Uint8Array(event.data)
                const index = buffer.indexOf(dbytes[0]) + dbytes.length
                const audioData = buffer.slice(index, buffer.length)
                audioBuffers.push(audioData)
            }
            if (m.includes("Path:turn.end")) {
                if (audioBuffers.length == 0) {
                    reject("no audio data received")
                    return
                }
                resolve(new Blob(audioBuffers))
                return
            }
        })
        ws.addEventListener("error", (event) => {
            reject(event)
        })
        ws.addEventListener("close", (event) => {
            if (event.code == 1000) {
                return
            }
            reject(event)
        })
    })
}

// encountered an issue while constructing WebSocket instance
// https://community.cloudflare.com/t/writing-a-websocket-client-to-connect-to-remote-websocket-server-doesnt-work/494853
// therefore we use a workaround to solve that
// https://developers.cloudflare.com/workers/examples/websockets/#write-a-websocket-client
const createWebSocket = async (url: string) => {
    const r = new Request(url, {
        headers: {
            Upgrade: "websocket",
            Connection: "Upgrade",
            "Sec-WebSocket-Protocol": "synthesize",
            "Sec-WebSocket-Version": "13",
            Pragma: "no-cache",
            "Cache-Control": "no-cache",
            Origin: "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
            "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "en-US,en;q=0.9",
        },
    })
    const resp = await fetch(r)
    const ws = resp.webSocket
    if (!ws) {
        throw new Error("server didn't accept WebSocket")
    }
    if (ws.readyState != WebSocket.OPEN) {
        throw new Error("incorrect ready state: " + ws.readyState)
    }
    return ws
}

export const createEdgeTTSAPI = () => {
    return {
        // reference: https://github.com/rany2/edge-tts
        textToSpeech: async ({
            text: input,
            voice = "en-US-AriaNeural",
            pitch = "+0Hz",
            rate = "+0%",
            volume = "+0%",
            outputFormat = OUTPUT_FORMAT,
        }) => {
            const connectionId = generateConnectionId()
            const secMsGec = await generateSecMsGec(TRUSTED_CLIENT_TOKEN)
            const wsUrl = `https://${BASE_URL}/websocket/v1?Ocp-Apim-Subscription-Key=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${connectionId}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`

            const ws = await createWebSocket(wsUrl)
            try {
                ws.accept()
                const configRequest = makeConfigRequest(outputFormat)
                ws.send(configRequest)
                const ssml = makeSSML({ input, voice, pitch, rate, volume })
                const request = makeSSMLRequest(ssml)
                ws.send(request)
                return await readAudioBlob(ws)
            } finally {
                ws.close()
            }
        },
        listVoices: async (): Promise<Voice[]> => {
            const secMsGec = await generateSecMsGec(TRUSTED_CLIENT_TOKEN)
            const url = `${VOICE_LIST_URL}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=${SEC_MS_GEC_VERSION}`
            const headers = {
                Authority: "speech.platform.bing.com",
                "Sec-CH-UA": `" Not;A Brand";v="99", "Microsoft Edge";v="${CHROMIUM_MAJOR_VERSION}", "Chromium";v="${CHROMIUM_MAJOR_VERSION}"`,
                "Sec-CH-UA-Mobile": "?0",
                Accept: "*/*",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Dest": "empty",
                "User-Agent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${CHROMIUM_MAJOR_VERSION}.0.0.0 Safari/537.36 Edg/${CHROMIUM_MAJOR_VERSION}.0.0.0`,
                "Accept-Encoding": "gzip, deflate, br",
                "Accept-Language": "en-US,en;q=0.9",
            }
            const response = await fetch(url, { headers })
            if (!response.ok) {
                throw new Error(`Failed to fetch voices: ${response.statusText}`)
            }
            const voices: Voice[] = await response.json()
            return voices
        },
    } as EdgeTTSAPI
}
