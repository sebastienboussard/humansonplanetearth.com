import LongFormSubmitForm from "./LongFormSubmitForm";

export const metadata = {
  title: "Submit Long-Form — Humans on Planet Earth",
};

export default function LongFormSubmitPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-normal mb-4" style={{ color: "var(--forest)" }}>
        Submit a Long-Form Paper
      </h1>
      <p
        className="text-sm mb-10"
        style={{ fontFamily: "system-ui, sans-serif", color: "var(--muted)" }}
      >
        Any length. Any topic. Any time. Published anonymously as{" "}
        <em>Human On Planet Earth</em>.
      </p>

      <LongFormSubmitForm />
    </div>
  );
}
