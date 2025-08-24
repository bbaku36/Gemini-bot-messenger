import { PrivacyService } from './privacy.service';
export declare class PrivacyController {
    private readonly privacyService;
    constructor(privacyService: PrivacyService);
    getPrivacyText(): string;
}
