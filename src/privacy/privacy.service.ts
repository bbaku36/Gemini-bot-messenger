import { Injectable } from '@nestjs/common';

@Injectable()
export class PrivacyService {
  getPrivacyText() {
    return 'This bot collects and processes messages you send to help provide responses. Messages are stored securely and not shared with third parties. You can request deletion of your data at any time. For questions contact support@example.com';
  }
}
