import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

export interface JsonSchema {
  type: 'object' | 'string' | 'array' | 'number' | 'integer' | 'boolean' | 'null';
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: string[];
  required?: string[];
}

/**
 * Thin wrapper around the Claude SDK. Every call in the reasoning pipeline that needs
 * the LLM goes through `generateJson`, which forces a structured JSON response via a
 * single forced tool call whose schema is the desired shape — so the pipeline can parse
 * and validate the output as data, not "vibes".
 */
@Injectable()
export class ClaudeService {
  private readonly logger = new Logger(ClaudeService.name);
  private readonly client: Anthropic;
  private readonly modelName: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        'Missing Anthropic API key. Set ANTHROPIC_API_KEY in your environment/.env file.',
      );
    }
    this.modelName = process.env.CLAUDE_MODEL ?? 'claude-haiku-4-5';
    this.client = new Anthropic({ apiKey });
  }

  async generateText(params: {
    systemInstruction: string;
    prompt: string;
    temperature?: number;
  }): Promise<string> {
    this.logger.debug(`Calling Claude text (${this.modelName})`);
    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 1024,
      temperature: params.temperature ?? 0.7,
      system: params.systemInstruction,
      messages: [{ role: 'user', content: params.prompt }],
    });
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );
    return textBlock?.text ?? '';
  }

  async generateJson<T>(params: {
    systemInstruction: string;
    prompt: string;
    schema: JsonSchema;
    temperature?: number;
  }): Promise<T> {
    this.logger.debug(`Calling Claude (${this.modelName})`);
    const response = await this.client.messages.create({
      model: this.modelName,
      max_tokens: 4096,
      temperature: params.temperature ?? 0.4,
      system: params.systemInstruction,
      messages: [{ role: 'user', content: params.prompt }],
      tools: [
        {
          name: 'submit_response',
          description: 'Submit the final structured response.',
          input_schema: params.schema as unknown as Anthropic.Tool.InputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: 'submit_response' },
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
    );

    if (!toolUse) {
      throw new Error(
        `Claude did not return a tool_use block for schema-constrained call: ${JSON.stringify(response.content)}`,
      );
    }

    return toolUse.input as T;
  }
}
