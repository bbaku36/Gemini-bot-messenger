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

    // 1) Normalize and split
    const raw = text
      .toLowerCase()
      .replace(/[\p{P}\p{S}]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const stop = new Set([
      'сайн', 'байна', 'уу', 'юу', 'вэ', 'та', 'танайд', 'танай', 'хэн', 'ямар', 'яаж', 'энэ', 'тэр', 'би', 'бол', 'болов', 'байгаа', 'байх', 'одоогоор', 'чинас', 'ни', 'миний', 'манай', 'бэлэн', 'асууя', 'сонирхож', 'хэрэгтэй', 'хариу'
    ]);

    const baseTokens = raw.split(' ').map((t) => t.trim()).filter(Boolean);

    // 2) If contains latin, transliterate to Cyrillic and merge tokens
    const hasLatin = /[a-z]/i.test(text);
    let translitTokens: string[] = [];
    if (hasLatin) {
      const translit = this.romanToCyrillic(raw);
      translitTokens = translit.split(' ').map((t) => t.trim()).filter(Boolean);
    }

    // 3) Expand common romanized synonyms → Cyrillic keywords
    const synonymTokens: string[] = [];
    for (const t of baseTokens) {
      if (/^[a-z0-9\-]+$/.test(t)) {
        const extra = this.expandRomanSynonyms(t);
        if (extra.length) synonymTokens.push(...extra);
      }
    }

    // 4) Merge and filter stopwords
    const merged = [...baseTokens, ...translitTokens, ...synonymTokens]
      .map((t) => t.trim())
      .filter((t) => t && t.length >= 2 && !stop.has(t))
      .slice(0, 8);
    return Array.from(new Set(merged));
  }

  // Very simple roman→Cyrillic approximation for common cases
  private romanToCyrillic(input: string): string {
    let s = input.toLowerCase();
    // Handle digraphs first
    s = s
      .replace(/kh/g, 'х')
      .replace(/ch/g, 'ч')
      .replace(/sh/g, 'ш')
      .replace(/ts/g, 'ц')
      .replace(/ya/g, 'я')
      .replace(/yo/g, 'ё')
      .replace(/yu/g, 'ю');
    const map: Record<string, string> = {
      a: 'а', b: 'б', v: 'в', g: 'г', d: 'д', e: 'е', z: 'з',
      i: 'и', j: 'ж', y: 'й', k: 'к', l: 'л', m: 'м', n: 'н',
      o: 'о', p: 'п', r: 'р', s: 'с', t: 'т', u: 'у', f: 'ф',
      h: 'х', c: 'ц', q: 'к', w: 'в', x: 'кс'
    };
    let out = '';
    for (const ch of s) out += map[ch] ?? ch;
    return out;
  }

  private expandRomanSynonyms(token: string): string[] {
    const t = token.toLowerCase();
    const table: Record<string, string[]> = {
      // products in this catalog
      'zalguur': ['залгуур', 'ухаалаг', 'ухаалаг залгуур', 'wi‑fi', 'wi-fi'],
      'plug': ['залгуур', 'ухаалаг залгуур'],
      'wifi': ['wi‑fi', 'wi-fi', 'ухаалаг'],
      'chih': ['чих'],
      'uhagch': ['ухагч'],
      'uhach': ['ухагч'],
      'chihuhagch': ['чих ухагч'],
      'nogoo': ['ногоо'],
      'herchigch': ['хэрчигч'],
      'slicer': ['хэрчигч'],
      'aroma': ['үнэр', 'үнэртүүлэгч'],
      'diffuser': ['үнэртүүлэгч'],
      'uner': ['үнэр', 'үнэртүүлэгч'],
      'unerlegch': ['үнэртүүлэгч'],
      'mat': ['дэвсгэр'],
      'devsger': ['дэвсгэр'],
      'dewsger': ['дэвсгэр'],
      'converter': ['хувиргагч'],
      'huvirgagch': ['хувиргагч'],
      // usage/instructions
      'zaavar': ['заавар', 'хэрэглэх заавар'],
      'zaawar': ['заавар', 'хэрэглэх заавар'],
      'hergleh': ['хэрэглэх', 'хэрэглэх заавар'],
      'howto': ['хэрэглэх заавар'],
      'usage': ['хэрэглэх заавар'],
      'how': ['хэрэглэх заавар']
    };
    return table[t] ?? [];
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
        // 1) Try fuzzy (trigram) search on in-stock items
        const orClausesIn = keywords.map((k) =>
          Prisma.sql`(p."name" % ${k} OR p."description" % ${k} OR p."instruction" % ${k})`,
        );
        if (orClausesIn.length) {
          const whereIn = Prisma.join(orClausesIn, Prisma.sql` OR `);
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

        // 2) Check any-stock fuzzy matches (to inform "бэлэнгүй" кейс)
        const orClausesAny = keywords.map((k) =>
          Prisma.sql`(p."name" % ${k} OR p."description" % ${k} OR p."instruction" % ${k})`,
        );
        if (orClausesAny.length) {
          const whereAny = Prisma.join(orClausesAny, Prisma.sql` OR `);
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
      }

      const matchedList = this.formatProductsList(matched);
      const allList = this.formatProductsList(allAvailable);

      const scope = `Зөвхөн дараах каталогийн талаар ярь. Хэрэв хэрэглэгчийн хүссэн бараа тохирохгүй бол \"одоогоор байхгүй\" гэж хэлээд каталогоос ойролцоо/хамааралтайг санал болго. Хэрэглэх заавар асуувал тухайн барааны 'Заавар' талбараас ишлэн товч тайлбарла. Төлбөр/дэлгүүрийн мэдээлэл асуувал: Tutuyu online дэлгүүр; Данс: 5031746069 Бат‑Итгэл (Хаанбанк); IBAN: MN660005005031746069; Төлбөр — УБ дотор бараагаа хүлээн авсны дараа, орон нутаг руу болохоор урьдчилан төлнө. Каталог:
---
${allList}
---`;

      const guidance = `Хариултаа энгийн, найрсаг, товч өг. Бусад сэдвээр зөвлөмж бүү өг. Хэрэв хэрэглэгч захиалахад бэлэн бол утасны дугаар, хүргэх хаягийг хамтад нь асуу. Хэрэв нэгийг нь өгвөл үлдсэнийг нь л асуу.`;

      // If keywords provided and nothing matched, handle directly without LLM
      if (keywords.length && matched.length === 0) {
        if (matchedAny && matchedAny.length > 0) {
          return `Таны хайсан бараа одоогоор бэлэнгүй байна. Манайд одоо бэлэн байгаа дараах бүтээгдэхүүнүүдээс сонирхоорой:\n\n${allList}`;
        }
        return `Таны хайсан бараа манайд алга байна. Одоогоор бэлэн байгаа бүтээгдэхүүнүүд:\n\n${allList}`;
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
