import { OpenAIAPI, Payloads, readChatStream } from "@yuchanns/flameai"

const makeRequest = (params: {
	url: string
	apiKey: string
	body: Payloads
}) => {
	const u = new URL(`${params.url}/v1/chat/completions?path=v1&path=chat&path=completions`)
	const body = JSON.stringify(params.body)
	return new Request(u, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${params.apiKey}`
		},
		body: body
	})
}


export const createOpenAIAPI = (params: {
	url: string,
	model: string,
	apiKey: string
}) => {
	return {
		chat: async (payloads, onStream) => {
			payloads.model = params.model
			if (onStream) {
				payloads.stream = true
			} else {
				payloads.stream = false
			}
			const r = makeRequest({
				url: params.url,
				apiKey: params.apiKey,
				body: payloads
			})
			const response = await fetch(r)
			if (!response.ok) {
				throw Error(response.statusText)
			}
			if (!onStream) {
				return await response.json()
			}
			if (!response.body) {
				throw Error("no body")
			}
			const reader = response.body.getReader()
			await readChatStream(reader, onStream)
		}
	} as OpenAIAPI
}

