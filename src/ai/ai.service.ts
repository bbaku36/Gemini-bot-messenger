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
      temperature: 0.7,
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

  async generateResponse(userMessage: string): Promise<string> {
    console.log('userMessage', userMessage);

    // Read products from the database and build description text
    const products = await prisma.product.findMany();
    const productList = products
      .map(
        (p, i) =>
          `${i + 1}. ${p.name}\n- Үнэ: ${p.price}₮\n${
            p.description ? '- ' + p.description + '\n' : ''
          }${p.instruction ? '- Заавар: ' + p.instruction : ''}`,
      )
      .join('\n\n');

    try {
      const response = await this.chatModel.invoke([
        new SystemMessage(
          `Та Facebook-ийн мессежүүдэд хариулах эелдэг, ойлгомжтой туслах юм. Хэрэглэгчийн асуултад хариулахдаа доорх бүтээгдэхүүний мэдээллийг ашиглана уу:\n\n${productList}`,
        ),
        new HumanMessage(userMessage),
      ]);

      return response.content.toString();
    } catch (error) {
      this.logger.error(`AI хариу үүсгэхэд алдаа гарлаа: ${error.message}`);
      throw error;
    }
  }
}
