import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.hoisted(() => vi.fn());
const batchSendMock = vi.hoisted(() => vi.fn());

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendMock };
    batch = { send: batchSendMock };
  },
}));

import { sendEmail, sendBatch, type EmailMessage } from "@/lib/email";

function message(n: number): EmailMessage {
  return { to: `reader${n}@test.example`, subject: `Subject ${n}`, text: `Body ${n}` };
}

beforeEach(() => {
  sendMock.mockResolvedValue({ data: { id: "email-id" }, error: null });
  batchSendMock.mockResolvedValue({ data: null, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  sendMock.mockReset();
  batchSendMock.mockReset();
  vi.restoreAllMocks();
});

describe("sendEmail", () => {
  it("sends with the configured from address and returns true", async () => {
    const ok = await sendEmail(message(1));

    expect(ok).toBe(true);
    expect(sendMock).toHaveBeenCalledWith({
      from: "HOPE <notify@test.example>",
      to: "reader1@test.example",
      subject: "Subject 1",
      text: "Body 1",
    });
  });

  it("returns false when Resend reports an error", async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: "invalid recipient" } });
    expect(await sendEmail(message(1))).toBe(false);
  });

  it("returns false when the send throws", async () => {
    sendMock.mockRejectedValue(new Error("network down"));
    expect(await sendEmail(message(1))).toBe(false);
  });
});

describe("sendBatch", () => {
  it("does not call Resend for an empty list", async () => {
    expect(await sendBatch([])).toBe(0);
    expect(batchSendMock).not.toHaveBeenCalled();
  });

  it("sends one chunk when at the 100-message limit", async () => {
    const messages = Array.from({ length: 100 }, (_, i) => message(i));

    expect(await sendBatch(messages)).toBe(100);
    expect(batchSendMock).toHaveBeenCalledTimes(1);
    expect(batchSendMock.mock.calls[0][0]).toHaveLength(100);
  });

  it("splits 250 messages into chunks of 100/100/50", async () => {
    const messages = Array.from({ length: 250 }, (_, i) => message(i));

    expect(await sendBatch(messages)).toBe(250);
    expect(batchSendMock).toHaveBeenCalledTimes(3);
    expect(batchSendMock.mock.calls.map((c) => c[0].length)).toEqual([100, 100, 50]);
    // Chunks preserve order and carry the from address on every entry.
    expect(batchSendMock.mock.calls[2][0][49]).toEqual({
      from: "HOPE <notify@test.example>",
      to: "reader249@test.example",
      subject: "Subject 249",
      text: "Body 249",
    });
  });

  it("skips a failed chunk's count but still sends the rest", async () => {
    batchSendMock
      .mockResolvedValueOnce({ data: null, error: { message: "rate limited" } })
      .mockResolvedValueOnce({ data: null, error: null });
    const messages = Array.from({ length: 150 }, (_, i) => message(i));

    expect(await sendBatch(messages)).toBe(50);
    expect(batchSendMock).toHaveBeenCalledTimes(2);
  });

  it("survives a chunk that throws and continues with the next", async () => {
    batchSendMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({ data: null, error: null });
    const messages = Array.from({ length: 150 }, (_, i) => message(i));

    expect(await sendBatch(messages)).toBe(50);
    expect(batchSendMock).toHaveBeenCalledTimes(2);
  });
});
