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
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const openai_1 = require("@langchain/openai");
const messages_1 = require("@langchain/core/messages");
let AiService = AiService_1 = class AiService {
    constructor(configService) {
        this.configService = configService;
        this.logger = new common_1.Logger(AiService_1.name);
        this.chatModel = new openai_1.ChatOpenAI({
            openAIApiKey: this.configService.get('OPENAI_API_KEY'),
            temperature: 0.7,
            modelName: this.configService.get('OPENAI_MODEL_NAME') || 'gpt-4o-mini',
            maxTokens: 1000,
            streaming: false,
            callbacks: [
                {
                    handleLLMError: (error) => {
                        this.logger.error('LLM Error:', {
                            message: error.message,
                            name: error.name,
                            stack: error.stack,
                        });
                    },
                    handleLLMEnd: (output) => {
                        this.logger.debug('LLM Response:', {
                            usage: output.llmOutput?.tokenUsage,
                        });
                    },
                },
            ],
            timeout: 30000,
            maxRetries: 3,
        });
    }
    async generateResponse(userMessage) {
        console.log('userMessage', userMessage);
        const productList = `
    1. Олон үйлдэлт ногоо хэрчигч
    - Үнэ: 18,500₮
    - Онцлог:
      - Цэвэр ган иртэй, практик загвар.
      - Ногоо болон жимсийг янз бүрээр хэрчих сольж болдог ирнүүдтэй.
      - Гар гэмтэхээс хамгаалах аюулгүй ажиллагааны системтэй.
      - Зэвэрдэггүй, удаан эдэлгээтэй материалтай.
      - Хальтирдаггүй суурьтай, хэрэглэхэд хялбар.
      - Хоол хийх процессыг хөнгөвчилж цаг хэмнэнэ.
    - Хүргэлт: Үнэгүй хүргэлттэй.ß
  
    2. Wi-Fi Ухаалаг Залгуур
    - Үнэ: Үндсэн үнэ: 45,000₮, Хямдарсан үнэ: 35,000₮
    - Онцлог:
      - 20A хүртэл өндөр чадалтай, том оврын төхөөрөмжийг дэмжинэ.
      - Alexa, Google Assistant, Tmall Genie-тэй нийцтэй.
      - Tuya болон Smart Life апп-уудтай бүрэн ажиллана.
      - Wi-Fi холболтоор хялбар суурилуулна.
      - Цаг тохируулах горимтой – төхөөрөмжөө автоматаар асааж, унтраах боломжтой.
      - Нэг утаснаас олон төхөөрөмж удирдах эсвэл олон утаснаас нэг төхөөрөмж удирдах боломжтой.
    - Хүргэлт: Хот дотор үнэгүй хүргэлттэй.
    3.Таны гэр болон оффист таатай уур амьсгал бүрдүүлэх Ухаалаг Үнэртүүлэгч! 🌸
🌀 5 төрлийн тохируулгатай горим - Та хүссэн үнэрээ их эсвэл бага хэмжээгээр тохируулж болно.
🏡 Өргөн хамрах хүрээ - 5-60м2 талбайг хамрана
🔋 Удаан хугацааны ашиглалт - Нэг удаагийн цэнэглэлтээр 60 хоног хүртэл цэнэгээ барина.
🌿 Байгалийн гаралтай үнэртүүлэгч - Эрүүл, аюулгүй хэрэглээ, таны ойр орчмыг тав тухтай болгоно.
✨ Энгийн, дэгжин загвар - Хананд өлгөх болон ширээн дээр байрлуулах боломжтой.
 🎁Дагалдах зүйлс:
*. 5 ширхэг өөр төрлийн анхилам үнэртүүлэгч
*. Цэнэглэгч кабель
*. Үнэртүүлэгчийн аппарат
ҮНЭ:35000₮
 🚖Та одоо захиалаад үнэгүй хүргүүлээд аваарай
 4.Олон үйлдэлт мини хувиргагч сет! 🌟
✅ Type-C to USB хувиргагч
✅ Сим гаргагч
✅ 3 ширхэг сим хадгалагч
✅ Type-C to iPhone хувиргагч
✅ Type-C to Micro(хуучин android) хувиргагч
✅ Type-C кабель
📌 Жижигхэн бөгөөд авсаархан дизайны ачаар та үүнийг хаана ч авч явах боломжтой!
💼 Оффис, аялал, өдөр тутмын хэрэгцээнд яг тохирсон.
ҮНЭ:20000₮
🚖 Одоо захиалаад үнэгүй хүргүүлээд аваарай
5.Таны гэрт өнгө, дулаан уур амьсгал нэмэх хаалганы бариул🌸
Гоёмсог пастел өнгөтэй цэцэг хэлбэртэй чимэглэлтэй, зөөлөн материалаар хийгдсэн энэхүү бариулын бүрээс нь таны хаалгыг өвөрмөц, загварлаг харагдуулах төдийгүй бариулыг элэгдэл, бохирдлоос хамгаална. 👌
✅ Хүүхдийн өрөөнд төгс тохирно!
✅ Зөөлөн, тансаг мэдрэмж
✅ Гоёл чимэглэл ба хамгаалалт нэг дор
Таны гэр бүлийн дулаан уур амьсгалыг бүрдүүлэх жижиг бөгөөд онцгой деталь байж чадна! 💖
Үнэ:3ширхэг 20000₮
📦 Хүргэлт үнэгүй!
6.(энэ бараа дууссан) Бүүр үнэхээр nice минималист дэвсгэр 
🌸Гал тогооны хос дэвсгэр🌸
Шал хамгаалхаас эхлээд их хэрэгтэй олон давуу талтайдаа
✅ Цулгуй элдэв хээ зураг байхгүй учир гэрийг үнэхээр цэвэрхэн гэгээлэг өнгөлөг харагдуулна
✅ цэвэрлэхэд маш хялбар
✅ халуунд тэсвэртэй
✅ хальтархаас сэргийлсэн зуурагчтай учир хөдлөхгүй
✅ ус нэвтэрэхгүй
✅ удаан эдэлгээтэй
✅ үнэргүй 
✅ нян бактер үржихгүй
✅ ус хурдан шингээж хурдан хатдаг
Хэмжээ: 40*60-40*160см
Үнэ:  хосоороо 49.000
❕❕❕бодит зураг оруулсан байгаа 🤗
Та захиалах бол чатаар утас хаягаа явуулаарай 🚙 үнэгүй хүргэж өгнө.
Очоод бараа аваагүй тохиолдолд хүргэлтийн мөнгөа өгхийг анхаарнуу❗️
7.Гар утас,чихэвч,keyboard
Цэвэрлэгээний иж бүрдэл
"Таны цэвэрхэн, цэгцтэй орчны нууц!"
✅Хөвөн болон силикон хошуу – Хүрэхэд хэцүү булан, завсрыг нарийн цэвэрлэнэ.
✅Дэлгэц цэвэрлэгч – Дэлгэцийг гялалзсан, толбогүй болгоно.
✅Товч сугалагч – Гарны товчлууруудыг аюулгүй сугалж, доторх тоос шороо, бохирдлыг арилгана.
✅Цэвэрлэгч багс – Тоос, шороо, жижиг бохирдлыг амархан цэвэрлэнэ.
Зөөлөн дэлгэц арчигч – Дэлгэцийг зураасгүй, тунгалаг, толбогүй болгоно.
💸 Үнэ: 20,000₮
📲 Өнөөдөр захиалж аваарай! Таны төхөөрөмжүүд цэвэрхэн байхаас гадна илүү удаан эдэлгээтэй байх болно! 

8.Гоё зөөлөн чанартай шалны дэвсгэрүүд ирсэн байгаа шүү 🌸 авах нь утасны дугаараа бичээд үлдээгээрэй
Хэмжээ: 70*180см 
Үнэ: 49.900₮
✅ зөөлөн 
✅ өнгөлөг хөөрхөн
✅ үс унахгүй
✅ угааж болно гараар болон машинаар
(V1 гээд кодоо хэлээд захиалаарай)
 (V1 гахайны зурагтай,V2 гүзээлзгэний зурагтай, V3 Цагаан өнгөтэй цэцэгтэй , V4 Цэцэгтэй цагаан баавгайтай, V5 Ягаан өнгөтэй цагаан үүл болон үүлэн хэлбэртэй бамбарууштай, V6 Ягаан өнгөтэй цэцэгтэй, цагаан өнгийн дэвсгэр)
    `;
        try {
            const response = await this.chatModel.invoke([
                new messages_1.SystemMessage(`Та Facebook-ийн мессежүүдэд хариулах эелдэг, ойлгомжтой туслах юм. Хэрэглэгчийн асуултад хариулахдаа доорх бүтээгдэхүүний мэдээллийг ашиглана уу:\n\n${productList}`),
                new messages_1.HumanMessage(userMessage),
            ]);
            return response.content.toString();
        }
        catch (error) {
            this.logger.error(`AI хариу үүсгэхэд алдаа гарлаа: ${error.message}`);
            throw error;
        }
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AiService);
//# sourceMappingURL=ai.service.js.map