/**
 * i18n module for multi-language support
 * Inspired by the deepfuture project's language system
 */

import zhCN from "../../locales/zh-CN.json"
import en from "../../locales/en.json"
import { D1Database } from "@cloudflare/workers-types"
import { eq } from "drizzle-orm"
import { drizzle } from "drizzle-orm/d1"
import { userPreferences } from "../db/schema"

export type Locale = "zh-CN" | "en"
export type LocaleData = typeof zhCN

// Available locales
const locales: Record<Locale, LocaleData> = {
    "zh-CN": zhCN,
    en: en,
}

// Default locale
const DEFAULT_LOCALE: Locale = "zh-CN"

/**
 * Get a nested value from an object using a dot-separated path
 */
function getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split(".").reduce((acc, part) => acc?.[part], obj)
}

/**
 * Replace placeholders in a string with values from a context object
 * Supports {key} format placeholders
 */
function interpolate(template: string, context: Record<string, string | number> = {}): string {
    return template.replace(/\{(\w+)\}/g, (match, key) => {
        return context[key] !== undefined ? String(context[key]) : match
    })
}

/**
 * I18n class for managing translations
 */
export class I18n {
    private locale: Locale
    private data: LocaleData

    constructor(locale: Locale = DEFAULT_LOCALE) {
        this.locale = locale
        this.data = locales[locale] || locales[DEFAULT_LOCALE]
    }

    /**
     * Get current locale
     */
    getLocale(): Locale {
        return this.locale
    }

    /**
     * Switch to a different locale
     */
    switch(locale: Locale): void {
        if (locales[locale]) {
            this.locale = locale
            this.data = locales[locale]
        }
    }

    /**
     * Translate a key to the current locale
     * Supports nested keys using dot notation (e.g., "help.title")
     * Supports placeholder interpolation using {key} format
     */
    t(key: string, context?: Record<string, string | number>): string {
        const value = getNestedValue(this.data, key)

        if (value === undefined) {
            console.warn(`Translation key not found: ${key}`)
            return key
        }

        if (typeof value === "string") {
            return context ? interpolate(value, context) : value
        }

        if (Array.isArray(value)) {
            return value.join("\n")
        }

        console.warn(`Translation value is not a string or array: ${key}`)
        return key
    }

    /**
     * Check if a locale is supported
     */
    static isValidLocale(locale: string): locale is Locale {
        return locale in locales
    }

    /**
     * Get all available locales
     */
    static getAvailableLocales(): Locale[] {
        return Object.keys(locales) as Locale[]
    }
}

/**
 * Map Telegram language code to our locale
 * Telegram uses IETF language tags like "en", "zh-hans", "zh-hant", "ja", etc.
 */
export function detectLocaleFromTelegram(languageCode: string | undefined): Locale | null {
    if (!languageCode) {
        return null
    }

    // Normalize to lowercase for comparison
    const code = languageCode.toLowerCase()

    // Direct matches
    if (code === "en") {
        return "en"
    }

    // Chinese variants
    if (code === "zh" || code === "zh-hans" || code === "zh-cn") {
        return "zh-CN"
    }

    // For other Chinese variants (zh-hant, zh-tw, zh-hk), also map to zh-CN
    if (code.startsWith("zh")) {
        return "zh-CN"
    }

    // Default to null if we don't support the language
    return null
}

/**
 * Get user's preferred language from database
 */
export async function getUserLanguage(db: D1Database, userId: number): Promise<Locale | null> {
    try {
        const orm = drizzle(db)
        const result = await orm.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1)

        if (result.length > 0 && result[0].language) {
            const lang = result[0].language
            return I18n.isValidLocale(lang) ? (lang as Locale) : null
        }
    } catch (error) {
        console.error("Error getting user language:", error)
    }
    return null
}

/**
 * Set user's preferred language in database
 */
export async function setUserLanguage(db: D1Database, userId: number, language: Locale): Promise<void> {
    try {
        const orm = drizzle(db)
        const now = Math.floor(Date.now() / 1000)

        // Check if user preferences exist
        const existing = await orm.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1)

        if (existing.length > 0) {
            // Update existing preferences
            await orm
                .update(userPreferences)
                .set({
                    language,
                    updatedAt: now,
                })
                .where(eq(userPreferences.userId, userId))
        } else {
            // Insert new preferences
            await orm.insert(userPreferences).values({
                userId,
                language,
                updatedAt: now,
            })
        }
    } catch (error) {
        console.error("Error setting user language:", error)
        throw error
    }
}

/**
 * Create an I18n instance for a user with auto-detection support
 * 1. First checks database for user's saved preference
 * 2. If no preference, tries to detect from Telegram language_code
 * 3. If detection succeeds and language is supported, saves it as preference
 * 4. Falls back to default language if all else fails
 */
export async function createI18nForUser(
    db: D1Database | undefined,
    userId: number | undefined,
    telegramLanguageCode?: string
): Promise<I18n> {
    if (!db || !userId) {
        return new I18n(DEFAULT_LOCALE)
    }

    try {
        // First, check if user has a saved preference
        const userLang = await getUserLanguage(db, userId)
        if (userLang) {
            return new I18n(userLang)
        }

        // No saved preference, try to auto-detect from Telegram
        if (telegramLanguageCode) {
            const detectedLocale = detectLocaleFromTelegram(telegramLanguageCode)
            if (detectedLocale) {
                // Save the detected language as user's preference
                await setUserLanguage(db, userId, detectedLocale)
                console.log(
                    `Auto-detected and saved language ${detectedLocale} for user ${userId} from Telegram code ${telegramLanguageCode}`
                )
                return new I18n(detectedLocale)
            }
        }

        // Fall back to default locale
        return new I18n(DEFAULT_LOCALE)
    } catch (error) {
        console.error("Error creating i18n for user:", error)
        return new I18n(DEFAULT_LOCALE)
    }
}

/**
 * Format help message using translations
 */
export function formatHelpMessage(i18n: I18n): string {
    const sections = [
        i18n.t("help.title"),
        "",
        i18n.t("help.vocabulary_query.title"),
        i18n.t("help.vocabulary_query.description"),
        i18n.t("help.vocabulary_query.example"),
        "",
        i18n.t("help.vocabulary_query.features"),
        "",
        i18n.t("help.quiz.title"),
        i18n.t("help.quiz.description"),
        i18n.t("help.quiz.command"),
        "",
        i18n.t("help.quiz.features"),
        "",
        i18n.t("help.quiz.note"),
        "",
        i18n.t("help.model_switch.title"),
        i18n.t("help.model_switch.description"),
        i18n.t("help.model_switch.view_command"),
        i18n.t("help.model_switch.switch_command"),
        "",
        i18n.t("help.model_switch.supported"),
        i18n.t("help.model_switch.example"),
        "",
        i18n.t("help.language.title"),
        i18n.t("help.language.description"),
        i18n.t("help.language.view_command"),
        i18n.t("help.language.switch_command"),
        "",
        i18n.t("help.language.supported"),
        i18n.t("help.language.example"),
        "",
        i18n.t("help.help_command.title"),
        i18n.t("help.help_command.description"),
        "",
        i18n.t("help.closing"),
    ]

    return sections.join("\n").trim()
}

/**
 * Format tips message using translations
 */
export function formatTipsMessage(i18n: I18n): string {
    const sections = [
        i18n.t("tips.title"),
        "",
        i18n.t("tips.help_command"),
        i18n.t("tips.quiz_command"),
        i18n.t("tips.query_hint"),
        "",
        i18n.t("tips.closing"),
    ]

    return sections.join("\n").trim()
}
