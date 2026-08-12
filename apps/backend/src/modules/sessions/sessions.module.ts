import { Module, forwardRef } from "@nestjs/common";
import { SessionsService } from "./sessions.service";
import { SessionsController } from "./sessions.controller";
import { AuthModule } from "../auth/auth.module";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [SessionsController],
  providers: [SessionsService, TransactionHelper],
  exports: [SessionsService],
})
export class SessionsModule {}
