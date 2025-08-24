import { ConfigService } from '@nestjs/config';
import { AiService } from '../ai/ai.service';
export declare class MessengerService {
    private configService;
    private aiService;
    private readonly logger;
    private readonly pageAccessToken;
    constructor(configService: ConfigService, aiService: AiService);
    handleMessage(senderId: string, message: string): Promise<void>;
    private sendMessage;
}
