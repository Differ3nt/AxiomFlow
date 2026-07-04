import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI, Schema, SchemaType } from '@google/generative-ai';

export interface JsonSchema {
  type: SchemaType;
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: string[];
  required?: string[];
}

/**
 * Thin wrapper around the Gemini SDK. Every call in the reasoning pipeline that needs
 * the LLM goes through `generateJson`, which forces a structured JSON response against
 * an explicit schema instead of free-form prose — so the pipeline can parse and validate
 * the output as data, not "vibes".
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly client: GoogleGenerativeAI;
  private readonly modelName: string;

  constructor() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Missing Gemini API key. Set GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY) in your environment/.env file.',
      );
    }
    this.modelName = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateJson<T>(params: {
    systemInstruction: string;
    prompt: string;
    schema: JsonSchema;
    temperature?: number;
  }): Promise<T> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: params.systemInstruction,
      generationConfig: {
        temperature: params.temperature ?? 0.4,
        responseMimeType: 'application/json',
        responseSchema: params.schema as unknown as Schema,
      },
    });

    this.logger.debug(`Calling Gemini (${this.modelName})`);
    const result = await model.generateContent(params.prompt);
    const text = result.response.text();

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new Error(`Gemini returned invalid JSON for schema-constrained call: ${text}\n${error}`);
    }
  }
}
