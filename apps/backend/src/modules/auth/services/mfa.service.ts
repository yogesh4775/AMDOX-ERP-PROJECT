import { Injectable } from "@nestjs/common";
import { generateSecret, generateURI, verifySync } from "otplib";
import * as QRCode from "qrcode";
import * as crypto from "crypto";
import * as argon2 from "argon2";

@Injectable()
export class MfaService {
  generateSecret(email: string, issuer = "AmdoxERP") {
    const secret = generateSecret();
    const otpauthUrl = generateURI({ secret, label: email, issuer });
    return { secret, otpauthUrl };
  }

  async generateQrCode(otpauthUrl: string): Promise<string> {
    return QRCode.toDataURL(otpauthUrl);
  }

  verifyToken(token: string, secret: string): boolean {
    try {
      const result = verifySync({ token, secret });
      return result.valid;
    } catch {
      return false;
    }
  }

  async generateRecoveryCodes(): Promise<{
    plaintext: string[];
    hashes: string[];
  }> {
    const plaintext: string[] = [];
    const hashes: string[] = [];

    for (let i = 0; i < 10; i++) {
      const code = crypto.randomBytes(4).toString("hex").toUpperCase(); // 8 characters
      plaintext.push(code);
      const hash = await argon2.hash(code);
      hashes.push(hash);
    }
    return { plaintext, hashes };
  }

  async verifyRecoveryCode(
    code: string,
    hashes: string[],
  ): Promise<{ isValid: boolean; remainingHashes: string[] }> {
    const normalizedCode = code.trim().toUpperCase();
    for (let i = 0; i < hashes.length; i++) {
      const match = await argon2.verify(hashes[i], normalizedCode);
      if (match) {
        const remainingHashes = [...hashes];
        remainingHashes.splice(i, 1);
        return { isValid: true, remainingHashes };
      }
    }
    return { isValid: false, remainingHashes: hashes };
  }
}
