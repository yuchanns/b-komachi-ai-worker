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
- [x] 🌍 Multi-language support (Chinese & English)
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

### Switch Language

Change the bot interface language between Chinese and English:

```
/lang
```

This will show you:

- Your current language
- All available languages
- How to switch to a different language

To switch to a specific language:

```
/lang <code>
```

For example:

- `/lang zh-CN` - Switch to Chinese (中文)
- `/lang en` - Switch to English

**Auto-Detection**: On your first interaction, the bot will automatically detect your language from your Telegram client settings and set it as your preference. Supported Telegram language codes include:
- English: `en`
- Chinese (Simplified): `zh`, `zh-hans`, `zh-cn`
- Chinese (Traditional): `zh-hant`, `zh-tw`, `zh-hk` (mapped to Simplified Chinese)

**Note**: The bot remembers your language preference for future interactions. You can manually change it anytime using the `/lang` command.

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

    **For fresh installations:**

    ```bash
    wrangler d1 execute b-komachi-vocabulary --remote --file=schema.sql
    ```

    **For existing users upgrading from older versions:**

    If you already have a database from a previous version, run the migrations to add new tables/columns:

    ```bash
    # Migration 001: Add user_interactions and user_preferences tables
    wrangler d1 execute b-komachi-vocabulary --remote --file=migrations/001_add_user_interactions_and_preferences.sql

    # Migration 002: Add language column to user_preferences table
    wrangler d1 execute b-komachi-vocabulary --remote --file=migrations/002_add_language_preference.sql
    ```

    Migration 001 adds:
    - `user_interactions` table for daily tips feature
    - `user_preferences` table for per-user AI model selection

    Migration 002 adds:
    - `language` column to `user_preferences` table for i18n support

    **Note**: All migrations are safe to run multiple times. They use `IF NOT EXISTS` or `ALTER TABLE ADD COLUMN` which will fail gracefully if the schema already exists.

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

### 🌍 i18n (Internationalization)

The bot supports multiple languages with a flexible i18n system inspired by the [deepfuture](https://github.com/cloudwu/deepfuture) project.

**Supported Languages:**

- Chinese (Simplified) - `zh-CN` (Default)
- English - `en`

**Architecture:**

- Locale files are stored in `locales/` directory as JSON files
- The i18n module (`src/lib/i18n.ts`) provides translation functions
- User language preferences are stored in the database
- Each user can choose their preferred language using `/lang <code>`
- **Auto-detection**: On first interaction, the bot detects language from Telegram's `language_code` field and automatically saves it as the user's preference

**Language Auto-Detection:**

The bot uses Telegram's `language_code` field (from the User object) to automatically detect and set the user's preferred language on their first interaction. The detection mapping:

- `en` → English (`en`)
- `zh`, `zh-hans`, `zh-cn` → Chinese Simplified (`zh-CN`)
- `zh-hant`, `zh-tw`, `zh-hk` → Chinese Simplified (`zh-CN`)
- Other codes → Default to Chinese (`zh-CN`)

Once detected and saved, the preference persists until the user manually changes it with `/lang`.

**Adding a New Language:**

1. Create a new locale file in `locales/` (e.g., `locales/ja.json` for Japanese)
2. Copy the structure from `locales/en.json` and translate all strings
3. Update `src/lib/i18n.ts` to include the new locale:

    ```typescript
    import ja from "../../locales/ja.json"

    const locales: Record<Locale, LocaleData> = {
        "zh-CN": zhCN,
        en: en,
        ja: ja, // Add new locale
    }
    ```

4. Update the `Locale` type to include the new language code
5. Update the `detectLocaleFromTelegram()` function to map Telegram language codes to your new locale
6. Update the help messages to include the new language option

**Translation Keys:**

- Use dot notation for nested keys (e.g., `i18n.t("help.title")`)
- Support placeholder interpolation with `{key}` format (e.g., `i18n.t("model.switched", { backend: "gemini" })`)
- Arrays in locale files are automatically joined with newlines

**Note**: AI prompts in `prompts.ts` are intentionally kept in their original language to maintain the quality of AI responses. They are designed to work with AI models that understand both English and Chinese.
