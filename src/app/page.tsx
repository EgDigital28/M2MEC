import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Capabilities } from "@/components/Capabilities";
import { Approach } from "@/components/Approach";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";

export default function Home() {
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
