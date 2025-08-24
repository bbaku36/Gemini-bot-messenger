import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  await prisma.product.createMany({
    data: [
      {
        name: "Машины татлага олс",
        price: 39900,
        description:
          "5 м урт, 18 тн даац; Өндөр бат бэх материал; Бартаат зам, аврах ажиллагаанд тохиромжтой; Зөөвөрлөх уут; УБ дотор үнэгүй хүргэлт.",
        instruction: null,
      },
      {
        name: "Искра озон аппарат",
        price: 52000,
        description:
          "Озон үүсгэгч нь арьсны гүн дэх нянг устгаж, үрэвсэл намдаана; 4 төрлийн хошуутай; Арьсыг сэргээж, цусны эргэлтийг сайжруулна; Гэрийн нөхцөлд салонгийн үр дүн.",
        instruction: `1) Арьсаа угааж хуурайшуулах
2) Хошуугаа сууринд залгах
3) Асааж бага хүчээр эхлэх
4) Тохирсон хошуугаар 5–10 мин массажлах
5) Дуусгаад ариутга, чийгшүүлэгч түрх`,
      },
    ],
  });

  console.log("✅ Бараанууд seed хийгдлээ!");
}

main()
  .catch((e) => {
    console.error("❌ Seed алдаа:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
