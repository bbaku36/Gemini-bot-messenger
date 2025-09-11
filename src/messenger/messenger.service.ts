import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AiService } from '../ai/ai.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class MessengerService {
  private readonly logger = new Logger(MessengerService.name);
  private readonly pageAccessToken: string;
  private readonly sendEnabled: boolean;

  constructor(
    private configService: ConfigService,
    private aiService: AiService,
  ) {
    this.pageAccessToken = this.configService.get<string>('FACEBOOK_PAGE_ACCESS_TOKEN');
    const sendFlag = this.configService.get<string>('FACEBOOK_SEND_ENABLED');
    this.sendEnabled = sendFlag ? sendFlag.toLowerCase() === 'true' : true;
  }

  async handleMessage(senderId: string, message: string): Promise<void> {
    try {
      this.logger.log(`Incoming message from ${senderId}: ${message}`);

      // Ensure user exists
      let user = await prisma.user.findUnique({ where: { id: senderId } });
      if (!user) {
        user = await prisma.user.create({ data: { id: senderId, name: null } });
        this.logger.log(`New user created: ${senderId}`);
      }

      // Store message
      await prisma.message.create({ data: { userId: user.id, text: message } });

      // Get AI response
      const aiResponse = await this.aiService.generateResponse(message);

      // Send back to Messenger
      await this.sendMessage(senderId, aiResponse);
    } catch (error: any) {
      this.logger.error(`Error handling message: ${error.message}`);
      throw error;
    }
  }

  private async sendMessage(recipientId: string, message: string): Promise<void> {
    if (!this.sendEnabled) {
      this.logger.log(`Facebook send disabled. Would send to ${recipientId}: ${message}`);
      return;
    }

    const url = `https://graph.facebook.com/v21.0/me/messages`;
    try {
      await axios.post(
        url,
        { recipient: { id: recipientId }, message: { text: message } },
        { params: { access_token: this.pageAccessToken } },
      );
      this.logger.log(`Message sent to ${recipientId}: ${message}`);
    } catch (error: any) {
      const details = error?.response?.data || error?.toString?.();
      this.logger.error(`Error sending message: ${error.message} ${details ? `- ${JSON.stringify(details)}` : ''}`);
      throw error;
    }
  }
}
