import { Context } from "hono"
import { createTelegramBotAPI } from "./telegram"
import { createAzureAPI } from "./openai/azure"
import { Bindings } from "../bindings"
import { createEdgeTTSAPI, createGeminiAPI, createOpenAIAPI } from "./"
import { getUserAIBackend } from "../lib/user_preferences"

export const createBot = (c: Context<{ Bindings: Bindings }>) => {
    return createTelegramBotAPI(c.env.ENV_BOT_TOKEN)
}

export const createAI = async (c: Context<{ Bindings: Bindings }>, userId?: number) => {
    // Determine which backend to use
    let backend: string = c.env.ENV_AI_BACKEND.toLowerCase()

    // If userId is provided, check for user preference
    if (userId && c.env.DB) {
        const userBackend = await getUserAIBackend(c.env.DB, userId)
        if (userBackend) {
            backend = userBackend
        }
    }

    // Create AI based on backend
    if (backend === "gemini" && c.env.ENV_GEMINI_API_KEY != "") {
        const model = c.env.ENV_GEMINI_MODEL || "gemini-1.5-flash"
        return createGeminiAPI({
            apiKey: c.env.ENV_GEMINI_API_KEY,
            model,
        })
    }
    if (backend === "openai" && c.env.ENV_OPENAI_API_KEY != "") {
        const url = c.env.ENV_OPENAI_URL || "https://api.openai.com"
        const model = c.env.ENV_OPENAI_MODEL || "gpt-3.5-turbo"
        return createOpenAIAPI({
            url,
            apiKey: c.env.ENV_OPENAI_API_KEY,
            model,
        })
    }
    // Default to Azure
    return createAzureAPI({
        url: c.env.ENV_AZURE_URL,
        apiVersion: c.env.ENV_AZURE_API_VERSION,
        apiKey: c.env.ENV_AZURE_API_KEY,
    })
}

export const createTTS = (_c: Context<{ Bindings: Bindings }>) => {
    return createEdgeTTSAPI()
}
