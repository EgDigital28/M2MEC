import type { Metadata } from "next";
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

export default function HamboatsLayout({
  children,
}: LayoutProps<"/hamboats">) {
  return children;
}
