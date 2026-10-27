import { describe, expect, it } from "vitest";
import { orderWordQueue, type WaitingProposal } from "@/lib/word-queue";
import { isValidWord, normalizeWord } from "@/lib/word-format";

let n = 0;
function p(profile: string, word: string, created_at: string): WaitingProposal {
  return { id: `id-${String(++n).padStart(3, "0")}`, profile_id: profile, word, created_at };
}

describe("orderWordQueue", () => {
  it("puts everyone's first waiting word before anyone's second (TODO §20's example)", () => {
    // Ana proposed tide then salt; tide was used. Ben then proposed ash.
    // Only waiting words reach the queue, so salt is now Ana's round 1.
    const queue = orderWordQueue([
      p("ana", "salt", "2026-09-02T00:00:00Z"),
      p("ben", "ash", "2026-09-03T00:00:00Z"),
    ]);
    expect(queue.map((q) => [q.word, q.round])).toEqual([["salt", 1], ["ash", 1]]);
  });

  it("orders rounds before age", () => {
    const queue = orderWordQueue([
      p("ana", "tide", "2026-09-01T00:00:00Z"),
      p("ana", "salt", "2026-09-02T00:00:00Z"),
      p("ana", "moss", "2026-09-03T00:00:00Z"),
      p("ben", "ash", "2026-09-10T00:00:00Z"),
    ]);
    expect(queue.map((q) => q.word)).toEqual(["tide", "ash", "salt", "moss"]);
    expect(queue.map((q) => q.round)).toEqual([1, 1, 2, 3]);
  });

  it("handles one account holding all three rounds", () => {
    const queue = orderWordQueue([
      p("ana", "moss", "2026-09-03T00:00:00Z"),
      p("ana", "tide", "2026-09-01T00:00:00Z"),
      p("ana", "salt", "2026-09-02T00:00:00Z"),
    ]);
    expect(queue.map((q) => [q.word, q.round])).toEqual([["tide", 1], ["salt", 2], ["moss", 3]]);
  });

  it("breaks a created_at tie on id, so the order is stable", () => {
    const same = "2026-09-01T00:00:00Z";
    const a = { id: "b-id", profile_id: "ana", word: "tide", created_at: same };
    const b = { id: "a-id", profile_id: "ben", word: "ash", created_at: same };
    expect(orderWordQueue([a, b]).map((q) => q.word)).toEqual(["ash", "tide"]);
    expect(orderWordQueue([b, a]).map((q) => q.word)).toEqual(["ash", "tide"]);
  });

  it("returns an empty queue for no waiting words", () => {
    expect(orderWordQueue([])).toEqual([]);
  });

  it("never carries who proposed a word", () => {
    const [entry] = orderWordQueue([p("ana", "tide", "2026-09-01T00:00:00Z")]);
    expect(Object.keys(entry).sort()).toEqual(["created_at", "id", "round", "word"]);
  });

  it("does not reorder the array it was given", () => {
    const input = [p("ana", "moss", "2026-09-03T00:00:00Z"), p("ana", "tide", "2026-09-01T00:00:00Z")];
    const copy = [...input];
    orderWordQueue(input);
    expect(input).toEqual(copy);
  });
});

describe("normalizeWord / isValidWord", () => {
  it("lowercases and trims", () => {
    expect(normalizeWord("  Tide ")).toBe("tide");
    expect(normalizeWord(42)).toBe("");
  });

  it.each(["tide", "ab", "o'er", "well-being", "  Tide  ", "x".repeat(24)])("accepts %j", (w) => {
    expect(isValidWord(w)).toBe(true);
  });

  it.each(["a", "", "tide-", "'tide", "ti de", "t1de", "x".repeat(25), "__long-form__", null, 7])(
    "refuses %j",
    (w) => {
      expect(isValidWord(w)).toBe(false);
    }
  );
});
