import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Logger,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
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
    @Res() res: Response,
  ) {
    const verifyToken = this.configService.get<string>('FACEBOOK_VERIFY_TOKEN');

    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Webhook verified successfully!');
      return res.status(HttpStatus.OK).send(challenge); // ✅ зөв: raw challenge text буцаана
    }

    this.logger.warn('Invalid verification token received!');
    return res.sendStatus(HttpStatus.FORBIDDEN);
  }

  @Post()
  async handleWebhook(@Body() body: any, @Res() res: Response) {
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
      return res.status(HttpStatus.OK).send('EVENT_RECEIVED');
    }

    return res.sendStatus(HttpStatus.NOT_FOUND);
  }
}
