export type OpenAIResponse<T> = {
	id: string
	created: number
	choices: T[]
	model: string
	object: string
	usage: {
		completion_tokens: number
		prompt_tokens: number
		total_tokens: number
	}
}

export interface DeltaMessage {
	role: string
	content: string
}

export interface ChatMessage extends DeltaMessage {
	name: string
}

export type ChatResponse = OpenAIResponse<{
	index: number
	message: ChatMessage
	finish_reason: string
}>

export type ChunkResponse = OpenAIResponse<{
	index: number
	delta: DeltaMessage
	finish_reason: string
}>

export type Message = {
	role: string
	content: string
}

export type Payloads = {
	messages: Message[]
	temperature: number
	top_p?: number
	n?: number
	stop?: string[]
	stream?: boolean
}

export interface OpenAIAPI {
	chat(
		params: Payloads,
		onStream?: (r: ChunkResponse | undefined, done: boolean) => Promise<void>
	): Promise<ChatResponse | undefined>
}

