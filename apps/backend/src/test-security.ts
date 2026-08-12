/* eslint-disable */
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import * as argon2 from "argon2";
import { generateSync } from "otplib";
import {
  PrismaClient,
  UserStatus,
} from "@amdox/database/generated";
import { INestApplication, ValidationPipe } from "@nestjs/common";

const prisma = new PrismaClient();

async function runTests() {
  console.log("Starting NestJS application for Security E2E integration tests...");
  const app: INestApplication = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.setGlobalPrefix("api", { exclude: ["health"] });
  await app.listen(3033);

  const baseUrl = "http://localhost:3033/api";

  function assert(condition: boolean, message: string) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  console.log("Cleaning database tables for security test...");
  await prisma.securityEvent.deleteMany({});
  await prisma.loginHistory.deleteMany({});
  await prisma.trustedDevice.deleteMany({});
  await prisma.passwordHistory.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.userRole.deleteMany({
    where: {
      user: {
        email: { in: ["security.test@amdox.com", "mfa.test@amdox.com", "lockout.test@amdox.com"] }
      }
    }
  });
  await prisma.user.deleteMany({
    where: {
      email: { in: ["security.test@amdox.com", "mfa.test@amdox.com", "lockout.test@amdox.com"] }
    }
  });

  const tenantId = "00000000-0000-0000-0000-000000000000";

  // --- 1. Registration & Email Verification ---
  console.log("Scenario 1: Registration and Email Verification...");

  // Try registration with weak password (fails 400)
  const weakRegRes = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "security.test@amdox.com",
      username: "security_test",
      password: "123", // Weak password
    }),
  });
  assert(weakRegRes.status === 400, "Registration with weak password must fail");

  // Correct strength (succeeds)
  const regRes = await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "security.test@amdox.com",
      username: "security_test",
      password: "Password_1234_Special!",
    }),
  });
  assert(regRes.status === 200, "Registration with strong password must succeed");
  const regData = await regRes.json();
  const verificationToken = regData.verificationToken;
  assert(!!verificationToken, "Should return verification token");

  // Verify login fails because email is not verified yet
  const loginBeforeVerifyRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "security.test@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(loginBeforeVerifyRes.status === 403, "Login should fail with 403 before email verification");
  const loginBeforeVerifyErr = await loginBeforeVerifyRes.json();
  assert(loginBeforeVerifyErr.message === "EMAIL_NOT_VERIFIED", "Should report email not verified");

  // Resend verification
  const resendRes = await fetch(`${baseUrl}/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "security.test@amdox.com",
    }),
  });
  assert(resendRes.status === 200, "Resending verification email must succeed");
  const resentToken = (await resendRes.json()).verificationToken;
  assert(!!resentToken, "Should generate a new token");

  // Verify email using token
  const verifyRes = await fetch(`${baseUrl}/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: resentToken,
    }),
  });
  assert(verifyRes.status === 200, "Verifying email must succeed");

  // Try verification again with same token (fails)
  const verifyAgainRes = await fetch(`${baseUrl}/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: resentToken,
    }),
  });
  assert(verifyAgainRes.status === 400, "Verifying again with used token must fail");

  // Login now succeeds
  const loginSuccessRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "security.test@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(loginSuccessRes.status === 200, "Login must succeed after email verification");
  const tokens = await loginSuccessRes.json();
  let userToken = tokens.accessToken;
  let userHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${userToken}`,
  };

  // --- 2. Email Change Verification ---
  console.log("Scenario 2: Email Change Verification...");
  const user = await prisma.user.findFirst({ where: { email: "security.test@amdox.com" } });
  assert(!!user, "User must exist");

  const initiateChangeRes = await fetch(`${baseUrl}/auth/email/change`, {
    method: "POST",
    headers: userHeaders,
    body: JSON.stringify({
      newEmail: "new.email@amdox.com",
      expectedVersion: user!.version,
    }),
  });
  assert(initiateChangeRes.status === 200, "Initiating email change succeeds");
  const changeToken = (await initiateChangeRes.json()).emailChangeToken;

  const confirmChangeRes = await fetch(`${baseUrl}/auth/email/change/confirm`, {
    method: "POST",
    headers: userHeaders,
    body: JSON.stringify({
      token: changeToken,
    }),
  });
  assert(confirmChangeRes.status === 200, "Confirming email change succeeds");

  const userAfterChange = await prisma.user.findUnique({ where: { id: user!.id } });
  assert(userAfterChange!.email === "new.email@amdox.com", "Email must be updated to new email");

  // Revert email back for convenience
  await prisma.user.update({
    where: { id: user!.id },
    data: { email: "security.test@amdox.com", pendingEmail: null, emailChangeToken: null, emailChangeTokenExpires: null },
  });

  // --- 3. Password Management & Expiration ---
  console.log("Scenario 3: Password Expiration & History...");

  // Forgot password
  const forgotRes = await fetch(`${baseUrl}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "security.test@amdox.com",
    }),
  });
  assert(forgotRes.status === 200, "Forgot password succeeds");
  const resetToken = (await forgotRes.json()).resetPasswordToken;

  // Reset password to weak (fails)
  const resetWeakRes = await fetch(`${baseUrl}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: resetToken,
      newPassword: "123",
      confirmPassword: "123",
    }),
  });
  assert(resetWeakRes.status === 400, "Weak password reset must fail");

  // Reset password to a recently used password (fails because of password history)
  const resetUsedRes = await fetch(`${baseUrl}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: resetToken,
      newPassword: "Password_1234_Special!", // Matches current password
      confirmPassword: "Password_1234_Special!",
    }),
  });
  assert(resetUsedRes.status === 400, "Resetting to a recently used password must fail");

  // Reset to a new strong password (succeeds)
  const resetSuccessRes = await fetch(`${baseUrl}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: resetToken,
      newPassword: "New_Password_1234!",
      confirmPassword: "New_Password_1234!",
    }),
  });
  assert(resetSuccessRes.status === 200, "Reset password succeeds");

  // Login with new password
  const newLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "security.test@amdox.com",
      password: "New_Password_1234!",
    }),
  });
  assert(newLoginRes.status === 200, "Login must succeed with new password");
  const newTokens = await newLoginRes.json();
  userToken = newTokens.accessToken;
  userHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${userToken}`,
  };

  // Change Password
  const changePassRes = await fetch(`${baseUrl}/auth/change-password`, {
    method: "POST",
    headers: userHeaders,
    body: JSON.stringify({
      oldPassword: "New_Password_1234!",
      newPassword: "Another_New_Password_1234!",
      confirmPassword: "Another_New_Password_1234!",
    }),
  });
  assert(changePassRes.status === 200, "Change password succeeds");

  // Expiration Check: Mock expiration date in DB
  const dbUser = await prisma.user.findFirst({ where: { email: "security.test@amdox.com" } });
  await prisma.user.update({
    where: { id: dbUser!.id },
    data: { passwordExpiresAt: new Date(Date.now() - 1000) }, // Expired
  });

  const expiredLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "security.test@amdox.com",
      password: "Another_New_Password_1234!",
    }),
  });
  assert(expiredLoginRes.status === 403, "Expired password login must fail");
  const expiredLoginErr = await expiredLoginRes.json();
  assert(expiredLoginErr.message === "PASSWORD_EXPIRED", "Message should be PASSWORD_EXPIRED");

  // Restore password expiration for other tests
  await prisma.user.update({
    where: { id: dbUser!.id },
    data: { passwordExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) },
  });

  // --- 4. MFA setup, enable, verify, and disable ---
  console.log("Scenario 4: MFA Flow...");
  // Login to get fresh tokens
  const mfaUserLogin = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "security.test@amdox.com",
      password: "Another_New_Password_1234!",
    }),
  });
  userToken = (await mfaUserLogin.json()).accessToken;
  userHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${userToken}`,
  };

  // Setup MFA
  const mfaSetupRes = await fetch(`${baseUrl}/auth/mfa/setup`, { headers: userHeaders });
  assert(mfaSetupRes.status === 200, "MFA setup call succeeds");
  const mfaSetup = await mfaSetupRes.json();
  const mfaSecret = mfaSetup.secret;
  assert(!!mfaSecret, "TOTP secret must be returned");

  // Get current user version
  const freshUser = await prisma.user.findFirst({ where: { email: "security.test@amdox.com" } });

  // Generate TOTP token for secret using generateSync
  const mfaCode = generateSync({ secret: mfaSecret });

  // Enable MFA
  const mfaEnableRes = await fetch(`${baseUrl}/auth/mfa/enable?secret=${mfaSecret}`, {
    method: "POST",
    headers: userHeaders,
    body: JSON.stringify({
      code: mfaCode,
      expectedVersion: freshUser!.version,
    }),
  });
  assert(mfaEnableRes.status === 200, "Enabling MFA succeeds");
  const mfaEnableData = await mfaEnableRes.json();
  const recoveryCodes = mfaEnableData.recoveryCodes;
  assert(recoveryCodes.length === 10, "Should generate 10 recovery codes");

  // Login with credentials -> should require MFA
  const loginMfaRequiredRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "security.test@amdox.com",
      password: "Another_New_Password_1234!",
    }),
  });
  assert(loginMfaRequiredRes.status === 200, "MFA-enabled login credentials succeeds");
  const loginMfaData = await loginMfaRequiredRes.json();
  assert(loginMfaData.mfaRequired === true, "Should require MFA");
  const mfaRequiredToken = loginMfaData.mfaRequiredToken;

  // Verify TOTP
  const verifyTotpRes = await fetch(`${baseUrl}/auth/mfa/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mfaRequiredToken,
      code: generateSync({ secret: mfaSecret }),
    }),
  });
  assert(verifyTotpRes.status === 200, "Verifying TOTP code succeeds");
  const verifiedTokens = await verifyTotpRes.json();
  assert(!!verifiedTokens.accessToken, "Should return verified access token");

  // Login again, test backup recovery code usage
  const loginMfaRequiredRes2 = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "security.test@amdox.com",
      password: "Another_New_Password_1234!",
    }),
  });
  const mfaRequiredToken2 = (await loginMfaRequiredRes2.json()).mfaRequiredToken;

  const recoveryCodeToUse = recoveryCodes[0];
  const verifyRecoveryRes = await fetch(`${baseUrl}/auth/mfa/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mfaRequiredToken: mfaRequiredToken2,
      code: recoveryCodeToUse,
    }),
  });
  assert(verifyRecoveryRes.status === 200, "Verifying recovery code succeeds");

  // Verify recovery code was removed from user
  const dbUserMfa = await prisma.user.findFirst({ where: { email: "security.test@amdox.com" } });
  assert(dbUserMfa!.mfaRecoveryCodes.length === 9, "Recovery code should be consumed and removed");

  // Disable MFA
  const userAfterMfaLogin = await prisma.user.findFirst({ where: { email: "security.test@amdox.com" } });
  const disableMfaRes = await fetch(`${baseUrl}/auth/mfa/disable`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${verifiedTokens.accessToken}`,
    },
    body: JSON.stringify({
      code: generateSync({ secret: mfaSecret }),
      expectedVersion: userAfterMfaLogin!.version,
    }),
  });
  assert(disableMfaRes.status === 200, "Disabling MFA succeeds");

  // --- 5. Login Security & Lockout ---
  console.log("Scenario 5: Account Lockout & Rate limiting...");
  // Register another user
  await fetch(`${baseUrl}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "lockout.test@amdox.com",
      username: "lockout_test",
      password: "Password_1234_Special!",
    }),
  });

  const checkUser = await prisma.user.findFirst({ where: { email: "lockout.test@amdox.com" } });
  await prisma.user.update({
    where: { id: checkUser!.id },
    data: { emailVerified: true },
  });

  // Make 5 failed attempts
  for (let i = 0; i < 5; i++) {
    await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "lockout.test@amdox.com",
        password: "WrongPassword123!",
      }),
    });
  }

  // Next login attempt (fails with 403 ACCOUNT_LOCKED)
  const lockedRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "lockout.test@amdox.com",
      password: "Password_1234_Special!",
    }),
  });
  assert(lockedRes.status === 403, "Login on locked account must fail");
  const lockedErr = await lockedRes.json();
  assert(lockedErr.message === "ACCOUNT_LOCKED", "Error message should be ACCOUNT_LOCKED");

  // --- 6. Session & Device Management ---
  console.log("Scenario 6: Sessions & Devices...");
  const normalLoginRes = await fetch(`${baseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "security.test@amdox.com",
      password: "Another_New_Password_1234!",
    }),
  });
  const loginTokens = await normalLoginRes.json();
  const sessionToken = loginTokens.accessToken;
  const sessionHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${sessionToken}`,
  };

  // Get active sessions
  const activeSessionsRes = await fetch(`${baseUrl}/auth/sessions/active`, { headers: sessionHeaders });
  assert(activeSessionsRes.status === 200, "Fetching active sessions succeeds");
  const sessionList = await activeSessionsRes.json();
  assert(sessionList.data.length > 0, "Active sessions list is not empty");

  // Trust Device
  const trustRes = await fetch(`${baseUrl}/auth/devices/trust`, {
    method: "POST",
    headers: sessionHeaders,
    body: JSON.stringify({
      fingerprint: "test-fingerprint-123",
      details: "Chrome on Windows Desktop",
    }),
  });
  assert(trustRes.status === 200, "Trusting device succeeds");

  // Untrust Device
  const untrustRes = await fetch(`${baseUrl}/auth/devices/trust/test-fingerprint-123`, {
    method: "DELETE",
    headers: sessionHeaders,
  });
  assert(untrustRes.status === 200, "Untrusting device succeeds");

  // Revoke other session
  const targetSession = sessionList.data[0];
  const revokeRes = await fetch(`${baseUrl}/auth/sessions/${targetSession.id}`, {
    method: "DELETE",
    headers: sessionHeaders,
  });
  assert(revokeRes.status === 200, "Revoking active session succeeds");

  // --- 7. Security Audit Verification ---
  console.log("Scenario 7: Audit Events...");
  const userA = await prisma.user.findFirst({ where: { email: "security.test@amdox.com" } });
  const audits = await prisma.auditLog.findMany({
    where: { tenantId: userA!.tenantId },
  });
  const actions = audits.map((a) => a.action);

  console.log("Triggered audit actions list:", actions);
  assert(actions.includes("USER_REGISTERED"), "Must log USER_REGISTERED event");
  assert(actions.includes("EMAIL_VERIFIED"), "Must log EMAIL_VERIFIED event");
  assert(actions.includes("PASSWORD_CHANGED") || actions.includes("PASSWORD_RESET"), "Must log password change/reset event");
  assert(actions.includes("MFA_ENABLED"), "Must log MFA_ENABLED event");
  assert(actions.includes("MFA_DISABLED"), "Must log MFA_DISABLED event");
  assert(actions.includes("LOGIN_SUCCESS"), "Must log LOGIN_SUCCESS event");

  // Health Endpoint
  const healthRes = await fetch("http://localhost:3033/health");
  assert(healthRes.status === 200, "Health check succeeds");

  console.log("==================================================");
  console.log("ALL ENTERPRISE SECURITY INTEGRATION TESTS PASSED!");
  console.log("==================================================");

  await app.close();
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
