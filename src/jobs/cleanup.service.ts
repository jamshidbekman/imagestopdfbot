import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as fs from 'fs-extra';
import * as path from 'path';

@Injectable()
export class CleanupService {
  private readonly logger = new Logger(CleanupService.name);
  private readonly tempDir = path.join(process.cwd(), 'temp');
  private readonly cacheDir = path.join(this.tempDir, 'cache');

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupOldFiles() {
    this.logger.log('Eski fayllarni tozalash boshlandi...');

    try {
      const files = await fs.readdir(this.tempDir);
      const oneDayAgo = Date.now() - 1 * 60 * 60 * 1000;

      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime.getTime() < oneDayAgo) {
          await fs.remove(filePath);
          deletedCount++;
        }
      }

      this.logger.log(`${deletedCount} ta eski fayl o'chirildi`);
    } catch (error) {
      this.logger.error('Fayllarni tozalashda xatolik:', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupCache() {
    this.logger.log('🗑 Cache fayllarni tozalash boshlandi...');
    try {
      if (await fs.pathExists(this.cacheDir)) {
        const cacheFiles = await fs.readdir(this.cacheDir);
        let deletedCount = 0;

        for (const file of cacheFiles) {
          const filePath = path.join(this.cacheDir, file);
          const stats = await fs.stat(filePath);

          if (stats.isFile()) {
            await fs.remove(filePath);
            deletedCount++;
          }
        }

        this.logger.log(`🧼 Cachedan ${deletedCount} ta fayl o'chirildi.`);
      } else {
        this.logger.warn(`⚠️ Cache papkasi mavjud emas: ${this.cacheDir}`);
      }
    } catch (error) {
      this.logger.error('❌ Cache tozalashda xatolik:', error);
    }
  }
}
