import { ConfigService } from '@nestjs/config';
export declare class AiService {
    private configService;
    private readonly logger;
    private readonly chatModel;
    constructor(configService: ConfigService);
    generateResponse(userMessage: string): Promise<string>;
}
