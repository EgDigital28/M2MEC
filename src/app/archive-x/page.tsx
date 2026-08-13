import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Capabilities } from "@/components/Capabilities";
import { Approach } from "@/components/Approach";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "M2MEC Archive",
  description: "Archived snapshot of the original M2MEC marketing site.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ArchivePage() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Capabilities />
        <Approach />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
