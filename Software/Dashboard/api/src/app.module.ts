import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { VendorsModule } from './vendors/vendors.module';
import { PackagingsModule } from './packagings/packagings.module';
import { RmCodesModule } from './rm-codes/rm-codes.module';
import { SessionsModule } from './sessions/sessions.module';
import { ReadingsModule } from './readings/readings.module';
import { WeighingsModule } from './weighings/weighings.module';
import { SettingsModule } from './settings/settings.module';
import { WebSocketModule } from './websocket/websocket.module';
import { CloudModule } from './cloud/cloud.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    VendorsModule,
    PackagingsModule,
    RmCodesModule,
    SessionsModule,
    ReadingsModule,
    WeighingsModule,
    SettingsModule,
    WebSocketModule,
    CloudModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
