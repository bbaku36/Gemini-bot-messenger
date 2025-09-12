import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AiService } from '../ai/ai.service';
import { PrismaClient, Prisma } from '@prisma/client';

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

      // Store incoming message as 'user'
      await prisma.message.create({ data: { userId: user.id, text: message, role: 'user' } });

      // Extract phone/address hints from message
      const phone = this.extractPhone(message);
      const address = this.extractAddress(message);
      // Update user's default contact info if newly provided
      const userUpdates: any = {};
      if (phone && !user.contactPhone) userUpdates.contactPhone = phone;
      if (address && !user.address) userUpdates.address = address;
      if (Object.keys(userUpdates).length) {
        user = await prisma.user.update({ where: { id: user.id }, data: userUpdates });
      }

      // Find latest pending order or create new if last is ready
      let order = await prisma.order.findFirst({ where: { userId: user.id, status: 'pending' }, orderBy: { createdAt: 'desc' } });
      if (!order) {
        const prefill: any = { userId: user.id, message, status: 'pending', contactPhone: phone || user.contactPhone || null, address: address || user.address || null };
        order = await prisma.order.create({ data: prefill });
      }

      // Attach product items if message mentions any
      const addedItems = await this.addMentionedItems(order.id, message);
      if (addedItems > 0) this.logger.log(`Added ${addedItems} item(s) to order ${order.id}`);

      // Update contact info on order if provided now or from user defaults
      const updates: any = {};
      if (phone && !order.contactPhone) updates.contactPhone = phone;
      if (address && !order.address) updates.address = address;
      if (!updates.contactPhone && user.contactPhone && !order.contactPhone) updates.contactPhone = user.contactPhone;
      if (!updates.address && user.address && !order.address) updates.address = user.address;

      if (Object.keys(updates).length) {
        order = await prisma.order.update({ where: { id: order.id }, data: updates });
      }

      // Decide readiness: needs both contact and at least one item
      const itemCount = await this.countOrderItems(order.id);
      const hasContacts = !!(order.contactPhone && order.address);
      if (hasContacts && itemCount > 0 && order.status !== 'ready') {
        order = await prisma.order.update({ where: { id: order.id }, data: { status: 'ready' } });
        await this.tagUserWithLabels(senderId, ['ordered', 'follow_up']);
        await this.sendPaymentInstructions(senderId, order.address || undefined, order.contactPhone || undefined);
      }

      // Ask AI for a response with conversation history
      const aiResponse = await this.aiService.generateResponse(user.id, message);

      // Send back to Messenger
      await this.sendMessage(senderId, aiResponse);

      // Store AI response as 'bot'
      await prisma.message.create({ data: { userId: user.id, text: aiResponse, role: 'bot' } });
    } catch (error: any) {
      this.logger.error(`Error handling message: ${error.message}`);
      throw error;
    }
  }

  // Add products mentioned in the text to the order (simple name contains match)
  private async addMentionedItems(orderId: string, text: string): Promise<number> {
    const q = (text || '').toLowerCase();
    if (!q) return 0;
    const candidates = await prisma.product.findMany({ where: { inStock: true }, orderBy: { createdAt: 'asc' } });
    let added = 0;
    for (const p of candidates) {
      const name = (p.name || '').toLowerCase();
      if (!name) continue;
      if (q.includes(name)) {
        await prisma.orderItem.create({
          data: {
            orderId,
            productId: p.id,
            productName: p.name,
            unitPrice: p.price,
            quantity: this.extractQuantityNearName(q, name) ?? 1,
          },
        });
        added++;
      }
    }
    return added;
  }

  private extractQuantityNearName(text: string, name: string): number | null {
    // Look for patterns like "name x2", "2 ширхэг name", "name 2sh"
    const idx = text.indexOf(name);
    if (idx < 0) return null;
    const window = text.slice(Math.max(0, idx - 12), idx + name.length + 12);
    const m = window.match(/(?:x|×|ш|ширхэг)?\s*(\d{1,2})\s*(?:ш|ширхэг)?/i);
    const n = m ? parseInt(m[1], 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private async countOrderItems(orderId: string): Promise<number> {
    try {
      const anyClient: any = prisma as any;
      if (anyClient.orderItem?.count) {
        return await anyClient.orderItem.count({ where: { orderId } });
      }
      const rows = await prisma.$queryRaw<Array<{ c: number }>>(
        Prisma.sql`SELECT COUNT(*)::int AS c FROM "public"."OrderItem" WHERE "orderId" = ${orderId}`,
      );
      return rows?.[0]?.c ?? 0;
    } catch (e) {
      this.logger.warn(`OrderItem count fallback failed: ${(e as any)?.message || e}`);
      return 0;
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

  // ===== Payment instructions helpers =====
  private isCountryside(address?: string | null): boolean {
    if (!address) return false;
    const a = address.toLowerCase();
    if (/(орон нутаг|аймаг|сум|гээд|тоо|шуудан|карго)/.test(a)) return true;
    if (/(ulaanbaatar|улаанбаатар|уб)/.test(a)) return false;
    return false;
  }

  private buildPaymentMessage(address?: string, phone?: string): string {
    const shop = 'Tutuyu online дэлгүүр';
    const bank = 'Данс: 5031746069 Бат‑Итгэл (Хаанбанк)';
    const iban = 'IBAN: MN660005005031746069';
    const note = `Гүйлгээний утга: ${phone ? phone : 'утасны дугаар'}`;
    const isCountry = this.isCountryside(address);
    const policyCity = 'Улаанбаатар хот дотор: бараагаа хүлээн авсны дараа дээрх данс руу төлнө үү.';
    const policyCountry = 'Орон нутгийн хүргэлт: урьдчилан төлбөрөө дээрх данс руу шилжүүлнэ үү. Төлбөр баталгаажмагц илгээнэ.';
    const policy = isCountry ? policyCountry : policyCity;
    return [
      'Захиалга баталгаажлаа. Төлбөрийн мэдээлэл:',
      shop,
      bank,
      iban,
      note,
      policy,
    ].join('\n');
  }

  private async sendPaymentInstructions(recipientId: string, address?: string, phone?: string): Promise<void> {
    const text = this.buildPaymentMessage(address, phone);
    await this.sendMessage(recipientId, text);
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
