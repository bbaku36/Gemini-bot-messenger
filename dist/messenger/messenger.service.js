"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MessengerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessengerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
const ai_service_1 = require("../ai/ai.service");
let MessengerService = MessengerService_1 = class MessengerService {
    constructor(configService, aiService) {
        this.configService = configService;
        this.aiService = aiService;
        this.logger = new common_1.Logger(MessengerService_1.name);
        this.pageAccessToken = this.configService.get('FACEBOOK_PAGE_ACCESS_TOKEN');
    }
    async handleMessage(senderId, message) {
        try {
            const aiResponse = await this.aiService.generateResponse(message);
            await this.sendMessage(senderId, aiResponse);
        }
        catch (error) {
            this.logger.error(`Error handling message: ${error.message}`);
            throw error;
        }
    }
    async sendMessage(recipientId, message) {
        const url = `https://graph.facebook.com/v21.0/me/messages`;
        try {
            await axios_1.default.post(url, {
                recipient: { id: recipientId },
                message: { text: message },
            }, {
                params: { access_token: this.pageAccessToken },
            });
        }
        catch (error) {
            this.logger.error(`Error sending message: ${error.message}`);
            throw error;
        }
    }
};
exports.MessengerService = MessengerService;
exports.MessengerService = MessengerService = MessengerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        ai_service_1.AiService])
], MessengerService);
//# sourceMappingURL=messenger.service.js.map