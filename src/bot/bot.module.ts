import { Module } from '@nestjs/common';
import { BotUpdate } from './bot.update';
import { TelegrafModule } from 'nestjs-telegraf';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BotService } from './bot.service';
import { ImageService } from 'src/services/image.service';
import { PdfService } from 'src/services/pdf.service';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        return {
          token:
            configService.get('BOT_TOKEN') ??
            '8017273074:AAFNnPtn9vQ_ALU2LdtQ1fbkr_dq7g',
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [BotUpdate, BotService, ImageService, PdfService],
})
export class BotModule {}
