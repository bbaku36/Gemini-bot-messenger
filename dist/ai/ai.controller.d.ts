import { AiService } from './ai.service';
export declare class AiController {
    private readonly aiService;
    constructor(aiService: AiService);
    generateResponse(body: {
        message: string;
    }): Promise<string>;
}
