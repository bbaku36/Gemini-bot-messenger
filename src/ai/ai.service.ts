import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly chatModel: ChatGoogleGenerativeAI;

  constructor(private configService: ConfigService) {
    this.chatModel = new ChatGoogleGenerativeAI({
      apiKey: this.configService.get<string>('GOOGLE_API_KEY'),
      temperature: 0.2,
      model: 'gemini-2.5-flash',
      maxOutputTokens: 1000,
      streaming: false,
      callbacks: [
        {
          handleLLMError: (error) => {
            this.logger.error('LLM Error:', {
              message: error.message,
              name: error.name,
              stack: error.stack,
            });
          },
          handleLLMEnd: (output) => {
            this.logger.debug('LLM Response:', {
              usage: output.llmOutput?.tokenUsage,
            });
          },
        },
      ],
      maxRetries: 3,
    });
  }

  private formatProductsList(
    products: Array<{
      name: string;
      price: number;
      description?: string | null;
      instruction?: string | null;
    }>,
  ): string {
    if (!products.length) return 'Одоогоор бүтээгдэхүүний жагсаалт хоосон байна.';
    return products
      .map(
        (p, i) =>
          `${i + 1}. ${p.name}\n- Үнэ: ${p.price}₮` +
          `${p.description ? `\n- ${p.description}` : ''}` +
          `${p.instruction ? `\n- Заавар: ${p.instruction}` : ''}`,
      )
      .join('\n\n');
  }

  private extractKeywords(text: string): string[] {
    if (!text) return [];
    const lowered = text
      .toLowerCase()
      .replace(/[\p{P}\p{S}]/gu, ' ') // remove punctuation/symbols
      .replace(/\s+/g, ' ')
      .trim();
    const stop = new Set([
      'сайн', 'байна', 'уу', 'юу', 'вэ', 'та', 'танайд', 'танай', 'хэн', 'ямар', 'яаж', 'хэн', 'энэ', 'тэр', 'би', 'тави', 'бол', 'болов', 'болох', 'хан', 'мэдээ', 'хэрэгтэй', 'сонирхож', 'асууя', 'арта', 'гээд', 'гэхэд', 'гэж', 'л', 'ч', 'бас', 'ба', 'энд', 'тэгвэл', 'хариу', 'утга', 'ах', 'огоо', 'байгаа', 'байх', 'одоогоор', 'чинас', 'ни', 'миний', 'манай', 'бэлэн',
    ]);
    return lowered
      .split(' ')
      .map((t) => t.trim())
      .filter((t) => t && t.length >= 2 && !stop.has(t))
      .slice(0, 5);
  }

  async generateResponse(userMessage: string): Promise<string> {
    try {
      const allProducts = await prisma.product.findMany({ orderBy: { createdAt: 'asc' } });
      if (!allProducts.length) {
        return 'Одоогоор манайд бүтээгдэхүүн байхгүй байна.';
      }

      const keywords = this.extractKeywords(userMessage);
      let matched = allProducts;
      if (keywords.length) {
        matched = await prisma.product.findMany({
          where: {
            OR: keywords.map((k) => ({
              OR: [
                { name: { contains: k, mode: 'insensitive' } },
                { description: { contains: k, mode: 'insensitive' } },
                { instruction: { contains: k, mode: 'insensitive' } },
              ],
            })),
          },
          orderBy: { createdAt: 'asc' },
        });
      }

      const matchedList = this.formatProductsList(matched);
      const allList = this.formatProductsList(allProducts);

      const scope = `Зөвхөн дараах каталогийн талаар ярь. Хэрэв хэрэглэгчийн хүссэн бараа тохирохгүй бол \"одоогоор байхгүй\" гэж хэлээд каталогоос ойролцоо/хамааралтайг санал болго. Каталог:
---
${allList}
---`;

      const guidance = `Хариултаа энгийн, найрсаг, товч өг. Бусад сэдвээр зөвлөмж бүү өг. Хэрэв хэрэглэгч захиалахад бэлэн бол утасны дугаар, хүргэх хаягийг хамтад нь асуу. Хэрэв нэгийг нь өгвөл үлдсэнийг нь л асуу.`;

      // If keywords provided and nothing matched, handle directly without LLM
      if (keywords.length && matched.length === 0) {
        return `Таны хайсан бараа одоогоор байхгүй байна. Манайд бэлэн байгаа бүтээгдэхүүнүүд:\n\n${allList}`;
      }

      const response = await this.chatModel.invoke([
        new SystemMessage(`${scope}\n\n${guidance}`),
        new HumanMessage(`Хэрэглэгчийн асуулт: ${userMessage}\n\nХамаатай бүтээгдэхүүний жагсаалт:\n${matchedList}`),
      ]);

      return response.content.toString();
    } catch (error: any) {
      this.logger.error(`AI хариу үүсгэхэд алдаа гарлаа: ${error.message}`);
      throw error;
    }
  }
}
