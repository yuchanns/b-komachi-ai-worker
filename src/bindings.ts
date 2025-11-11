import { TelegramBotAPI } from "./services/telegram"

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
    VOCABULARY: KVNamespace
}

export type EdgeTTSAPI = {
    textToSpeech: (params: { text: string }) => Promise<Blob>
}

// AI API interface compatible with both streaming and non-streaming calls
export type Message = {
    role: string
    content: string
}

export type ChatParams = {
    messages: Message[]
    temperature: number
}

export type ChatResponse = {
    choices: Array<{
        index: number
        message: {
            role: string
            content: string
        }
        finish_reason: string
    }>
}

export type ChunkResponse = {
    choices: Array<{
        index: number
        delta: {
            role: string
            content: string
        }
        finish_reason: string
    }>
}

export type AIAPI = {
    chat(params: ChatParams, onStream?: (r: ChunkResponse | undefined, done: boolean) => Promise<void>): Promise<ChatResponse | undefined>
}

export type Injector = {
    bot: TelegramBotAPI
    ai: AIAPI
    tts: EdgeTTSAPI
}

export type Analyze = {
    word?: {
        text: string
    }
    pronunciation?: {
        ipa: string
    }
    meaning?: {
        part_of_speech: string
        definitions: string[]
    }[]
    example?: {
        sentence: string
        translation: string
    }[]
    origin?: {
        etymology: string
    }
    related?: {
        prefixes: string[]
        suffixes: string[]
        roots: string[]
    }
    derivatives?: {
        word: string
        meaning: string[]
    }[]
    synonyms?: {
        word: string
        meaning: string[]
    }[]
    homophones?: {
        word: string
        meaning: string[]
    }[]
}
