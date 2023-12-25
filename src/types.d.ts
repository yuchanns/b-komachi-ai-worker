import { TelegramBotAPI } from "@yuchanns/flamebot/dist/types"
import { EdgeTTSAPI } from "./clients"
import { OpenAIAPI } from "@yuchanns/flameai"

export type Bindings = {
	ENV_BOT_TOKEN: string
	ENV_BOT_SECRET: string
	ENV_AZURE_URL: string
	ENV_AZURE_API_KEY: string
	ENV_AZURE_API_VERSION: string
	ENV_AZURE_TTS_ENDPOINT: string
	ENV_AZURE_TTS_KEY: string
	ENV_CHAT_ID: string
	ENV_GEMINI_API_KEY: string
	ENV_OPENAI_URL: string
	ENV_OPENAI_API_KEY: string
	ENV_OPENAI_MODEL: string
	ENV_AI_BACKEND: string
}

export type Env = {
	Bindings: Bindings
}

export type Injector = {
	bot: TelegramBotAPI
	ai: OpenAIAPI,
	tts: EdgeTTSAPI
}

declare global {
	function getMiniflareBindings(): Bindings
}
