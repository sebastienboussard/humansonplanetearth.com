import Link from "next/link";

export const metadata = {
  title: "Privacy — Humans on Planet Earth",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1
        className="text-4xl font-normal mb-10"
        style={{ color: "var(--forest)" }}
      >
        Privacy & Terms
      </h1>

      <div className="space-y-6 text-base leading-relaxed" style={{ color: "var(--ink)" }}>
        <h2 className="text-xl font-normal" style={{ color: "var(--forest)" }}>
          Your identity is protected
        </h2>
        <p>
          No names, no tracking, and no account required. When you submit a paper
          anonymously, we store only the PDF and the word you wrote about. Nothing
          is attached to you.
        </p>

        <hr style={{ borderColor: "var(--border)" }} className="my-8" />

        <h2 className="text-xl font-normal" style={{ color: "var(--forest)" }}>
          How your paper is published
        </h2>
        <p>
          Every paper is published anonymously under the shared byline{" "}
          <em>Human On Planet Earth</em>. You will not be individually credited,
          and we will not reveal that you were the author.
        </p>

        <hr style={{ borderColor: "var(--border)" }} className="my-8" />

        <h2 className="text-xl font-normal" style={{ color: "var(--forest)" }}>
          How your paper may be re-used
        </h2>
        <p>
          By submitting, you grant Humans on Planet Earth a perpetual, worldwide,
          royalty-free license to publish, reproduce, distribute, and sell your
          paper — including in collected works such as books, anthologies, and
          printed editions — under the site&apos;s name and the shared byline{" "}
          <em>Human On Planet Earth</em>. You keep authorship of your own writing;
          the site may compile and sell it.
        </p>

        <hr style={{ borderColor: "var(--border)" }} className="my-8" />

        <h2 className="text-xl font-normal" style={{ color: "var(--forest)" }}>
          Comments
        </h2>
        <p>
          Comments are anonymous and public. Please don&apos;t post anything that
          could identify you or someone else.
        </p>

        <hr style={{ borderColor: "var(--border)" }} className="my-8" />

        <h2 className="text-xl font-normal" style={{ color: "var(--forest)" }}>
          Contact
        </h2>
        <p>
          Use the{" "}
          <Link href="/contact" style={{ color: "var(--terracotta)" }} className="underline underline-offset-4">
            Contact
          </Link>{" "}
          page to reach the site. Sharing your email is optional and only used
          to reply to you.
        </p>

        <hr style={{ borderColor: "var(--border)" }} className="my-8" />

        <p className="italic" style={{ color: "var(--muted)" }}>
          Proceeds go to the betterment of Humans on Planet Earth.
        </p>
      </div>
    </div>
  );
}
