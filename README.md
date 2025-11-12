## 🌟 B-Komachi-AI-worker

A sophisticated Telegram bot Vocabulary Assistant deployed on Cloudflare Worker.

OpenAI/AzureOpenAI/Gemini Pro + EdgeTTS 🗣️

https://github.com/yuchanns/b-komachi-ai-worker/assets/25029451/7f882226-49a0-4a00-b8b0-447a7f88cf6c

### 🚀 Features

- [x] 📚 Vocabulary
- [x] 🎧 Pronunciation
- [x] 💻 Stream Output
- [x] 🤖 Multiple AI support(Azure OpenAI, Gemini Pro...)
- [x] 📝 Daily quizzes based on user-specific vocabulary.
- [x] 💡 Help command and daily usage tips
- [x] 🔄 Per-user AI model selection
- [ ] 👂 Review mode for listening to speech and selecting the answer.
- [ ] 🌎 Support for learning multiple languages.
- [ ] 🤔 Identify unfamiliar words within sentences.
- [ ] 🧠 Efficient retention through grouping common words.
- [ ] 🔮 More features coming soon...

## 📖 Usage

### Help Command

Get a quick overview of available commands and features:

```
/help
```

**Daily Tips**: The bot will automatically show usage tips on your first interaction each day to help you get the most out of its features.

### Switch AI Model

View available AI models and switch between them:

```
/model
```

This will show you:

- Your current AI model
- All available models based on your configuration
- How to switch to a different model

To switch to a specific model:

```
/model <backend>
```

For example:

- `/model gemini` - Switch to Google Gemini
- `/model openai` - Switch to OpenAI
- `/model azure` - Switch to Azure OpenAI

**Note**: You can configure multiple AI backends and let each user choose their preferred one. The bot remembers your choice for future interactions.

### Vocabulary Lookup

Mention the bot in a group or private chat with a word or phrase:

```
@your_bot_name sophisticated
```

The bot will:

- Analyze the word/phrase
- Provide pronunciation (IPA)
- Show meanings, examples, etymology, derivatives, synonyms, and related words
- Send voice pronunciation
- Automatically store the word in your vocabulary history

### Daily Quiz

Start a quiz based on your vocabulary history:

```
/quiz
```

The bot will:

- Generate multiple-choice questions from your vocabulary words
- Present each question with 4 answer options as interactive buttons
- Provide instant feedback on correct/incorrect answers
- Show your final score after completing all questions

Note: You need to query at least a few words before using the quiz feature.

## 🛠️ Deploy

Users must provide the following environment variables within GitHub's Secrets - go to "Settings -> Secrets":

| Name                  | Description                                                                                      | Example                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| CLOUDFLARE_ACOUNT_ID  | [Documentation](https://developers.cloudflare.com/fundamentals/setup/find-account-and-zone-ids/) |                                                                   |
| CLOUDFLARE_API_TOKEN  | [Documentation](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)    |                                                                   |
| ENV_AZURE_URL         | Azure OpenAI Deployment Endpoint                                                                 | https://yuchanns-openai.openai.azure.com/openai/deployments/gpt35 |
| ENV_AZURE_API_KEY     | Azure OpenAI API Key                                                                             |                                                                   |
| ENV_AZURE_API_VERSION | Azure OpenAI API Version                                                                         | 2023-09-01-preview                                                |
| ENV_BOT_SECRET        | Telegram Bot Verification Secret, Random Generate From `A-Z, a-z, 0-9, _ and -`                  |                                                                   |
| ENV_BOT_TOKEN         | Telegram Bot Token                                                                               |                                                                   |
| ENV_GEMINI_API_KEY    | Google Gemini API Key                                                                            |                                                                   |
| ENV_GEMINI_MODEL      | Optional Gemini Model                                                                            | gemini-1.5-flash (default), gemini-2.0-flash-exp                  |
| ENV_OPENAI_API_KEY    | OpenAI API Key                                                                                   |                                                                   |
| ENV_OPENAI_URL        | Optional OpenAI Base URL                                                                         | https://api.openai.com                                            |
| ENV_OPENAI_MODEL      | Optional OpenAI Model                                                                            | gpt-3.5-turbo                                                     |
| ENV_AI_BACKEND        | Specify Which AI Backend To Use                                                                  | Optional: `Azure`, `Gemini`, `OpenAI`                             |

### D1 Database Setup

Before deploying, create a D1 database for vocabulary storage:

1. Create D1 database via Cloudflare dashboard or CLI:

    ```bash
    wrangler d1 create b-komachi-vocabulary
    ```

2. Update `wrangler.toml` with your D1 database ID:

    ```toml
    [[d1_databases]]
    binding = "DB"
    database_name = "b-komachi-vocabulary"
    database_id = "your-database-id"
    ```

3. Initialize the database schema:

    ```bash
    wrangler d1 execute b-komachi-vocabulary --remote --file=schema.sql
    ```

    **Note**: This command is safe to run multiple times. It will create tables and indexes if they don't exist. For fresh installations, all tables will be created with the current schema.

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
