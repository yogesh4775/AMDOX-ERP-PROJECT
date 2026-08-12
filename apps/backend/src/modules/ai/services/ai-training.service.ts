/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, no-console */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "@amdox/database";
import { AuditService } from "../../../common/audit/audit.service";
import { NotificationsService } from "../../notifications/notifications.service";
import { AuthUser } from "../../auth/interfaces/auth-user.interface";
import { TrainModelDto } from "../dto/train-model.dto";

@Injectable()
export class AiTrainingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async startTrainingJob(dto: TrainModelDto, user: AuthUser) {
    const tenantId = user.tenantId!;

    // Create the training job entry
    const job = await this.prisma.aiTrainingJob.create({
      data: {
        tenantId,
        modelName: dto.modelName,
        status: "PENDING",
      },
    });

    // Run training asynchronously
    this.runAsynchronousTraining(job.id, tenantId, dto, user).catch((err) => {
      console.error(`Asynchronous training job ${job.id} failed:`, err);
    });

    return job;
  }

  private async runAsynchronousTraining(
    jobId: string,
    tenantId: string,
    dto: TrainModelDto,
    user: AuthUser,
  ) {
    await this.prisma.aiTrainingJob.update({
      where: { id: jobId },
      data: { status: "RUNNING", startedAt: new Date() },
    });

    try {
      // Simulate training computations asynchronously
      await new Promise((resolve) => setTimeout(resolve, 100));

      const hp = dto.hyperparameters || {};
      const epochs = hp.epochs || 10;
      const learningRate = hp.learningRate || 0.01;

      // Mock weights and training coefficients based on model name
      let modelBinary = "";
      let metrics = {};
      let algorithm = "linear_regression";

      if (
        dto.modelName.includes("forecast") ||
        dto.modelName.includes("prediction")
      ) {
        algorithm = "linear_regression";
        const slope = 1.5 + Math.random() * 0.5;
        const intercept = 100.0 + Math.random() * 20.0;
        modelBinary = JSON.stringify({ slope, intercept, hp });
        metrics = {
          rmse: 10.5 + Math.random() * 2,
          r2: 0.88 + Math.random() * 0.05,
        };
      } else if (
        dto.modelName.includes("churn") ||
        dto.modelName.includes("attrition") ||
        dto.modelName.includes("risk")
      ) {
        algorithm = "random_forest";
        const weights = { feature1: 0.4, feature2: 0.3, feature3: 0.3 };
        modelBinary = JSON.stringify({ weights, threshold: 0.5 });
        metrics = {
          accuracy: 0.92 + Math.random() * 0.05,
          f1: 0.9 + Math.random() * 0.05,
        };
      } else if (
        dto.modelName.includes("anomaly") ||
        dto.modelName.includes("fraud")
      ) {
        algorithm = "isolation_forest";
        const clusterCenters = [{ x: 10.0, y: 15.0 }];
        modelBinary = JSON.stringify({ clusterCenters, threshold: 3.0 });
        metrics = { precision: 0.95, recall: 0.89 };
      } else {
        algorithm = "xgboost";
        modelBinary = JSON.stringify({ weights: [0.1, 0.2, 0.3, 0.4] });
        metrics = { accuracy: 0.94 };
      }

      // Generate a new version
      const activeCount = await this.prisma.aiModelRegistry.count({
        where: { tenantId, name: dto.modelName },
      });
      const version = `v${activeCount + 1}.0.0`;

      // Save model registry entry
      const model = await this.prisma.aiModelRegistry.create({
        data: {
          tenantId,
          name: dto.modelName,
          version,
          status: "STAGING", // Initial promotion state
          algorithm,
          metrics,
          hyperparameters: hp,
          modelBinary,
          trainingJobId: jobId,
        },
      });

      // Complete job
      await this.prisma.aiTrainingJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          logs: `Training started with learning_rate=${learningRate}\nEpoch 1/${epochs} - loss: 0.45\nEpoch ${epochs}/${epochs} - loss: 0.12\nModel successfully generated.`,
          metrics,
        },
      });

      // Audit Training Completed
      await this.auditService.log({
        action: "AI_MODEL_TRAINED",
        entity: "AiModelRegistry",
        entityId: model.id,
        newValues: { modelName: dto.modelName, version, metrics },
      });

      // Notify User
      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: `AI Model Trained: ${dto.modelName}`,
        message: `Training job ${jobId} completed successfully. Model registered as version ${version} in STAGING.`,
        type: "INFO" as any,
      });
    } catch (err: any) {
      await this.prisma.aiTrainingJob.update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: err.message || "Unknown training error",
          logs: `Training crashed.\nStack: ${err.stack}`,
        },
      });

      await this.notificationsService.createInternal({
        userId: user.id,
        tenantId,
        title: `AI Training Job Failed: ${dto.modelName}`,
        message: `Training job ${jobId} failed: ${err.message || "Unknown error"}`,
        type: "WARNING" as any,
      });
    }
  }

  async promoteModel(
    tenantId: string,
    modelId: string,
    status: string,
    user: AuthUser,
  ) {
    if (!["ACTIVE", "STAGING", "ARCHIVED"].includes(status)) {
      throw new BadRequestException("Invalid status promotion state");
    }

    const model = await this.prisma.aiModelRegistry.findFirst({
      where: { id: modelId, tenantId },
    });
    if (!model) {
      throw new NotFoundException("Model not found in registry");
    }

    return this.prisma.$transaction(async (tx) => {
      // If promoting to ACTIVE, demote/archive all other active versions of the same model name
      if (status === "ACTIVE") {
        const activeModels = await tx.aiModelRegistry.findMany({
          where: { tenantId, name: model.name, status: "ACTIVE" },
        });
        for (const active of activeModels) {
          await tx.aiModelRegistry.update({
            where: { id: active.id },
            data: { status: "ARCHIVED" },
          });

          await this.auditService.log(
            {
              action: "AI_MODEL_ARCHIVED",
              entity: "AiModelRegistry",
              entityId: active.id,
              newValues: { modelName: active.name, version: active.version },
            },
            tx as any,
          );
        }
      }

      const updated = await tx.aiModelRegistry.update({
        where: { id: modelId },
        data: { status },
      });

      // Audit Deploy Event
      await this.auditService.log(
        {
          action: "AI_MODEL_DEPLOYED",
          entity: "AiModelRegistry",
          entityId: modelId,
          newValues: { modelName: model.name, version: model.version, status },
        },
        tx as any,
      );

      return updated;
    });
  }

  async getTrainingJobs(tenantId: string) {
    return this.prisma.aiTrainingJob.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getModelRegistry(tenantId: string) {
    return this.prisma.aiModelRegistry.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }
}
