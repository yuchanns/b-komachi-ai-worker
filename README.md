## 🌟 B-Komachi-AI-worker

A sophisticated Telegram bot Vocabulary Assistant deployed on Cloudflare Worker.

AzureOpenAI + AzureTTS 🗣️


https://github.com/yuchanns/b-komachi-ai-worker/assets/25029451/f5ca0820-00b9-4a4e-aa45-70d67602da7b

### 🚀 Features
- [x] 📚 Vocabulary
- [x] 🎧 Pronunciation
- [x] 💻 Stream Output
- [ ] 🔮 more to come...

**Note**: Unfortunately, OpenAI is not supported at the moment due to the absence of a subscription. However, PRs are warmly welcomed.

## 🛠️ Deploy

Users must provide the following environment variables within their Cloudflare Workers:

|Name|Description|Example|
|---|---|---|
|ENV_AZURE_URL|Azure OpenAI Deployment Endpoint|https://yuchanns-openai.openai.azure.com/openai/deployments/gpt35|
|ENV_AZURE_API_KEY|Azure OpenAI API Key||
|ENV_AZURE_API_VERSION|Azure OpenAI API Version|2023-09-01-preview|
|ENV_AZURE_TTS_ENDPOINT|Azure TextToSpeech Endpoint|https://eastus.tts.speech.microsoft.com|
|ENV_AZURE_TTS_KEY|Azure TextToSpeech Key||
|ENV_BOT_SECRET|Telegram Bot Verification Secret||
|ENV_BOT_TOKEN|Telegram Bot Token||

Subsequently, deploy the worker script.

🔗 Useful references:
- [Telegram Bot Father](https://core.telegram.org/bots/tutorial)
- [Cloudflare Workers](https://developers.cloudflare.com/workers)
- [Azure OpenAI Quick Start](https://learn.microsoft.com/en-us/azure/ai-services/openai/quickstart)

