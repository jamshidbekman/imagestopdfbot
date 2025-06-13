import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import * as fs from 'fs-extra';
import * as path from 'path';

@Injectable()
export class ImageService {
  private readonly logger = new Logger(ImageService.name);

  async processImages(imagePaths: string[]): Promise<Buffer[]> {
    const processedImages: Buffer[] = [];

    for (const imagePath of imagePaths) {
      try {
        const processedImage = await this.processImage(imagePath);
        processedImages.push(processedImage);
      } catch (error) {
        this.logger.error(`Rasmni qayta ishlashda xatolik: ${imagePath}`, error);
        throw error;
      }
    }

    return processedImages;
  }

  private async processImage(imagePath: string): Promise<Buffer> {
    try {
      // Rasmni sharp bilan ochish
      let image = sharp(imagePath);
      
      // Rasm metadata olish
      const metadata = await image.metadata();
      this.logger.log(`Rasm o'lchamlari: ${metadata.width}x${metadata.height}`);

      // Avtomatik kesish va optimallashtirish
      const processedImage = await image
        .resize(1200, 1600, {
          fit: sharp.fit.inside,
          withoutEnlargement: true,
        })
        .sharpen()
        .normalize()
        .jpeg({ quality: 90, progressive: true })
        .toBuffer();

      return processedImage;

    } catch (error) {
      this.logger.error('Rasmni qayta ishlashda xatolik:', error);
      throw error;
    }
  }

  async detectDocumentEdges(imagePath: string): Promise<Buffer> {
    // Hujjat chegaralarini aniqlash (advanced feature)
    // Bu yerda OpenCV yoki boshqa kutubxonalardan foydalanish mumkin
    // Hozircha oddiy sharp bilan qayta ishlaymiz
    
    try {
      const image = sharp(imagePath);
      
      // Kontrast va aniqlikni oshirish
      const processedImage = await image
        .modulate({
          brightness: 1.1,
          saturation: 0.8,
        })
        .sharpen({ sigma: 1.5 })
        .jpeg({ quality: 95 })
        .toBuffer();

      return processedImage;
    } catch (error) {
      this.logger.error('Hujjat chegaralarini aniqlashda xatolik:', error);
      throw error;
    }
  }
}
