import { google } from "@xsai-ext/providers"
import { generateText } from "@xsai/generate-text"
import { streamText } from "@xsai/stream-text"
import type { AIAPI, ChatParams, Message } from "../../bindings"

export const createGeminiAPI = (params: { apiKey: string }): AIAPI => {
    const model = "gemini-2.0-flash-exp"
    const baseURL = "https://generativelanguage.googleapis.com/v1beta/openai/"

    return {
        chat: async (payloads: ChatParams, onStream?) => {
            // Convert our Message type to xsai's Message type
            const messages = payloads.messages.map((m: Message) => ({
                role: m.role as "system" | "user" | "assistant",
                content: m.content,
            }))

            if (!onStream) {
                // Non-streaming mode
                const result = await generateText({
                    ...google.chat(model),
                    apiKey: params.apiKey,
                    baseURL: baseURL,
                    model: model,
                    messages,
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
                    ...google.chat(model),
                    apiKey: params.apiKey,
                    baseURL: baseURL,
                    model: model,
                    messages,
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
