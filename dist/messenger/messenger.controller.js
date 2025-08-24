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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var MessengerController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessengerController = void 0;
const common_1 = require("@nestjs/common");
const messenger_service_1 = require("./messenger.service");
const config_1 = require("@nestjs/config");
let MessengerController = MessengerController_1 = class MessengerController {
    constructor(messengerService, configService) {
        this.messengerService = messengerService;
        this.configService = configService;
        this.logger = new common_1.Logger(MessengerController_1.name);
    }
    verifyWebhook(mode, token, challenge) {
        const verifyToken = this.configService.get('FACEBOOK_VERIFY_TOKEN');
        if (mode === 'subscribe' && token === verifyToken) {
            return challenge;
        }
        throw new Error('Invalid verification token');
    }
    async handleWebhook(body) {
        if (body.object === 'page') {
            for (const entry of body.entry) {
                for (const event of entry.messaging) {
                    if (event.message && event.message.text) {
                        await this.messengerService.handleMessage(event.sender.id, event.message.text);
                    }
                }
            }
        }
    }
};
exports.MessengerController = MessengerController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('hub.mode')),
    __param(1, (0, common_1.Query)('hub.verify_token')),
    __param(2, (0, common_1.Query)('hub.challenge')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", String)
], MessengerController.prototype, "verifyWebhook", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MessengerController.prototype, "handleWebhook", null);
exports.MessengerController = MessengerController = MessengerController_1 = __decorate([
    (0, common_1.Controller)('webhook'),
    __metadata("design:paramtypes", [messenger_service_1.MessengerService,
        config_1.ConfigService])
], MessengerController);
//# sourceMappingURL=messenger.controller.js.map