import ContactForm from "./ContactForm";

export const metadata = {
  title: "Contact — Humans on Planet Earth",
};

export default function ContactPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1
        className="text-4xl font-normal mb-6"
        style={{ color: "var(--forest)" }}
      >
        Contact
      </h1>
      <p
        className="text-base leading-relaxed mb-10"
        style={{ color: "var(--ink)" }}
      >
        Send a message to the site. Sharing your email is optional and only used
        to reply to you.
      </p>
      <ContactForm />
    </div>
  );
}
