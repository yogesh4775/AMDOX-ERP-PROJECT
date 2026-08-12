import { Module } from "@nestjs/common";
import { MediaService } from "./media.service";
import { MediaController } from "./media.controller";
import { STORAGE_PROVIDER_TOKEN } from "./storage/storage-provider.interface";
import { LocalStorageProvider } from "./storage/local-storage.provider";
import { AuthModule } from "../auth/auth.module";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [AuthModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    TransactionHelper,
    {
      provide: STORAGE_PROVIDER_TOKEN,
      useClass: LocalStorageProvider,
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
