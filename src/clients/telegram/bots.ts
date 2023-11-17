import { TelegramBotAPI } from "./types"
import { HTTPException } from 'hono/http-exception'

const makeURL = (token: string, path: string) => {
	return new URL(`https://api.telegram.org/bot${token}/${path}`)
}

const fetchJSON = async (u: URL, data: any) => {
	const body = JSON.stringify(data)
	return await fetch(new Request(u), {
		method: "POST",
		body,
		headers: {
			"Content-Type": "application/json"
		}
	})
}

const fetchFormData = async (u: URL, data: any) => {
	const body = new FormData()
	Object.keys(data).forEach(key => {
		body.append(key, data[key])
	})
	return await fetch(new Request(u), {
		method: "POST",
		body,
	})
}

export const createTelegramBotAPI = (token: string) => {
	return {
		setWebhook: async (params) => {
			const u = makeURL(token, "setWebhook")
			const response = await fetchJSON(u, params)
			if (!response.ok) {
				throw new HTTPException(response.status, { res: response })
			}
			return await response.json()
		},
		getMe: async () => {
			const u = makeURL(token, "getMe")
			const response = await fetch(new Request(u))
			if (!response.ok) {
				throw new Error(response.statusText)
			}
			return await response.json()
		},
		sendMessage: async (params) => {
			const u = makeURL(token, "sendMessage")
			const response = await fetchJSON(u, params)
			if (!response.ok) {
				throw new Error(response.statusText)
			}
			return await response.json()
		},
		editMessageText: async (params) => {
			const u = makeURL(token, "editMessageText")
			const response = await fetchJSON(u, params)
			if (!response.ok) {
				throw new Error(response.statusText)
			}
			return await response.json()
		},
		sendVoice: async (params) => {
			const u = makeURL(token, "sendVoice")
			const response = await fetchFormData(u, params)
			if (!response.ok) {
				throw new Error(response.statusText)
			}
			return await response.json()
		}
	} as TelegramBotAPI
}

