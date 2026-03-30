import { ChatOpenAI } from '@langchain/openai';
import * as dotenv from 'dotenv';
dotenv.config();

async function test() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    console.log("Key length:", apiKey?.length);

    try {
        const llm = new ChatOpenAI({
            modelName: 'nvidia/nemotron-3-super-120b-a12b:free',
            openAIApiKey: apiKey,
            temperature: 0,
            configuration: {
                baseURL: "https://openrouter.ai/api/v1",
                defaultHeaders: {
                    "HTTP-Referer": "https://distroai.in",
                    "X-Title": "DistroAI",
                }
            }
        });

        const res = await llm.invoke("Hello, who are you?");
        console.log("SUCCESS:", res.content);
    } catch (err: any) {
        console.error("ERROR openAIApiKey:", err.message);
    }

    try {
        const llm2 = new ChatOpenAI({
            modelName: 'nvidia/nemotron-3-super-120b-a12b:free',
            apiKey: apiKey,
            temperature: 0,
            configuration: {
                baseURL: "https://openrouter.ai/api/v1",
                defaultHeaders: {
                    "HTTP-Referer": "https://distroai.in",
                    "X-Title": "DistroAI",
                }
            }
        });

        const res2 = await llm2.invoke("Hello, who are you?");
        console.log("SUCCESS:", res2.content);
    } catch (err: any) {
        console.error("ERROR apiKey:", err.message);
    }
}

test();
