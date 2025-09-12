import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly chatModel: ChatGoogleGenerativeAI;
  private trgmAvailable?: boolean;

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
    const raw = text
      .toLowerCase()
      .replace(/[\p{P}\p{S}]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const stop = new Set([
      'сайн', 'байна', 'уу', 'юу', 'вэ', 'та', 'танайд', 'танай', 'хэн', 'ямар', 'яаж', 'энэ', 'тэр', 'би', 'бол', 'болов', 'байгаа', 'байх', 'одоогоор', 'миний', 'манай', 'бэлэн', 'асууя', 'сонирхож', 'хэрэгтэй', 'хариу'
    ]);
    return Array.from(new Set(
      raw
        .split(' ')
        .map((t) => t.trim())
        .filter((t) => t && t.length >= 2 && !stop.has(t))
        .slice(0, 8),
    ));
  }

  private async hasPgTrgm(): Promise<boolean> {
    if (this.trgmAvailable !== undefined) return this.trgmAvailable;
    try {
      const rows = await prisma.$queryRaw<Array<{ extname: string }>>(
        Prisma.sql`SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'`
      );
      this.trgmAvailable = rows.length > 0;
    } catch {
      this.trgmAvailable = false;
    }
    return this.trgmAvailable;
  }

  async generateResponse(userMessage: string): Promise<string> {
    try {
      const allAvailable = await prisma.product.findMany({ where: { inStock: true }, orderBy: { createdAt: 'asc' } });
      if (!allAvailable.length) {
        return 'Одоогоор манайд бүтээгдэхүүн байхгүй байна.';
      }

      const keywords = this.extractKeywords(userMessage);
      let matched = allAvailable;
      let matchedAny: typeof matched | null = null;
      if (keywords.length) {
        const useTrgm = await this.hasPgTrgm();
        if (useTrgm) {
          // 1) Fuzzy via similarity() (pg_trgm)
          const orClausesIn = keywords.map((k) =>
            Prisma.sql`(similarity(p."name", ${k}) > 0.2 OR similarity(p."description", ${k}) > 0.2 OR similarity(p."instruction", ${k}) > 0.2)`,
          );
          if (orClausesIn.length) {
            const whereIn = Prisma.join(orClausesIn, ' OR ');
            const rowsIn = await prisma.$queryRaw<Array<{ name: string; price: number; description: string | null; instruction: string | null }>>(
              Prisma.sql`
                SELECT p."name", p."price", p."description", p."instruction"
                FROM "public"."Product" p
                WHERE p."inStock" = true AND (${whereIn})
                ORDER BY p."createdAt" ASC
                LIMIT ${10}
              `,
            );
            if (rowsIn.length) matched = rowsIn as any;
          }

          const orClausesAny = keywords.map((k) =>
            Prisma.sql`(similarity(p."name", ${k}) > 0.2 OR similarity(p."description", ${k}) > 0.2 OR similarity(p."instruction", ${k}) > 0.2)`,
          );
          if (orClausesAny.length) {
            const whereAny = Prisma.join(orClausesAny, ' OR ');
            const rowsAny = await prisma.$queryRaw<Array<{ name: string; price: number; description: string | null; instruction: string | null; inStock: boolean }>>(
              Prisma.sql`
                SELECT p."name", p."price", p."description", p."instruction", p."inStock"
                FROM "public"."Product" p
                WHERE (${whereAny})
                ORDER BY p."createdAt" ASC
                LIMIT ${10}
              `,
            );
            matchedAny = rowsAny as any;
          }
        } else {
          // Fallback: ILIKE contains search (build flat OR list)
          const orIn = keywords.flatMap((k) => [
            { name: { contains: k, mode: 'insensitive' as const } },
            { description: { contains: k, mode: 'insensitive' as const } },
            { instruction: { contains: k, mode: 'insensitive' as const } },
          ]);
          matched = await prisma.product.findMany({
            where: { inStock: true, OR: orIn },
            orderBy: { createdAt: 'asc' },
          });

          const orAny = keywords.flatMap((k) => [
            { name: { contains: k, mode: 'insensitive' as const } },
            { description: { contains: k, mode: 'insensitive' as const } },
            { instruction: { contains: k, mode: 'insensitive' as const } },
          ]);
          matchedAny = await prisma.product.findMany({
            where: { OR: orAny },
            orderBy: { createdAt: 'asc' },
          });
        }
      }

      const matchedList = this.formatProductsList(matched);
      const allList = this.formatProductsList(allAvailable);
      const scope = `Та Tutuyu online дэлгүүрийн туслах. Богино, ойлгомжтой, эелдэг хариул. Бүтээгдэхүүний талаарх хамгийн хамаатай мэдээллийг л өг; тохирохгүй бол байхгүйг хэлээд ойролцоо/санал болго.`;

      const guidance = `Хариултаа товч, ойлгомжтой, найрсаг өг.`;

      // Хатуу буцаалт хийхгүй; AI өөрөө найрсаг, товч хариулт бүрдүүлнэ

      const response = await this.chatModel.invoke([
        new SystemMessage(`${scope}\n\n${guidance}`),
        new HumanMessage(
          `Асуулт: ${userMessage}\n\nТаарч буй бараа (бэлэн):\n${matchedList}\n\nБусад бэлэн бараа (санал болгоход):\n${allList}`,
        ),
      ]);

      return response.content.toString();
    } catch (error: any) {
      this.logger.error(`AI хариу үүсгэхэд алдаа гарлаа: ${error.message}`);
      throw error;
    }
  }
}
