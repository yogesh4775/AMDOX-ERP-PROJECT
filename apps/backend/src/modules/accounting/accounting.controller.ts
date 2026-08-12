import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { Permissions } from "../auth/decorators/permissions.decorator";
import { AuthUser } from "../auth/interfaces/auth-user.interface";
import { PermissionsList } from "../../common/constants/permissions.constants";
import { AccountingService } from "./accounting.service";
import { CreateAccountDto } from "./dto/create-account.dto";
import { UpdateAccountDto } from "./dto/update-account.dto";
import { CreateJournalDto } from "./dto/create-journal.dto";
import { PostJournalDto } from "./dto/post-journal.dto";
import { QueryAccountDto, QueryJournalDto } from "./dto/query-accounting.dto";

@Controller("accounting")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  // --- ACCOUNTS ---
  @Post("accounts")
  @Permissions(PermissionsList.ACCOUNTING_WRITE)
  async createAccount(
    @Body() dto: CreateAccountDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.accountingService.createAccount(dto, req.user);
  }

  @Patch("accounts/:id")
  @Permissions(PermissionsList.ACCOUNTING_WRITE)
  async updateAccount(
    @Param("id") id: string,
    @Body() dto: UpdateAccountDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.accountingService.updateAccount(id, dto, req.user);
  }

  @Get("accounts")
  @Permissions(PermissionsList.ACCOUNTING_READ)
  async findAllAccounts(
    @Query() query: QueryAccountDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.accountingService.findAllAccounts(query, req.user);
  }

  @Get("accounts/:id")
  @Permissions(PermissionsList.ACCOUNTING_READ)
  async findAccount(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.accountingService.findAccount(id, req.user);
  }

  // --- JOURNALS ---
  @Post("journals")
  @Permissions(PermissionsList.ACCOUNTING_WRITE)
  async createJournal(
    @Body() dto: CreateJournalDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.accountingService.createJournalEntry(dto, req.user);
  }

  @Patch("journals/:id/post")
  @Permissions(PermissionsList.ACCOUNTING_POST)
  async postJournal(
    @Param("id") id: string,
    @Body() dto: PostJournalDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.accountingService.postJournalEntry(id, dto, req.user);
  }

  @Patch("journals/:id/reverse")
  @Permissions(PermissionsList.ACCOUNTING_REVERSE)
  async reverseJournal(
    @Param("id") id: string,
    @Body() dto: PostJournalDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.accountingService.reverseJournalEntry(id, dto, req.user);
  }

  @Get("journals")
  @Permissions(PermissionsList.ACCOUNTING_READ)
  async findAllJournals(
    @Query() query: QueryJournalDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.accountingService.findAllJournals(query, req.user);
  }

  @Get("journals/:id")
  @Permissions(PermissionsList.ACCOUNTING_READ)
  async findJournal(@Param("id") id: string, @Req() req: { user: AuthUser }) {
    return this.accountingService.findJournal(id, req.user);
  }

  // --- TRIAL BALANCE ---
  @Get("trial-balance")
  @Permissions(PermissionsList.ACCOUNTING_READ)
  async generateTrialBalance(@Req() req: { user: AuthUser }) {
    return this.accountingService.generateTrialBalance(req.user);
  }
}
