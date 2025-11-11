import { generateText, streamText } from "xsai"
import { AIAPI, ChatParams, Message } from "../bindings"

export const createAzureAPI = (params: { url: string; apiVersion: string; apiKey: string }): AIAPI => {
    const baseURL = `${params.url}/chat/completions?api-version=${params.apiVersion}`

    return {
        chat: async (payloads: ChatParams, onStream) => {
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
                    temperature: payloads.temperature,
                    headers: {
                        "api-key": params.apiKey,
                    },
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
                    temperature: payloads.temperature,
                    headers: {
                        "api-key": params.apiKey,
                    },
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
