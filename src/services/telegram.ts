// Telegram Bot API implementation
// Refactored from @yuchanns/flamebot to add missing features like callback query handling

export class HTTPError extends Error {
    status: number
    response?: Response
    constructor(status: number, opts?: { response?: Response }) {
        super(`HTTP Error: ${status}`)
        this.status = status
        this.response = opts?.response
    }
}

export function makeURL(token: string, path: string) {
    return new URL(`https://api.telegram.org/bot${token}/${path}`)
}

export function makeFilePath(token: string, path: string) {
    return `https://api.telegram.org/file/bot${token}/${path}`
}

export async function fetchJSON(u: URL, data: Record<string, unknown>) {
    const body = JSON.stringify(data)
    const response = await fetch(new Request(u), {
        method: "POST",
        body,
        headers: {
            "Content-Type": "application/json",
        },
    })
    if (!response.ok) {
        throw new HTTPError(response.status, { response })
    }
    return response
}

export async function fetchFormData(u: URL, data: Record<string, string | Blob>) {
    const body = new FormData()
    Object.keys(data).forEach((key) => {
        body.append(key, data[key])
    })
    const response = await fetch(new Request(u), {
        method: "POST",
        body,
    })
    if (!response.ok) {
        throw new HTTPError(response.status, { response })
    }
    return response
}

// Telegram Bot API Types
export interface TelegramResponse<T> {
    ok: boolean
    description?: string
    error_code: number
    parameters?: {
        migrate_to_chat_id?: number
        retry_after?: number
    }
    result: T
}

export interface User {
    id: number
    is_bot: boolean
    username: string
    first_name?: string
    last_name?: string
}

export interface MessageEntity {
    type: string
    offset: number
    length: number
    url?: string
    user?: User
    language?: string
    custom_emoji_id?: string
}

export interface Chat {
    id: number
    type: string
    title?: string
    username?: string
    first_name?: string
    last_name?: string
}

export interface PhotoSize {
    file_id: string
    file_unique_id: string
    width: number
    height: number
    file_size?: number
}

export interface Message {
    message_id: number
    message_thread_id?: number
    from?: User
    date: number
    chat: Chat
    text?: string
    reply_to_message?: Message
    entities?: MessageEntity[]
    photo?: PhotoSize[]
}

export interface CallbackQuery {
    id: string
    from: User
    message?: Message
    inline_message_id?: string
    chat_instance: string
    data?: string
    game_short_name?: string
}

export interface Update {
    update_id: number
    message?: Message
    edited_message?: Message
    channel_post?: Message
    edited_channel_post?: Message
    callback_query?: CallbackQuery
}

export interface File {
    file_id: string
    file_unique_id: string
    file_size?: number
    file_path?: string
    link?: string
}

export interface InlineKeyboardMarkup {
    inline_keyboard: Array<
        Array<{
            text: string
            url?: string
            callback_data?: string
            web_app?: {
                url: string
            }
            login_url?: {
                url: string
                forward_text?: string
                bot_username?: string
                request_write_access?: boolean
            }
        }>
    >
}

export interface ReplyKeyboardMarkup {
    keyboard: Array<
        Array<{
            text: string
            request_users?: {
                request_id: number
                user_is_bot?: boolean
                user_is_premium?: boolean
                max_quantity?: number
                request_name?: boolean
                request_username?: boolean
                request_photo?: boolean
            }
            request_chat?: {
                request_id: number
                chat_is_channel?: boolean
                chat_is_forum?: boolean
                chat_has_username?: boolean
                chat_is_created?: boolean
                bot_is_member?: boolean
                request_title?: boolean
                request_username?: boolean
                request_photo?: boolean
            }
            request_contact?: boolean
            request_location?: boolean
            request_poll?: {
                type: string
            }
            web_app?: {
                url: string
            }
        }>
    >
    is_persistent?: boolean
    resize_keyboard?: boolean
    one_time_keyboard?: boolean
    input_field_placeholder?: string
    selective?: boolean
}

export interface ReplyKeyboardRemove {
    remove_keyboard: boolean
    selective?: boolean
}

export interface ForceReply {
    force_reply: boolean
    input_field_placeholder?: string
    selective?: boolean
}

export interface TelegramBotAPI {
    setWebhook: (params: { url: string; secret_token: string }) => Promise<TelegramResponse<boolean>>
    getMe: () => Promise<TelegramResponse<User>>
    sendMessage: (params: {
        chat_id: string | number
        message_thread_id?: number
        text: string
        reply_to_message_id?: number
        parse_mode?: string
        disable_web_page_preview?: boolean
        disable_notification?: boolean
        protect_content?: boolean
        allow_sending_without_reply?: boolean
        reply_markup?: InlineKeyboardMarkup | ReplyKeyboardMarkup | ReplyKeyboardRemove | ForceReply
    }) => Promise<TelegramResponse<Message>>
    editMessageText: (params: {
        chat_id?: string | number
        message_id?: number
        inline_message_id?: string
        text: string
        parse_mode?: string
        entities?: MessageEntity[]
        disable_web_page_preview?: boolean
        reply_markup?: InlineKeyboardMarkup
    }) => Promise<TelegramResponse<Message>>
    sendVoice: (params: {
        chat_id: string | number
        message_thread_id?: number
        voice: Blob
        caption?: string
        parse_mode?: string
        caption_entities?: MessageEntity[]
        duration?: number
        disable_notification?: boolean
        protect_content?: boolean
        allow_sending_without_reply?: boolean
        reply_to_message_id?: number
    }) => Promise<TelegramResponse<Message>>
    getFile: (params: { file_id: string; with_link?: boolean }) => Promise<TelegramResponse<File>>
    answerCallbackQuery: (params: {
        callback_query_id: string
        text?: string
        show_alert?: boolean
        url?: string
        cache_time?: number
    }) => Promise<TelegramResponse<boolean>>
}

export function createTelegramBotAPI(token: string): TelegramBotAPI {
    return {
        setWebhook: async (params) => {
            const u = makeURL(token, "setWebhook")
            const response = await fetchJSON(u, params)
            return await response.json()
        },
        getMe: async () => {
            const u = makeURL(token, "getMe")
            const response = await fetch(new Request(u))
            return await response.json()
        },
        sendMessage: async (params) => {
            const u = makeURL(token, "sendMessage")
            const response = await fetchJSON(u, params)
            return await response.json()
        },
        editMessageText: async (params) => {
            const u = makeURL(token, "editMessageText")
            const response = await fetchJSON(u, params)
            return await response.json()
        },
        sendVoice: async (params) => {
            const u = makeURL(token, "sendVoice")
            const response = await fetchFormData(u, params)
            return await response.json()
        },
        getFile: async (params) => {
            const u = makeURL(token, "getFile")
            const response = await fetchJSON(u, {
                file_id: params.file_id,
            })
            const resp = (await response.json()) as TelegramResponse<File>
            if (params.with_link && resp.result.file_path) {
                resp.result.link = makeFilePath(token, resp.result.file_path)
            }
            return resp
        },
        answerCallbackQuery: async (params) => {
            const u = makeURL(token, "answerCallbackQuery")
            const response = await fetchJSON(u, params)
            return await response.json()
        },
    }
}
