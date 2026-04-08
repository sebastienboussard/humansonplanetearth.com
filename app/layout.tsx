import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Humans on Planet Earth",
  description: "A word is chosen each month. Anyone can write about it.",
  openGraph: {
    title: "Humans on Planet Earth",
    description: "A word is chosen each month. Anyone can write about it.",
    url: "https://humansonplanetearth.com",
    siteName: "Humans on Planet Earth",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
