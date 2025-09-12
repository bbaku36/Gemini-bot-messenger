import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly chatModel: ChatGoogleGenerativeAI;
  private trgmAvailable?: boolean;
  private readonly MAX_HISTORY = 6;
  private readonly MAX_MATCHED = 6;
  private readonly MAX_SUGGEST = 3;
  private readonly MAX_DESC_CHARS = 110;

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
    limit = this.MAX_MATCHED,
  ): string {
    if (!products.length) return '';
    const take = products.slice(0, limit);
    const trim = (s?: string | null) =>
      s && s.length > this.MAX_DESC_CHARS ? `${s.slice(0, this.MAX_DESC_CHARS - 1)}…` : s || '';
    return take
      .map((p, i) => {
        const lines = [`${i + 1}. ${p.name}`, `- Үнэ: ${p.price}₮`];
        const d = trim(p.description);
        if (d) lines.push(`- ${d}`);
        const ins = trim(p.instruction);
        if (ins) lines.push(`- Заавар: ${ins}`);
        return lines.join('\n');
      })
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

  async generateResponse(userId: string, userMessage: string): Promise<string> {
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

      const matchedList = this.formatProductsList(matched, this.MAX_MATCHED);
      const allList = matched.length ? '' : this.formatProductsList(allAvailable, this.MAX_SUGGEST);
      const scope = `Та Tutuyu online дэлгүүрийн туслах. Богино, ойлгомжтой, эелдэг хариул. Бүтээгдэхүүний талаарх хамгийн хамаатай мэдээллийг л өг; тохирохгүй бол байхгүйг хэл; тухайн хүн захиалга үүсгэх бол заавал утасны дугаар болон гэрийн хаягийн мэдээллийг ав аль нэг нь дутуу бол лавлаж асууж байгаад ав. мөн захиалгын мэдээлэл бүрэг ирсэн бол дансны дугаараа явуул;Tutuyu online дэлгүүр
,хот дотор захиалга хйиж байгаа тохиолдолд бараагаа хүлээж авсны дараа доорх дансаар төлбөрөө хийнэ үү хүргэлт үнэгүй хөдөө орон нутаг руу унаанд тавьж явуулдаг тул хаягын дэлгэрэнгүй мэдээлэл хэрэггүй бас зүгээр данс явуулаад л болоо ,
Данс:5031746069 Бат-Итгэл (Хаанбанк)
IBAN: MN660005005031746069
Гүйлгээний утга:утасны дугаар`;

      const guidance = `Хариултаа товч, ойлгомжтой, найрсаг өг.` ;

      // Хатуу буцаалт хийхгүй; AI өөрөө найрсаг, товч хариулт бүрдүүлнэ

      // Load last few messages for lightweight memory
      const history = await prisma.message.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: this.MAX_HISTORY * 2,
      });
      history.reverse();

      const chat: (SystemMessage | HumanMessage | AIMessage)[] = [
        new SystemMessage(`${scope}\n\n${guidance}`),
      ];
      const trimMsg = (s: string) => (s.length > 300 ? `${s.slice(0, 299)}…` : s);
      for (const m of history) {
        const t = trimMsg(m.text);
        if ((m as any).role === 'bot') chat.push(new AIMessage(t));
        else chat.push(new HumanMessage(t));
      }
      chat.push(
        new HumanMessage(
          `Асуулт: ${userMessage}` +
          (matchedList ? `\n\nТаарч буй бараа:\n${matchedList}` : '') +
          (allList ? `\n\nСанал болгох:\n${allList}` : ''),
        ),
      );

      const response = await this.chatModel.invoke(chat);

      return response.content.toString();
    } catch (error: any) {
      this.logger.error(`AI хариу үүсгэхэд алдаа гарлаа: ${error.message}`);
      throw error;
    }
  }
}
