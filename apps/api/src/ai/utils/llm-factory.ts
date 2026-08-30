import { ChatOpenAI } from '@langchain/openai';

export function createOpenRouterLLM(model: string, options?: { temperature?: number }): ChatOpenAI {
    return new ChatOpenAI({
        modelName: model,
        temperature: options?.temperature ?? 0,
        configuration: {
            apiKey: process.env.OPENROUTER_API_KEY,
            baseURL: "https://openrouter.ai/api/v1",
            defaultHeaders: {
                "HTTP-Referer": "https://distroai.in",
                "X-Title": "DistroAI",
            }
        }
    });
}
