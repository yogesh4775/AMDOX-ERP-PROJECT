import { Injectable } from "@nestjs/common";
import { PrismaService } from "@amdox/database";

export type PrismaTx = Omit<
  PrismaService,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

@Injectable()
export class TransactionHelper {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(
    callback: (tx: PrismaTx) => Promise<T>,
    existingTx?: PrismaTx,
  ): Promise<T> {
    if (existingTx) {
      return callback(existingTx);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.prisma.$transaction(callback as any) as unknown as Promise<T>;
  }
}
