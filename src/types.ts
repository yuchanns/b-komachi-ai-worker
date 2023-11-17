import { EdgeTTSAPI, OpenAIAPI, TelegramBotAPI } from "./clients"

export type Env = {
	Bindings: {
		ENV_BOT_TOKEN: string
		ENV_BOT_SECRET: string
		ENV_AZURE_URL: string
		ENV_AZURE_API_KEY: string
		ENV_AZURE_API_VERSION: string
		ENV_AZURE_TTS_ENDPOINT: string
		ENV_AZURE_TTS_KEY: string
	}
}

export type Injector = {
	bot: TelegramBotAPI
	ai: OpenAIAPI,
	tts: EdgeTTSAPI
}
