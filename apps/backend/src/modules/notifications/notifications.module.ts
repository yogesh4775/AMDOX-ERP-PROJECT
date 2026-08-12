import { Module, forwardRef } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { NotificationsController } from "./notifications.controller";
import { AuthModule } from "../auth/auth.module";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [NotificationsController],
  providers: [NotificationsService, TransactionHelper],
  exports: [NotificationsService],
})
export class NotificationsModule {}
