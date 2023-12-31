## 🌟 B-Komachi-AI-worker

A sophisticated Telegram bot Vocabulary Assistant deployed on Cloudflare Worker.

OpenAI/AzureOpenAI/Gemini Pro + EdgeTTS 🗣️

https://github.com/yuchanns/b-komachi-ai-worker/assets/25029451/7f882226-49a0-4a00-b8b0-447a7f88cf6c

### 🚀 Features
- [x] 📚 Vocabulary
- [x] 🎧 Pronunciation
- [x] 💻 Stream Output
- [x] 🤖 Multiple AI support(Azure OpenAI, Gemini Pro...)
- [ ] 📝 Daily quizzes based on user-specific vocabulary.
- [ ] 👂 Review mode for listening to speech and selecting the answer.
- [ ] 🌎 Support for learning multiple languages.
- [ ] 🤔 Identify unfamiliar words within sentences.
- [ ] 🧠 Efficient retention through grouping common words.
- [ ] 🔮 More features coming soon...

## 🛠️ Deploy

Users must provide the following environment variables within GitHub's Secrets - go to "Settings -> Secrets":

|Name|Description|Example|
|---|---|---|
|CLOUDFLARE_ACOUNT_ID|[Documentation](https://developers.cloudflare.com/fundamentals/setup/find-account-and-zone-ids/)||
|CLOUDFLARE_API_TOKEN|[Documentation](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)||
|ENV_AZURE_URL|Azure OpenAI Deployment Endpoint|https://yuchanns-openai.openai.azure.com/openai/deployments/gpt35|
|ENV_AZURE_API_KEY|Azure OpenAI API Key||
|ENV_AZURE_API_VERSION|Azure OpenAI API Version|2023-09-01-preview|
|ENV_BOT_SECRET|Telegram Bot Verification Secret, Random Generate From `A-Z, a-z, 0-9, _ and -`||
|ENV_BOT_TOKEN|Telegram Bot Token||
|ENV_GEMINI_API_KEY|Google Gemini Pro API Key||
|ENV_OPENAI_API_KEY|OpenAI API Key||
|ENV_OPENAI_URL|Optional|https://api.openai.com|
|ENV_OPENAI_MODEL|Optional|gpt-3.5-turbo|
|ENV_AI_BACKEND|Specify Which AI Backend To Use|Optional: `Azure`, `Gemini`, `OpenAI`|

Subsequently, deploy the worker by triggering Github Actions.

At the end, visit `https://${your.domain.com}/hook/registerWebhook` to register hooks for Telegram Bot.

🔗 Useful references:
- [Telegram Bot Father](https://core.telegram.org/bots/tutorial)
- [Cloudflare Workers](https://developers.cloudflare.com/workers)
- [Azure OpenAI Quick Start](https://learn.microsoft.com/en-us/azure/ai-services/openai/quickstart)
- [Gemini Pro](ai.google.dev/docs)

## 🔧 Development

### 🧪 Unit Tests

Simple run below command to specify unit test:
```bash
pnpm test -- -t '<describe> <test>'
```
