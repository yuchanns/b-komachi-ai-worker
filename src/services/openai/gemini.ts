import { GoogleGenerativeAI } from "@google/generative-ai"
import type { AIAPI, ChatParams, ChatResponse, ChunkResponse } from "../../bindings"

export const createGeminiAPI = (params: { apiKey: string }): AIAPI => {
    const ai = new GoogleGenerativeAI(params.apiKey)
    const model = ai.getGenerativeModel({ model: "gemini-pro" })
    return {
        chat: async (payloads: ChatParams, onStream?) => {
            const contents = []
            for (let message of payloads.messages) {
                let role = "user"
                if ("system" == message.role) {
                    role = "user"
                } else if ("assistant" == message.role) {
                    role = "model"
                }
                contents.push({
                    role,
                    parts: [{ text: message.content }],
                })
            }
            const chat = model.startChat({
                history: contents.slice(0, -1),
            })
            const content = contents[contents.length - 1].parts[0].text
            if (!onStream) {
                const result = await chat.sendMessage(content)
                return {
                    choices: [
                        {
                            index: 0,
                            message: {
                                role: "assistant",
                                content: result.response.text(),
                            },
                            finish_reason: result.response.candidates?.[0]?.finishReason || "stop",
                        },
                    ],
                } as ChatResponse
            }
            const result = await chat.sendMessageStream(content)
            for await (const chunk of result.stream) {
                await onStream(
                    {
                        choices: [
                            {
                                index: 0,
                                delta: {
                                    role: "assistant",
                                    content: chunk.text(),
                                },
                                finish_reason: chunk.candidates?.[0]?.finishReason || "",
                            },
                        ],
                    } as ChunkResponse,
                    false
                )
            }
            await onStream(undefined, true)
        },
    }
}
