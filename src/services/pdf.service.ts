import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  async createPdf(images: Buffer[]): Promise<Buffer> {
    try {
      // Yangi PDF hujjat yaratish
      const pdfDoc = await PDFDocument.create();

      for (const imageBuffer of images) {
        // Rasmni PDF ga qo'shish
        const image = await pdfDoc.embedJpg(imageBuffer);
        
        // Sahifa o'lchamlarini hisoblash
        const { width, height } = image;
        const pageWidth = Math.min(width, 595); // A4 kengligi
        const pageHeight = Math.min(height, 842); // A4 balandligi
        
        // Yangi sahifa yaratish
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        
        // Rasmni sahifaga joylashtirish
        const scaleFactor = Math.min(
          pageWidth / width,
          pageHeight / height
        );
        
        const scaledWidth = width * scaleFactor;
        const scaledHeight = height * scaleFactor;
        
        page.drawImage(image, {
          x: (pageWidth - scaledWidth) / 2,
          y: (pageHeight - scaledHeight) / 2,
          width: scaledWidth,
          height: scaledHeight,
        });
      }

      // PDF ni buffer sifatida eksport qilish
      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);

    } catch (error) {
      this.logger.error('PDF yaratishda xatolik:', error);
      throw error;
    }
  }
}
