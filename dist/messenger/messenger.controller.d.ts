import { MessengerService } from './messenger.service';
import { ConfigService } from '@nestjs/config';
export declare class MessengerController {
    private readonly messengerService;
    private readonly configService;
    private readonly logger;
    constructor(messengerService: MessengerService, configService: ConfigService);
    verifyWebhook(mode: string, token: string, challenge: string): string;
    handleWebhook(body: any): Promise<void>;
}
