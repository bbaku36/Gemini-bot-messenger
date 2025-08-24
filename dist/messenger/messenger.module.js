"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessengerModule = void 0;
const common_1 = require("@nestjs/common");
const messenger_controller_1 = require("./messenger.controller");
const messenger_service_1 = require("./messenger.service");
const ai_module_1 = require("../ai/ai.module");
let MessengerModule = class MessengerModule {
};
exports.MessengerModule = MessengerModule;
exports.MessengerModule = MessengerModule = __decorate([
    (0, common_1.Module)({
        imports: [ai_module_1.AiModule],
        controllers: [messenger_controller_1.MessengerController],
        providers: [messenger_service_1.MessengerService],
    })
], MessengerModule);
//# sourceMappingURL=messenger.module.js.map