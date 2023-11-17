import { EdgeTTSAPI } from "./types"
import { generateRandomHex } from "./utils"

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
const SYNTH_URL = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}`
const OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3"
const BINARY_DELIM = "Path:audio\r\n"

const makeConfigRequest = (outputFormat: string) => {
	return `Content-Type:application/json; charset=utf-8\r\n`
		+ `Path:speech.config\r\n\r\n`
		+ `{"context":{"synthesis":{"audio":{"metadataoptions":{`
		+ `"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":false},`
		+ `"outputFormat":"${outputFormat}"`
		+ `}}}}\r\n`.trim()
}

const makeSSMLRequest = (ssml: string) => {
	const requestId = generateRandomHex()
	return `X-RequestId:${requestId}\r\n`
		+ `Content-Type:application/ssml+xml\r\n`
		+ `Path:ssml\r\n\r\n`
		+ ssml
}

const makeSSML = (params: {
	input: string,
	voice: string,
	pitch: string,
	rate: number,
	volume: number,
}) => {
	return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="en-US">`
		+ `<voice name="${params.voice}"><prosody pitch="${params.pitch}" rate="${params.rate}" volume="${params.volume}">`
		+ `${params.input}</prosody></voice></speak>`.trim()
}

const readAudioBlob = (ws: WebSocket): Promise<Blob> => {
	const audioBuffers: ArrayBuffer[] = []
	const decoder = new TextDecoder()
	const dbytes = new TextEncoder().encode(BINARY_DELIM)
	return new Promise((resolve, reject) => {
		ws.addEventListener("message", event => {
			const m = event.data instanceof ArrayBuffer ?
				decoder.decode(event.data) : event.data
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
		ws.addEventListener("error", event => {
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
// TODO: implementation of the async WebSocket
const createWebSocket = async (url: string) => {
	const r = new Request(url, {
		headers: {
			Upgrade: "websocket",
			Connection: "Upgrade"
		}
	})
	const resp = await fetch(r)
	const ws = resp.webSocket
	if (!ws) {
		throw new Error("server didn't accept WebSocket")
	}
	if (ws.readyState != WebSocket.READY_STATE_OPEN) {
		throw new Error("incorrect ready state: " + ws.readyState)
	}
	return ws
}

export const createEdgeTTSAPI = () => {
	return {
		// reference: https://github.com/rany2/edge-tts/blob/255169484e887f1fe8b8ad3b1fa0e3afa2c8aac2/src/edge_tts/communicate.py#L226
		textToSpeech: async ({
			text: input, voice = "en-US-AriaNeural",
			pitch = "+0Hz", rate = 1.0, volume = 100.0,
			outputFormat = OUTPUT_FORMAT
		}) => {
			const ws = await createWebSocket(SYNTH_URL)
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
		}
	} as EdgeTTSAPI
}
