// https://core.telegram.org/bots/api#making-requests
export type Response<T> = {
	ok: boolean
	description?: string
	error_code: number
	parameters?: {
		migrate_to_chat_id?: number
		retry_after?: number
	}
	result: T
}

export type User = {
	id: number
	is_bot: boolean
	username: string
}

export type MessageEntity = {
	"type": string
	offset: number
	length: number
	url?: string
	user?: User
	language?: string
	custom_emoji_id: string
}

export type Chat = {
	id: number
	"type": string
	title?: string
	username?: string
	first_name?: string
	last_name?: string
}

export type Message = {
	message_id: number
	message_thread_id?: number
	from: User
	date: number
	chat: Chat
	text?: string
	reply_to_message?: Message
	entities?: MessageEntity[]
}

export type Update = {
	update_id: number
	message?: Message
	edited_message?: Message
	channel_post?: Message
	edited_channel_post?: Message
}

export interface TelegramBotAPI {
	// https://core.telegram.org/bots/api#setwebhook
	setWebhook(params: {
		url: string,
		secret_token: string
	}): Promise<Response<boolean>>
	// https://core.telegram.org/bots/api#getme
	getMe(): Promise<Response<User>>
	// https://core.telegram.org/bots/api#sendmessage
	sendMessage(params: {
		chat_id: string | number
		message_thread_id?: number
		text: string
		reply_to_message_id?: number
		parse_mode?: string
		disable_web_page_preview?: boolean
		disable_notification?: boolean
		protect_content?: boolean
		allow_sending_without_reply?: boolean
	}): Promise<Response<Message>>
	editMessageText(params: {
		chat_id?: string | number
		message_id?: number
		inline_message_id?: string
		text: string
		parse_mode?: string
		entities?: MessageEntity[]
		disable_web_page_preview?: boolean
	}): Promise<Response<Message>>
	sendVoice(params: {
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
	}): Promise<Response<Message>>
}
