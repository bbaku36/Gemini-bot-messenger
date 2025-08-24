import { Controller, Get, Post, Body, Query, Logger } from '@nestjs/common';
import { MessengerService } from './messenger.service';
import { ConfigService } from '@nestjs/config';

@Controller('webhook')
export class MessengerController {
  private readonly logger = new Logger(MessengerController.name);

  constructor(
    private readonly messengerService: MessengerService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const verifyToken = this.configService.get<string>('FACEBOOK_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === verifyToken) {
      return challenge;
    }
    throw new Error('Invalid verification token');
  }

  @Post()
  async handleWebhook(@Body() body: any): Promise<void> {
    if (body.object === 'page') {
      for (const entry of body.entry) {
        for (const event of entry.messaging) {
          if (event.message && event.message.text) {
            await this.messengerService.handleMessage(
              event.sender.id,
              event.message.text,
            );
          }
        }
      }
    }
  }
}
