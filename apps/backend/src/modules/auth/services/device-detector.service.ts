import { Injectable } from "@nestjs/common";
import { UAParser } from "ua-parser-js";
import * as crypto from "crypto";

@Injectable()
export class DeviceDetectorService {
  parseUserAgent(userAgent: string) {
    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    const device = parser.getDevice();

    const browserName = browser.name || "Unknown Browser";
    const osName = os.name || "Unknown OS";
    const deviceType = device.type || "desktop";

    return {
      browser: browserName,
      os: osName,
      device: deviceType,
      details: `${browserName} on ${osName} (${deviceType})`,
    };
  }

  generateFingerprint(ipAddress: string, userAgent: string): string {
    return crypto
      .createHash("sha256")
      .update(`${ipAddress}|${userAgent}`)
      .digest("hex");
  }
}
