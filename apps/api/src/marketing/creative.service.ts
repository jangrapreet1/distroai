import { Injectable, Logger } from '@nestjs/common';

/**
 * Creative Studio — generates ad copy combinations using OpenRouter (Claude).
 * NO LangChain. Raw fetch to OpenRouter's OpenAI-compatible endpoint.
 */
@Injectable()
export class CreativeService {
    private readonly logger = new Logger(CreativeService.name);

    async generateAdCreatives(product: {
        name: string;
        mrp: number | null;
        category: string | null;
        brand: string | null;
        description: string | null;
    }, context: {
        city: string;
        userType: 'B2B' | 'B2C';
        language?: string;
    }) {
        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            throw new Error('OPENROUTER_API_KEY is not set. Cannot generate ad creatives.');
        }

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': 'https://distroai.in',
                'X-Title': 'DistroAI Creative Studio',
            },
            body: JSON.stringify({
                model: 'anthropic/claude-3.5-sonnet',
                max_tokens: 1000,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert ad copywriter for Indian FMCG markets. Always respond with pure valid JSON only — no markdown, no backticks, no preamble.',
                    },
                    {
                        role: 'user',
                        content: `Product: ${product.name}, MRP: ₹${product.mrp ?? 'N/A'}, Category: ${product.category ?? 'General'}, Brand: ${product.brand ?? 'N/A'}
Description: ${product.description ?? 'No description'}
Distributor city: ${context.city}
Ad type: ${context.userType === 'B2B' ? 'Wholesale targeting local shop owners' : 'Retail targeting neighborhood consumers'}
Generate 3 ad copy combinations in ${context.language || 'English'}.

Return ONLY this JSON structure:
{
  "combinations": [
    { "headline": "...", "body": "...", "cta": "..." },
    { "headline": "...", "body": "...", "cta": "..." },
    { "headline": "...", "body": "...", "cta": "..." }
  ]
}`,
                    },
                ],
            }),
        });

        if (!response.ok) {
            const errBody = await response.text();
            this.logger.error(`OpenRouter API error: ${response.status} — ${errBody}`);
            throw new Error(`Creative Studio API call failed: ${response.status}`);
        }

        const data: any = await response.json();

        // OpenRouter uses OpenAI-compatible response format
        const text = data.choices?.[0]?.message?.content;
        if (!text) {
            throw new Error('Creative Studio: Empty response from LLM');
        }

        try {
            return JSON.parse(text);
        } catch {
            this.logger.error(`Creative Studio: LLM returned non-JSON response: ${text}`);
            throw new Error(`Creative Studio: LLM returned non-JSON response`);
        }
    }
}
