import { Injectable, BadRequestException } from "@nestjs/common";
import { PrismaService } from "@amdox/database";

export type DependencyCheckFn = (
  prisma: PrismaService,
  id: string,
  tenantId: string,
) => Promise<boolean>;

@Injectable()
export class MasterDependencyRegistry {
  private readonly checks = new Map<string, DependencyCheckFn[]>();

  register(entity: string, checkFn: DependencyCheckFn) {
    const list = this.checks.get(entity) || [];
    list.push(checkFn);
    this.checks.set(entity, list);
  }

  async validateDeletion(
    entity: string,
    prisma: PrismaService,
    id: string,
    tenantId: string,
  ): Promise<void> {
    const list = this.checks.get(entity) || [];
    for (const checkFn of list) {
      const hasDependency = await checkFn(prisma, id, tenantId);
      if (hasDependency) {
        throw new BadRequestException(
          `Cannot delete ${entity} because active dependent records exist.`,
        );
      }
    }
  }
}
