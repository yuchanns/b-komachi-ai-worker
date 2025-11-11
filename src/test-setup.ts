import { beforeAll } from 'vitest';

// Mock environment variables for tests
beforeAll(() => {
	process.env.ENV_BOT_TOKEN = process.env.ENV_BOT_TOKEN || 'test-bot-token';
	process.env.ENV_BOT_SECRET = process.env.ENV_BOT_SECRET || 'test-secret';
	process.env.ENV_AZURE_URL = process.env.ENV_AZURE_URL || 'https://test.openai.azure.com';
	process.env.ENV_AZURE_API_KEY = process.env.ENV_AZURE_API_KEY || 'test-key';
	process.env.ENV_AZURE_API_VERSION = process.env.ENV_AZURE_API_VERSION || '2023-09-01-preview';
	process.env.ENV_GEMINI_API_KEY = process.env.ENV_GEMINI_API_KEY || 'test-gemini-key';
	process.env.ENV_OPENAI_URL = process.env.ENV_OPENAI_URL || 'https://api.openai.com';
	process.env.ENV_OPENAI_API_KEY = process.env.ENV_OPENAI_API_KEY || 'test-openai-key';
	process.env.ENV_OPENAI_MODEL = process.env.ENV_OPENAI_MODEL || 'gpt-3.5-turbo';
	process.env.ENV_AI_BACKEND = process.env.ENV_AI_BACKEND || 'azure';
});
