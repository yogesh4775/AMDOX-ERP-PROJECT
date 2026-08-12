import { Injectable, BadRequestException } from "@nestjs/common";

@Injectable()
export class PasswordPolicyService {
  validateStrength(password: string) {
    if (password.length < 8) {
      throw new BadRequestException(
        "Password must be at least 8 characters long",
      );
    }
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[\W_]/.test(password);

    if (!hasUppercase || !hasLowercase || !hasDigit || !hasSpecial) {
      throw new BadRequestException(
        "Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character",
      );
    }
  }

  isExpired(passwordExpiresAt: Date | null): boolean {
    if (!passwordExpiresAt) return false;
    return new Date() > passwordExpiresAt;
  }
}
