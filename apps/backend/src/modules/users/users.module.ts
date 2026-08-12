import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";
import { UsersController } from "./users.controller";
import { AuthModule } from "../auth/auth.module";
import { TransactionHelper } from "../../common/transactions/transaction.helper";

@Module({
  imports: [AuthModule],
  controllers: [UsersController],
  providers: [UsersService, TransactionHelper],
  exports: [UsersService],
})
export class UsersModule {}
