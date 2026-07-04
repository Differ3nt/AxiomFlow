import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ClaudeService } from '../llm/claude.service';

export class ChatMessageDto {
  message: string;
  context?: string;
}

@ApiTags('Chat')
@Controller('chat')
export class ChatController {
  constructor(private readonly claude: ClaudeService) {}

  @Post()
  @ApiOperation({ summary: 'Send a message to the R&D assistant' })
  async chat(@Body() body: ChatMessageDto): Promise<{ reply: string }> {
    const system = [
      'You are an R&D assistant embedded in AxiomFlow, an engineering problem-solving tool that uses TRIZ methodology and physics-based analysis.',
      'You help engineers understand, critique, and refine investigation results. Be concise and technical.',
      body.context ? `\nCurrent investigation context:\n${body.context}` : '',
    ].join('');

    const reply = await this.claude.generateText({
      systemInstruction: system,
      prompt: body.message,
      temperature: 0.7,
    });

    return { reply };
  }
}
