import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StorageProvider, MulterFile } from "./storage-provider.interface";
import { Readable } from "stream";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly baseUploadDir: string;

  constructor(private readonly configService: ConfigService) {
    const uploadDir = this.configService.get<string>("uploadDirectory");
    if (!uploadDir) {
      throw new InternalServerErrorException(
        "UPLOAD_DIRECTORY configuration is missing or invalid.",
      );
    }
    // Resolve upload directory relative to backend root
    this.baseUploadDir = path.isAbsolute(uploadDir)
      ? uploadDir
      : path.resolve(process.cwd(), uploadDir);

    this.logger.log(
      `Initialized LocalStorageProvider with base directory: ${this.baseUploadDir}`,
    );

    // Create base upload directory if it does not exist
    if (!fs.existsSync(this.baseUploadDir)) {
      try {
        fs.mkdirSync(this.baseUploadDir, { recursive: true });
      } catch (err) {
        const error = err as Error;
        throw new InternalServerErrorException(
          `Failed to create base upload directory: ${error.message}`,
        );
      }
    }
  }

  async upload(
    file: MulterFile,
    storedName: string,
    tenantId: string,
  ): Promise<string> {
    const tenantDir = path.join(this.baseUploadDir, tenantId);

    // Ensure tenant directory exists
    if (!fs.existsSync(tenantDir)) {
      try {
        fs.mkdirSync(tenantDir, { recursive: true });
      } catch (err) {
        const error = err as Error;
        this.logger.error(
          `Failed to create tenant directory for ${tenantId}: ${error.message}`,
        );
        throw new InternalServerErrorException(
          "Failed to provision storage directory.",
        );
      }
    }

    const relativePath = path.join(tenantId, storedName).replace(/\\/g, "/");
    const absolutePath = path.join(this.baseUploadDir, relativePath);

    return new Promise((resolve, reject) => {
      fs.writeFile(absolutePath, file.buffer, (err) => {
        if (err) {
          this.logger.error(
            `Failed to write file to ${absolutePath}: ${err.message}`,
          );
          reject(
            new InternalServerErrorException(
              "Failed to write file to local disk.",
            ),
          );
        } else {
          resolve(relativePath);
        }
      });
    });
  }

  async delete(storagePath: string): Promise<void> {
    const absolutePath = path.join(this.baseUploadDir, storagePath);

    if (fs.existsSync(absolutePath)) {
      return new Promise((resolve, reject) => {
        fs.unlink(absolutePath, (err) => {
          if (err) {
            this.logger.error(
              `Failed to delete file at ${absolutePath}: ${err.message}`,
            );
            reject(
              new InternalServerErrorException(
                "Failed to remove file from local disk.",
              ),
            );
          } else {
            resolve();
          }
        });
      });
    }
  }

  async getStream(storagePath: string): Promise<Readable> {
    const absolutePath = path.join(this.baseUploadDir, storagePath);

    if (!fs.existsSync(absolutePath)) {
      throw new InternalServerErrorException(
        "File not found in storage provider.",
      );
    }

    return fs.createReadStream(absolutePath);
  }
}
