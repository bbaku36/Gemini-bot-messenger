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

  async generateResponse(userMessage: string): Promise<string> {
    try {
      const products = await prisma.product.findMany({ orderBy: { createdAt: 'asc' } });
      const productList = this.formatProductsList(products);

      const response = await this.chatModel.invoke([
        new SystemMessage(
          `Та Facebook-ийн мессежүүдэд хариулах эелэг, ойлгомжтой туслах юм.\n\nШаардлага:\n1) Хэрэв хэрэглэгч ерөнхийдөө \"танайд ямар бүтээгдэхүүн байна\" гэх мэт асуувал, доорх жагсаалтаас БҮХ бэлэн бүтээгдэхүүнийг 1., 2., ... гэж НЭР + ҮНЭ хэлбэрээр товч жагсаа.\n2) Хэрэв хэрэглэгч захиалах сонирхол илэрхийлбэл (жишээ: \"захиалах\", \"авах\"), ЭХЛЭЭД дараах мэдээллийг БҮРДҮҮЛ: утасны дугаар, хүргэх хаяг. Нэг асуултаар цулбагар байдлаар асуу (жишээ: \"Захиалгаа баталгаажуулахын тулд утасны дугаар, хүргэх хаягаа явуулна уу\").\n3) Хэрэглэгч дугаар/хаягаа өгсний дараа л захиалгыг баталгаажуулж болохыг анхааруул.\n\nБүтээгдэхүүний жагсаалт:\n${productList}`,
        ),
        new HumanMessage(userMessage),
      ]);

      return response.content.toString();
    } catch (error: any) {
      this.logger.error(`AI хариу үүсгэхэд алдаа гарлаа: ${error.message}`);
      throw error;
    }
  }
}

