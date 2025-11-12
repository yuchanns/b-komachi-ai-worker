import { D1Database } from "@cloudflare/workers-types"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { userPreferences } from "../db/schema"
import { Bindings } from "../bindings"
import { I18n } from "./i18n"

/**
 * Available AI backends
 */
export const AI_BACKENDS = ["azure", "gemini", "openai"] as const
export type AIBackend = (typeof AI_BACKENDS)[number]

/**
 * Get user's preferred AI backend
 */
export const getUserAIBackend = async (db: D1Database, userId: number): Promise<AIBackend | null> => {
    const orm = drizzle(db)

    const result = await orm.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1)

    if (result.length === 0 || !result[0].aiBackend) {
        return null
    }

    return result[0].aiBackend as AIBackend
}

/**
 * Set user's preferred AI backend
 */
export const setUserAIBackend = async (db: D1Database, userId: number, backend: AIBackend): Promise<void> => {
    const orm = drizzle(db)
    const now = Math.floor(Date.now() / 1000)

    try {
        // Try to insert
        await orm.insert(userPreferences).values({
            userId,
            aiBackend: backend,
            updatedAt: now,
        })
    } catch {
        // If insert fails (duplicate key), update instead
        await orm
            .update(userPreferences)
            .set({
                aiBackend: backend,
                updatedAt: now,
            })
            .where(eq(userPreferences.userId, userId))
    }
}

/**
 * Get available AI backends based on environment configuration
 */
export const getAvailableBackends = (env: Bindings): AIBackend[] => {
    const available: AIBackend[] = []

    if (env.ENV_AZURE_API_KEY && env.ENV_AZURE_URL) {
        available.push("azure")
    }

    if (env.ENV_GEMINI_API_KEY) {
        available.push("gemini")
    }

    if (env.ENV_OPENAI_API_KEY) {
        available.push("openai")
    }

    return available
}

/**
 * Get the display name and model info for an AI backend
 */
export const getBackendInfo = (backend: AIBackend, env: Bindings): { name: string; model: string } => {
    switch (backend) {
        case "azure":
            return {
                name: "Azure OpenAI",
                model: env.ENV_AZURE_URL?.split("/deployments/")[1]?.split("/")[0] || "gpt-35-turbo",
            }
        case "gemini":
            return {
                name: "Google Gemini",
                model: env.ENV_GEMINI_MODEL || "gemini-1.5-flash",
            }
        case "openai":
            return {
                name: "OpenAI",
                model: env.ENV_OPENAI_MODEL || "gpt-3.5-turbo",
            }
    }
}

/**
 * Format the model selection menu with i18n support
 */
export const formatModelMenu = (env: Bindings, currentBackend?: AIBackend | null, i18n?: I18n): string => {
    const available = getAvailableBackends(env)

    if (available.length === 0) {
        return i18n ? i18n.t("model.not_configured") : "❌ 没有可用的 AI 模型配置"
    }

    let message = ""

    if (currentBackend) {
        const info = getBackendInfo(currentBackend, env)
        message += i18n
            ? i18n.t("model.current", { backend: `${info.name} (${info.model})` })
            : `🤖 *当前 AI 模型*\n当前使用：*${info.name}* (${info.model})`
    } else {
        const defaultBackend = env.ENV_AI_BACKEND.toLowerCase() as AIBackend
        const info = getBackendInfo(defaultBackend, env)
        message += i18n
            ? i18n.t("model.current", { backend: `${info.name} (${info.model}) _(默认)_` })
            : `🤖 *当前 AI 模型*\n当前使用：*${info.name}* (${info.model}) _(默认)_`
    }

    message += i18n ? i18n.t("model.available") : "\n\n*可用模型*"
    message += "\n\n"

    for (const backend of available) {
        const info = getBackendInfo(backend, env)
        const marker = currentBackend === backend ? "✅ " : ""
        message += `${marker}*${backend}* - ${info.name} (${info.model})\n`
    }

    message += i18n ? i18n.t("model.switch_hint") : "\n\n💡 使用 `/model <backend>` 切换模型\n例如: `/model gemini`"

    return message
}
