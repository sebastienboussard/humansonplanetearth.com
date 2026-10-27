import { describe, expect, it } from "vitest";
import { OTP_LENGTH, isValidCode, normalizeCode } from "@/lib/sign-in-code";

describe("sign-in code", () => {
  it("matches this project's Supabase setting of 8 digits", () => {
    // If this fails, the dashboard's Email OTP Length was changed on purpose.
    // Update OTP_LENGTH and this test together, never one alone.
    expect(OTP_LENGTH).toBe(8);
  });

  it("accepts exactly eight digits, with spaces stripped", () => {
    expect(isValidCode("83700407")).toBe(true);
    expect(isValidCode(" 8370 0407 ")).toBe(true);
    expect(normalizeCode(" 8370 0407 ")).toBe("83700407");
  });

  it("refuses anything else", () => {
    for (const bad of ["", "837004", "837004071", "8370-0407", "abcdefgh", null, undefined, 83700407]) {
      expect(isValidCode(bad)).toBe(false);
    }
  });
});
