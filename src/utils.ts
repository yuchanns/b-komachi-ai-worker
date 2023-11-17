import createTelegramBotAPI, {
	Response as BotResponse, createEdgeTTSAPI, createOpenAIAPI
} from './clients'
import { Env } from './types'
import { Hono, Context } from 'hono'
import { logger } from 'hono/logger'
import { HTTPException } from 'hono/http-exception'

export const createOpenAI = (c: Context<Env>) => {
	return createOpenAIAPI({
		url: c.env.ENV_AZURE_URL,
		apiVersion: c.env.ENV_AZURE_API_VERSION,
		apiKey: c.env.ENV_AZURE_API_KEY
	})
}

export const createTTS = (_c: Context<Env>) => {
	return createEdgeTTSAPI()
}

export const createBot = (c: Context<Env>) => {
	return createTelegramBotAPI(c.env.ENV_BOT_TOKEN)
}

export const createApp = () => {
	const app = new Hono<Env>()
	app.use('*', logger())
		.get('/', (c) => c.text('Hello B-Komachi-AI!'))
		.onError((err, c) => {
			if (err instanceof HTTPException) {
				return err.getResponse()
			}
			return c.text(err.message, 500)
		})
	return app
}
