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

  constructor(
    private configService: ConfigService,
    private aiService: AiService,
  ) {
    this.pageAccessToken = this.configService.get<string>(
      'FACEBOOK_PAGE_ACCESS_TOKEN',
    );
  }

  async handleMessage(senderId: string, message: string): Promise<void> {
    try {
      this.logger.log(`Incoming message from ${senderId}: ${message}`);

      // 1. Хэрэглэгчийг DB-д шалгаад үүсгэх
      let user = await prisma.user.findUnique({ where: { id: senderId } });
      if (!user) {
        user = await prisma.user.create({
          data: { id: senderId, name: null },
        });
        this.logger.log(`New user created: ${senderId}`);
      }

      // 2. Хэрэглэгчийн ирүүлсэн текстийг DB-д хадгалах
      await prisma.message.create({
        data: {
          userId: user.id,
          text: message,
        },
      });
      this.logger.log(`Message stored for user: ${senderId}`);

      // 3. AI-аас хариу авах (DB дотор хадгалсан текстээс)
      const aiResponse = await this.aiService.generateResponse(message);

      // 4. Messenger рүү буцааж илгээх
      await this.sendMessage(senderId, aiResponse);
    } catch (error: any) {
      this.logger.error(`Error handling message: ${error.message}`);
      throw error;
    }
  }

  private async sendMessage(
    recipientId: string,
    message: string,
  ): Promise<void> {
    const url = `https://graph.facebook.com/v21.0/me/messages`;

    try {
      await axios.post(
        url,
        {
          recipient: { id: recipientId },
          message: { text: message },
        },
        {
          params: { access_token: this.pageAccessToken },
        },
      );
      this.logger.log(`Message sent to ${recipientId}: ${message}`);
    } catch (error: any) {
      this.logger.error(`Error sending message: ${error.message}`);
      throw error;
    }
  }
}
