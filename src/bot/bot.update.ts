import { Injectable, Logger } from '@nestjs/common';
import { Update, Start, On, Command, Ctx, Message } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ImageService } from 'src/services/image.service';
import { PdfService } from 'src/services/pdf.service';

interface UserSession {
  images: string[];
  isProcessing: boolean;
  lastActivity: Date;
}

@Update()
@Injectable()
export class BotUpdate {
  private readonly logger = new Logger(BotUpdate.name);
  private readonly userSessions = new Map<number, UserSession>();
  private readonly tempDir = path.join(process.cwd(), 'temp');

  constructor(
    private readonly imageService: ImageService,
    private readonly pdfService: PdfService,
  ) {
    // Temp papkani yaratish
    fs.ensureDirSync(this.tempDir);
  }

  @Start()
  async startCommand(@Ctx() ctx: any) {
    const welcomeMessage = `
🤖 *Hujjat Scanner Bot*

Assalomu alaykum! Men sizning rasmlaringizni avtomatik ravishda hujjat shaklida kesib, PDF qilib beraman.

📋 *Qanday ishlatish:*
1. Hujjat rasmlarini yuboring (bir nechta)
2. /generate buyrug'ini bosing
3. Tayyor PDF faylingizni yuklab oling!

⚡ *Buyruqlar:*
• /start - Botni ishga tushirish
• /generate - PDF yaratish
• /clear - Rasmlarni tozalash
• /status - Holat ko'rish
• /help - Yordam

📸 Rasmlaringizni yuborishni boshlang!
    `;

    await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
    this.initUserSession(ctx.from.id);
  }

  @Command('help')
  async helpCommand(@Ctx() ctx: Context) {
    const helpMessage = `
📖 *Yordam*

🔧 *Bot imkoniyatlari:*
• Hujjat rasmlarini avtomatik kesish
• Bir nechta rasmni bitta PDF qilish
• Sifatli skanerlash natijasi
• Tez ishlov berish

💡 *Maslahatlar:*
• Rasmlarni yaxshi yorug'likda oling
• Hujjat to'liq ko'rinib tursin
• Bir vaqtda 10 tagacha rasm yuborishingiz mumkin

❓ *Muammo bo'lsa:*
• /clear buyrug'i bilan qayta boshlang
• Rasmlar sifatini tekshiring
• Botni qayta ishga tushiring (/start)
    `;

    await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
  }

  @Command('status')
  async statusCommand(@Ctx() ctx: any) {
    const userId = ctx.from.id;
    const session = this.userSessions.get(userId);

    if (!session || session.images.length === 0) {
      await ctx.reply(
        '❌ Hech qanday rasm yuklanmagan. Rasmlaringizni yuboring!',
      );
      return;
    }

    const statusMessage = `
📊 *Status*

📸 Yuklangan rasmlar: ${session.images.length}
⏱️ Oxirgi faollik: ${session.lastActivity.toLocaleString('uz-UZ')}
🔄 Ishlov berish: ${session.isProcessing ? 'Ha' : "Yo'q"}

${session.images.length > 0 ? "✅ PDF yaratish uchun /generate buyrug'ini bosing" : ''}
    `;

    await ctx.reply(statusMessage, { parse_mode: 'Markdown' });
  }

  @Command('clear')
  async clearCommand(@Ctx() ctx: any) {
    const userId = ctx.from.id;
    await this.clearUserSession(userId);
    await ctx.reply(
      '🗑️ Barcha rasmlar tozalandi. Yangi rasmlaringizni yuboring!',
    );
  }

  @Command('generate')
  async generateCommand(@Ctx() ctx: any) {
    const userId = ctx.from.id;
    const session = this.userSessions.get(userId);

    if (!session || session.images.length === 0) {
      await ctx.reply(
        '❌ Hech qanday rasm yuklanmagan. Avval rasmlaringizni yuboring!',
      );
      return;
    }

    if (session.isProcessing) {
      await ctx.reply('⏳ PDF yaratilmoqda, iltimos kuting...');
      return;
    }

    session.isProcessing = true;
    const processingMsg = await ctx.reply(
      '🔄 PDF yaratilmoqda, iltimos kuting...',
    );

    try {
      // Rasmlarni qayta ishlash
      const processedImages = await this.imageService.processImages(
        session.images,
      );

      // PDF yaratish
      const pdfBuffer = await this.pdfService.createPdf(processedImages);

      // PDF yuborish
      await ctx.replyWithDocument(
        {
          source: pdfBuffer,
          filename: `document_${Date.now()}.pdf`,
        },
        {
          caption:
            "✅ PDF muvaffaqiyatli yaratildi!\n\n🗑️ Yangi hujjat uchun /clear buyrug'ini bosing.",
        },
      );

      // Temp fayllarni tozalash
      await this.clearUserSession(userId);
    } catch (error) {
      this.logger.error('PDF yaratishda xatolik:', error);
      await ctx.reply(
        "❌ PDF yaratishda xatolik yuz berdi. Iltimos qayta urinib ko'ring.",
      );
    } finally {
      session.isProcessing = false;
      // Processing message ni o'chirish
      try {
        await ctx.deleteMessage(processingMsg.message_id);
      } catch {} // Ignore deletion errors
    }
  }

  @On('photo')
  async handlePhoto(@Ctx() ctx: any, @Message() message: any) {
    const userId = ctx.from.id;
    const session = this.initUserSession(userId);

    if (session.isProcessing) {
      await ctx.reply('⏳ Hali ishlov berish davom etmoqda, iltimos kuting...');
      return;
    }

    if (session.images.length >= 10) {
      await ctx.reply(
        "⚠️ Maksimal 10 ta rasm yuklash mumkin. PDF yaratish uchun /generate buyrug'ini bosing.",
      );
      return;
    }

    try {
      // Telegram rasmini yuklab olish
      const photo = message.photo[message.photo.length - 1]; // Eng katta o'lchamini olish
      const fileUrl = await ctx.telegram.getFileLink(photo.file_id);

      // Rasmni yuklab olish va saqlash
      const response = await fetch(fileUrl.href);
      const imageBuffer = await response.arrayBuffer();

      const fileName = `${userId}_${Date.now()}_${photo.file_id}.jpg`;
      const filePath = path.join(this.tempDir, fileName);

      await fs.writeFile(filePath, Buffer.from(imageBuffer));
      session.images.push(filePath);
      session.lastActivity = new Date();

      await ctx.reply(
        `✅ Rasm qabul qilindi (${session.images.length}/50)\n\nPDF yaratish uchun /generate buyrug'ini bosing.`,
      );
    } catch (error) {
      this.logger.error('Rasm yuklab olishda xatolik:', error);
      await ctx.reply(
        "❌ Rasmni yuklab olishda xatolik yuz berdi. Iltimos qayta urinib ko'ring.",
      );
    }
  }

  @On('document')
  async handleDocument(@Ctx() ctx: any, @Message() message: any) {
    const document = message.document;

    if (!document.mime_type?.startsWith('image/')) {
      await ctx.reply('⚠️ Faqat rasm fayllari qabul qilinadi (JPG, PNG, etc.)');
      return;
    }

    const userId = ctx.from.id;
    const session = this.initUserSession(userId);

    if (session.isProcessing) {
      await ctx.reply('⏳ Hali ishlov berish davom etmoqda, iltimos kuting...');
      return;
    }

    if (session.images.length >= 10) {
      await ctx.reply('⚠️ Maksimal 10 ta rasm yuklash mumkin.');
      return;
    }

    try {
      const fileUrl = await ctx.telegram.getFileLink(document.file_id);
      const response = await fetch(fileUrl.href);
      const imageBuffer = await response.arrayBuffer();

      const fileName = `${userId}_${Date.now()}_${document.file_id}.jpg`;
      const filePath = path.join(this.tempDir, fileName);

      await fs.writeFile(filePath, Buffer.from(imageBuffer));
      session.images.push(filePath);
      session.lastActivity = new Date();

      await ctx.reply(
        `✅ Hujjat qabul qilindi (${session.images.length}/10)\n\nPDF yaratish uchun /generate buyrug'ini bosing.`,
      );
    } catch (error) {
      this.logger.error('Hujjat yuklab olishda xatolik:', error);
      await ctx.reply('❌ Hujjatni yuklab olishda xatolik yuz berdi.');
    }
  }

  private initUserSession(userId: number): UserSession {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, {
        images: [],
        isProcessing: false,
        lastActivity: new Date(),
      });
    }
    const session = this.userSessions.get(userId);
    if (!session) {
      throw new Error(`User session not found for userId: ${userId}`);
    }
    return session;
  }

  private async clearUserSession(userId: number) {
    const session = this.userSessions.get(userId);
    if (session) {
      for (const filePath of session.images) {
        try {
          await fs.remove(filePath);
        } catch (error) {
          this.logger.warn(`Faylni o'chirishda xatolik: ${filePath}`, error);
        }
      }
      session.images = [];
      session.lastActivity = new Date();
    }
  }
}
