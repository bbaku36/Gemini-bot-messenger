import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SeedProduct = {
  slug: string;
  title: string;
  priceText?: string;
  details?: string;
  isAvailable?: boolean;
};

const products: SeedProduct[] = [
  {
    slug: 'multi-vegetable-slicer',
    title: 'Олон үйлдэлт ногоо хэрчигч',
    priceText: '18,500₮',
    details:
      'Цэвэр ган иртэй, сольж болох олон төрлийн иртэй. Хальтирдаггүй суурьтай, хэрэглэхэд хялбар. Үнэгүй хүргэлттэй.',
  },
  {
    slug: 'smart-wifi-plug-20a',
    title: 'Wi‑Fi Ухаалаг Залгуур (20A)',
    priceText: 'Үндсэн 45,000₮ / Хямд 35,000₮',
    details:
      'Alexa/Google Assistant дэмжинэ. Tuya/Smart Life апптай. Цаг тохируулах горимтой. Хот дотор үнэгүй хүргэлт.',
  },
  {
    slug: 'smart-aroma-diffuser-set',
    title: 'Ухаалаг Үнэртүүлэгч сет',
    priceText: '35,000₮',
    details:
      '5 төрлийн тохиргоо, 5–60м² хамрах хүрээ. Нэг цэнэгээр 60 хоног хүртэл. 5 төрлийн үнэр дагалдана. Үнэгүй хүргэлт.',
  },
  {
    slug: 'mini-converter-set',
    title: 'Олон үйлдэлт мини хувиргагч сет',
    priceText: '20,000₮',
    details:
      'Type‑C↔USB, Type‑C↔iPhone, Type‑C↔Micro, сим гаргагч, сим хадгалагч. Аялахад авсаархан.',
  },
  {
    slug: 'door-handle-cover-flowers',
    title: 'Цэцэгтэй хаалганы бариулын бүрээс (3ш)',
    priceText: '20,000₮',
    details:
      'Зөөлөн материалтай, элэгдэл бохирдлоос хамгаална. Хүүхдийн өрөөнд тохиромжтой. Үнэгүй хүргэлт.',
  },
  {
    slug: 'kitchen-mat-pair',
    title: 'Гал тогооны хос дэвсгэр',
    priceText: '49,000₮ (хос)',
    details:
      'Цулгуй минимал загвар. Ус, дулаанд тэсвэртэй, хальтирдаггүй, цэвэрлэхэд хялбар. Үнэ: 40×60 + 40×160см.',
    isAvailable: false, // таны тэмдэглэгээн дээр дууссан гэж дурдсан
  },
  {
    slug: 'device-cleaning-kit',
    title: 'Гар утас/чихэвч/keyboard цэвэрлэгээний иж бүрдэл',
    priceText: '20,000₮',
    details:
      'Хөвөн/силикон хошуу, дэлгэц цэвэрлэгч, товч сугалагч, багс гэх мэт. Төхөөрөмжөө цэвэр, удаан байлгана.',
  },
  {
    slug: 'soft-floor-mat-70x180',
    title: 'Зөөлөн шалны дэвсгэр 70×180см',
    priceText: '49,900₮',
    details:
      'Зөөлөн, өнгөлөг, үс унахгүй, гараар/машинаар угааж болно. Олон загварын кодтой (V1–V6).',
  },
  {
    slug: 'smart-ear-cleaner-camera',
    title: 'Ухаалаг чих ухагч (HD камераар)',
    priceText: '32,000₮',
    details:
      'APP-тэй, HD camera; зураг/бичлэг хийх; чих/хамар/хоолой харах боломжтой; цэнэг сайн барина; LED гэрэл.\nДагалдах: 6 ширхэг силикон хошуу, хадгалах сав, цэнэглэгч кабель.\niOS болон Android-той нийцтэй. Хот дотор хүргэлт үнэгүй.',
  },
];

async function main() {
  for (const p of products) {
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: {
        title: p.title,
        priceText: p.priceText,
        details: p.details,
        isAvailable: p.isAvailable ?? true,
      },
      create: {
        slug: p.slug,
        title: p.title,
        priceText: p.priceText,
        details: p.details,
        isAvailable: p.isAvailable ?? true,
      },
    });
  }
  console.log(`Seeded ${products.length} products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
