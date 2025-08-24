import { Body, Controller, Post } from '@nestjs/common';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('generate')
  generateResponse(@Body() body: { message: string }) {
    return this.aiService.generateResponse(body.message);
  }
}
