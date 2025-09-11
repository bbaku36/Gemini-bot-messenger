import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type SeedProduct = {
  name: string;
  price: number;
  description?: string;
  instruction?: string;
};

const products: SeedProduct[] = [
  {
    name: 'Машины татлага олс – Бат бөх, найдвартай сонголт!',
    price: 39900,
    description:
      '⛓ 5 м урт, 18 т даацтай; 🛠 Өндөр бат бэх материалаар хийгдсэн; 🏕 Бартаат зам, аврах ажиллагаанд тохиромжтой; 🎁 Зөөвөрлөх уут дагалдана; 🚚 УБ-д үнэгүй хүргэлт.',
    instruction: 'Хэт сунгалт, огцом таталтаас болгоомжилно. Ашигласны дараа хуурай хадгал.'
  },
  {
    name: 'Искра – Арьс арчилгааны өндөр давтамжийн төхөөрөмж',
    price: 52000,
    description:
      '✨ Озон нь нян устгана, үрэвсэл намдаана; 💡 4 төрлийн хошуутай; 🧴 Арьсыг сэргээж, цусны эргэлтийг сайжруулна; 📦 Бэлэн бараа, хүргэлт үнэгүй.',
    instruction:
      '1) Нүүрээ цэвэрлэж хуурайшуул. 2) Таарсан шилэн хошууг холбож асаа, хүчийг багаас эхлүүл. 3) 5–10 минут зөөлөн массажлана. 4) Дараа нь унтрааж хошууг ариутга, чийгшүүлэгч түрхэнэ.'
  },
  {
    name: 'Олон үйлдэлт ногоо хэрчигч',
    price: 18500,
    description:
      'Цэвэр ган иртэй, сольж болох олон төрлийн иртэй. Хальтирдаггүй суурьтай, хэрэглэхэд хялбар.',
  },
  {
    name: 'Wi‑Fi Ухаалаг Залгуур (20A)',
    price: 35000,
    description:
      'Alexa/Google Assistant дэмжинэ. Tuya/Smart Life апптай. Цаг тохируулах горимтой.',
  },
  {
    name: 'Ухаалаг Үнэртүүлэгч сет',
    price: 35000,
    description: '5 төрлийн тохиргоо, 5–60м² хамрах хүрээ. Нэг цэнэгээр 60 хоног хүртэл.',
  },
  {
    name: 'Олон үйлдэлт мини хувиргагч сет',
    price: 20000,
    description: 'Type‑C↔USB, Type‑C↔iPhone, Type‑C↔Micro, сим хэрэгслүүд.',
  },
  {
    name: 'Гал тогооны хос дэвсгэр',
    price: 49000,
    description: 'Ус, дулаанд тэсвэртэй, хальтирдаггүй, цэвэрлэхэд хялбар.',
  },
];

async function main() {
  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          price: p.price,
          description: p.description ?? null,
          instruction: p.instruction ?? null,
        },
      });
    } else {
      await prisma.product.create({
        data: {
          name: p.name,
          price: p.price,
          description: p.description ?? null,
          instruction: p.instruction ?? null,
        },
      });
    }
  }
  console.log(`Seeded/updated ${products.length} products`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
