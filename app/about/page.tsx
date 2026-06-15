import Link from "next/link";

export const metadata = {
  title: "About — Humans on Planet Earth",
};

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1
        className="text-4xl font-normal mb-10"
        style={{ color: "var(--forest)" }}
      >
        About
      </h1>

      <div className="space-y-6 text-base leading-relaxed" style={{ color: "var(--ink)" }}>
        <p>
          Humanity's greatest joy is to think creatively. The Word Of Them Month is your invitation to explore your own mind. 
        </p>
        <p>
          There is only one restriction, it has to fit on one page as a pdf
        </p>
        <p>
          Every submission is published anonymously, credited as{" "}
          <em>Human On Planet Earth</em>. No names. No credentials. No institution.
          Just a human, writing.
        </p>
        <p>
          Visitors can read the collection and discuss each paper in the comments — also
          anonymously. The conversation belongs to everyone.
        </p>

        <hr style={{ borderColor: "var(--border)" }} className="my-8" />

        <h2 className="text-xl font-normal" style={{ color: "var(--forest)" }}>
          Long-Form Writing
        </h2>
        <p>
          If one page isn&apos;t enough, the long-form section accepts writing of any length,
          on any topic, at any time. No monthly word, no page limit.
        </p>

        <hr style={{ borderColor: "var(--border)" }} className="my-8" />

        <h2 className="text-xl font-normal" style={{ color: "var(--forest)" }}>
          How to participate
        </h2>
        <ol
          className="list-decimal list-inside space-y-2"
          style={{ fontFamily: "system-ui, sans-serif", fontSize: "0.9rem" }}
        >
          <li>Write about the current word of the month — one page, saved as a PDF.</li>
          <li>
            Go to the{" "}
            <Link href="/submit" style={{ color: "var(--terracotta)" }} className="underline underline-offset-4">
              Submit
            </Link>{" "}
            page and upload your PDF.
          </li>
          <li>Your paper will be reviewed and published anonymously.</li>
        </ol>
      </div>
    </div>
  );
}
