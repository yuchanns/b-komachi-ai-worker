import { generateText, streamText } from "xsai"
import type { AIAPI, ChatParams, Message } from "../../bindings"

const makeBaseURL = (url: string) => {
    return `${url}/v1`
}

export const createOpenAIAPI = (params: { url: string; model: string; apiKey: string }): AIAPI => {
    return {
        chat: async (payloads: ChatParams, onStream?) => {
            const baseURL = makeBaseURL(params.url)
            // Convert our Message type to xsai's Message type
            const messages = payloads.messages.map((m: Message) => ({
                role: m.role as "system" | "user" | "assistant",
                content: m.content,
            }))

            if (!onStream) {
                // Non-streaming mode
                const result = await generateText({
                    apiKey: params.apiKey,
                    baseURL: baseURL,
                    messages,
                    model: params.model,
                    temperature: payloads.temperature,
                })

                return {
                    choices: [
                        {
                            index: 0,
                            message: {
                                role: "assistant",
                                content: result.text || "",
                            },
                            finish_reason: result.finishReason,
                        },
                    ],
                }
            } else {
                // Streaming mode
                const result = streamText({
                    apiKey: params.apiKey,
                    baseURL: baseURL,
                    messages,
                    model: params.model,
                    temperature: payloads.temperature,
                })

                const reader = result.fullStream.getReader()

                while (true) {
                    const { value, done } = await reader.read()
                    if (done) {
                        await onStream(undefined, true)
                        break
                    }

                    if (value.type === "text-delta") {
                        await onStream(
                            {
                                choices: [
                                    {
                                        index: 0,
                                        delta: {
                                            role: "assistant",
                                            content: value.text,
                                        },
                                        finish_reason: "",
                                    },
                                ],
                            },
                            false
                        )
                    } else if (value.type === "finish") {
                        await onStream(
                            {
                                choices: [
                                    {
                                        index: 0,
                                        delta: {
                                            role: "assistant",
                                            content: "",
                                        },
                                        finish_reason: value.finishReason,
                                    },
                                ],
                            },
                            false
                        )
                    }
                }
            }
        },
    }
}
