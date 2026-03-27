import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonMailerModule, mailerConfig } from '@anarchitects/common-nest-mailer';
import { FormsModule } from '@anarchitects/forms-nest';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppDataSource } from '../data-source';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [mailerConfig]
    }),
    TypeOrmModule.forRootAsync({
      useFactory: async () => ({
        ...AppDataSource.options,
      }),
    }),
    CommonMailerModule.forRootFromConfig(),
    FormsModule.forRootFromConfig(),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
