import { Context } from "hono"
import { createTelegramBotAPI } from "./telegram"
import { createAzureAPI } from "./openai/azure"
import { Bindings } from "../bindings"
import { createEdgeTTSAPI, createGeminiAPI, createOpenAIAPI } from "./"

export const createBot = (c: Context<{ Bindings: Bindings }>) => {
    return createTelegramBotAPI(c.env.ENV_BOT_TOKEN)
}

export const createAI = (c: Context<{ Bindings: Bindings }>) => {
    if (c.env.ENV_AI_BACKEND.toLowerCase() == "gemini" && c.env.ENV_GEMINI_API_KEY != "") {
        return createGeminiAPI({
            apiKey: c.env.ENV_GEMINI_API_KEY,
        })
    }
    if (c.env.ENV_AI_BACKEND.toLowerCase() == "openai" && c.env.ENV_OPENAI_API_KEY != "") {
        const url = c.env.ENV_OPENAI_URL || "https://api.openai.com"
        const model = c.env.ENV_OPENAI_MODEL || "gpt-3.5-turbo"
        return createOpenAIAPI({
            url,
            apiKey: c.env.ENV_OPENAI_API_KEY,
            model,
        })
    }
    return createAzureAPI({
        url: c.env.ENV_AZURE_URL,
        apiVersion: c.env.ENV_AZURE_API_VERSION,
        apiKey: c.env.ENV_AZURE_API_KEY,
    })
}

export const createTTS = (_c: Context<{ Bindings: Bindings }>) => {
    return createEdgeTTSAPI()
}
