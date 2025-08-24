import { Controller, Get } from '@nestjs/common';
import { PrivacyService } from './privacy.service';

@Controller('privacy')
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Get()
  getPrivacyText() {
    return this.privacyService.getPrivacyText();
  }
}
