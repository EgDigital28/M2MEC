import type { Metadata } from "next";
import Link from "next/link";
import { HamboatCounter } from "./hamboat-counter";
import "./hamboats.css";

export const metadata: Metadata = {
  title: "Official Hamboat Guide | Gas Station Division",
  description:
    "Classified documentation for the procurement, handling, and responsible enjoyment of gas station hamboats.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function HamboatsPage() {
  return (
    <div className="hamboats-page">
      <div className="hamboats-shell">
        <section className="hero-card">
          <span className="hero-badge">Est. pump #4 · always open</span>
          <h1>
            Hamboats
            <span>from a gas station</span>
          </h1>
          <p className="tagline">
            The authoritative field guide for obtaining, transporting, and
            emotionally processing gas station hamboats.
          </p>
        </section>

        <section className="panel">
          <h2>What is a hamboat?</h2>
          <p>
            A hamboat is not a sandwich. It is not a boat. It is a{" "}
            <strong>state of mind</strong> that occurs when you are standing
            near a gas station roller grill at 11:47 PM, spiritually ready to
            make a decision that will define your week.
          </p>
          <p>
            Scientists refuse to classify hamboats. Gas station managers insist
            they&apos;ve never heard the term. Your friend absolutely knows what
            they are. That is all the proof we need.
          </p>
        </section>

        <section className="panel">
          <h2>How to get hamboats (official procedure)</h2>
          <ol className="steps">
            <li>
              <strong>Pull in.</strong> Pretend you only need gas. This is a
              lie and everyone knows it.
            </li>
            <li>
              <strong>Locate the hamboat zone.</strong> Usually near hot dogs,
              taquitos, or a humming glass case that glows like a minor deity.
            </li>
            <li>
              <strong>Make eye contact with the roller grill.</strong> If it
              rotates confidently, that is a good omen.
            </li>
            <li>
              <strong>Order with confidence.</strong> Say &ldquo;I&apos;ll take
              the hamboats&rdquo; like you do this every Tuesday. Do not explain
              yourself.
            </li>
            <li>
              <strong>Eat in the parking lot.</strong> This is tradition. The
              hamboat tastes 14% better under fluorescent light and mild regret.
            </li>
          </ol>
        </section>

        <HamboatCounter />

        <section className="panel">
          <h2>Hamboat quality grades</h2>
          <div className="grade-grid">
            <div className="grade">
              <span>A+</span>
              <small>Fresh roller grill</small>
            </div>
            <div className="grade">
              <span>B</span>
              <small>Freezer, but hopeful</small>
            </div>
            <div className="grade">
              <span>C-</span>
              <small>Still rotating somehow</small>
            </div>
            <div className="grade">
              <span>?</span>
              <small>Mystery bin by coffee</small>
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>Frequently unasked questions</h2>
          <dl className="faq">
            <dt>Are hamboats legal?</dt>
            <dd>
              In most counties, yes, as long as you do not call them hamboats at
              the counter.
            </dd>
            <dt>Can I put hamboats in my car&apos;s cup holder?</dt>
            <dd>
              Only if your car is emotionally prepared for that kind of
              commitment.
            </dd>
            <dt>What pairs well with hamboats?</dt>
            <dd>
              A fountain drink the size of a fire extinguisher and zero plans
              for tomorrow morning.
            </dd>
            <dt>Is this page linked from the main M2MEC site?</dt>
            <dd>
              No. You found the secret hatch. Tell no one. (Unless it&apos;s
              funny.)
            </dd>
          </dl>
        </section>

        <section className="panel">
          <h2>Verified testimonial</h2>
          <blockquote className="testimonial">
            &ldquo;I went in for windshield washer fluid and came out with three
            hamboats and a new personality. 10/10 would gas station again.&rdquo;
            <cite>— A satisfied pump island customer</cite>
          </blockquote>
        </section>

        <p className="disclaimer">
          This page is a temporary gag and not affiliated with any real gas
          station, ham product, or maritime vessel.{" "}
          <Link href="/">Return to respectable M2MEC business</Link> if you
          accidentally wandered here on purpose.
        </p>
      </div>
    </div>
  );
}
