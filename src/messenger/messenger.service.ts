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
  private readonly pageId?: string;
  private orderedLabelId?: string;
  private followUpLabelId?: string;

  constructor(
    private configService: ConfigService,
    private aiService: AiService,
  ) {
    this.pageAccessToken = this.configService.get<string>('FACEBOOK_PAGE_ACCESS_TOKEN');
    const sendFlag = this.configService.get<string>('FACEBOOK_SEND_ENABLED');
    this.sendEnabled = sendFlag ? sendFlag.toLowerCase() === 'true' : true;
    this.pageId = this.configService.get<string>('FACEBOOK_PAGE_ID');
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

      // Store incoming message
      await prisma.message.create({ data: { userId: user.id, text: message } });

      // Extract phone/address hints from message
      const phone = this.extractPhone(message);
      const address = this.extractAddress(message);

      // Find latest pending order or create new
      let order = await prisma.order.findFirst({
        where: { userId: user.id, status: 'pending' },
        orderBy: { createdAt: 'desc' },
      });

      if (order) {
        const updates: any = {};
        if (phone && !order.contactPhone) updates.contactPhone = phone;
        if (address && !order.address) updates.address = address;
        if (Object.keys(updates).length) {
          const nowReady = (updates.contactPhone || order.contactPhone) && (updates.address || order.address);
          order = await prisma.order.update({
            where: { id: order.id },
            data: { ...updates, ...(nowReady ? { status: 'ready' } : {}) },
          });
          if (nowReady) await this.tagUserWithLabels(senderId, ['ordered', 'follow_up']);
        }
      } else {
        order = await prisma.order.create({
          data: {
            userId: user.id,
            message,
            status: phone && address ? 'ready' : 'pending',
            contactPhone: phone || null,
            address: address || null,
          },
        });
        if (order.status === 'ready') await this.tagUserWithLabels(senderId, ['ordered', 'follow_up']);
      }

      // Ask AI for a response (free but product-focused)
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

  // Extract Mongolian phone numbers; tolerates +976 and separators
  private extractPhone(text: string): string | null {
    if (!text) return null;
    const re = /(\+?976)?[\s\-]?(\d{2})[\s\-]?(\d{2})[\s\-]?(\d{4})|(?:\+?976)?[\s\-]?(\d{8})/i;
    const match = re.exec(text);
    if (!match) return null;
    const digits = (match[0] || '').replace(/\D/g, '');
    const last8 = digits.slice(-8);
    return last8.length === 8 ? last8 : null;
  }

  // Heuristic: text containing 'хаяг' or 'address'
  private extractAddress(text: string): string | null {
    if (!text) return null;
    const lower = text.toLowerCase();
    const keys = ['хаяг', 'hayag', 'address'];
    for (const k of keys) {
      const idx = lower.indexOf(k);
      if (idx >= 0) {
        const part = text.slice(idx + k.length).replace(/^\s*[:：,-]?\s*/, '');
        if (part && part.length > 3) return part.trim();
      }
    }
    return null;
  }

  // ===== Facebook Page Labels API helpers =====
  private async ensureLabelId(name: 'ordered' | 'follow_up'): Promise<string | null> {
    if (!this.pageId) {
      this.logger.warn('FACEBOOK_PAGE_ID not set; skip labeling');
      return null;
    }
    try {
      if (name === 'ordered' && this.orderedLabelId) return this.orderedLabelId;
      if (name === 'follow_up' && this.followUpLabelId) return this.followUpLabelId;

      const listUrl = `https://graph.facebook.com/v21.0/${this.pageId}/labels`;
      const listRes = await axios.get(listUrl, { params: { access_token: this.pageAccessToken, limit: 200 } });
      const found = (listRes.data?.data || []).find((l: any) => (l.name || '').toLowerCase() === name.toLowerCase());
      let id: string;
      if (found) {
        id = found.id;
      } else {
        const createRes = await axios.post(listUrl, { name }, { params: { access_token: this.pageAccessToken } });
        id = createRes.data?.id;
      }
      if (name === 'ordered') this.orderedLabelId = id;
      if (name === 'follow_up') this.followUpLabelId = id;
      return id;
    } catch (error: any) {
      this.logger.error(`Failed to ensure label '${name}': ${error.message} ${error?.response ? JSON.stringify(error.response.data) : ''}`);
      return null;
    }
  }

  private async addLabelToUser(labelId: string, psid: string): Promise<void> {
    try {
      const url = `https://graph.facebook.com/v21.0/${labelId}/label`;
      await axios.post(url, { user: psid }, { params: { access_token: this.pageAccessToken } });
    } catch (error: any) {
      this.logger.error(`Failed to label user ${psid} with ${labelId}: ${error.message} ${error?.response ? JSON.stringify(error.response.data) : ''}`);
    }
  }

  private async tagUserWithLabels(psid: string, names: Array<'ordered' | 'follow_up'>): Promise<void> {
    for (const name of names) {
      const id = await this.ensureLabelId(name);
      if (id) await this.addLabelToUser(id, psid);
    }
  }
}
