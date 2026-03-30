const { ChatOpenAI } = require('@langchain/openai');
require('dotenv').config({ path: '../../.env' });

async function test() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    console.log("Using API Key:", apiKey ? apiKey.substring(0, 15) + "..." : "NONE");

    try {
        const llm = new ChatOpenAI({
            modelName: 'nvidia/nemotron-3-super-120b-a12b:free',
            temperature: 0,
            configuration: {
                apiKey: apiKey,
                baseURL: "https://openrouter.ai/api/v1",
                defaultHeaders: {
                    "HTTP-Referer": "https://distroai.in",
                    "X-Title": "DistroAI",
                }
            }
        });

        const res = await llm.invoke("Hello, who are you? Reply in one sentence.");
        console.log("SUCCESS:", res.content);
    } catch (err) {
        console.error("ERROR:", err.message);
    }
}

test();
