"use client";

import { FormEvent, useState } from "react";

type WaitlistFormProps = {
  placeholder: string;
};

type FormStatus = "idle" | "submitting" | "success" | "error";

export function WaitlistForm({ placeholder }: WaitlistFormProps) {
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      message: String(formData.get("message") ?? ""),
    };

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setErrorMessage(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }

      setStatus("success");
      event.currentTarget.reset();
    } catch {
      setErrorMessage("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex h-full min-h-[320px] flex-col justify-center rounded-2xl border border-accent/20 bg-accent/5 p-8 text-center">
        <p className="text-sm font-medium uppercase tracking-widest text-accent">
          You&apos;re on the list
        </p>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight">
          Check your inbox
        </h3>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          We sent a welcome note with what to expect next. No account was
          created — this is the early access waitlist only.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-8 text-sm text-accent transition-colors hover:underline"
        >
          Submit another response
        </button>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoComplete="name"
          disabled={status === "submitting"}
          className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-accent/50 focus:ring-1 focus:ring-accent/30 disabled:opacity-60"
          placeholder="Jane Smith"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          disabled={status === "submitting"}
          className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-accent/50 focus:ring-1 focus:ring-accent/30 disabled:opacity-60"
          placeholder="jane@example.com"
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          required
          disabled={status === "submitting"}
          className="mt-2 w-full resize-none rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-accent/50 focus:ring-1 focus:ring-accent/30 disabled:opacity-60"
          placeholder={placeholder}
        />
      </div>

      {errorMessage && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-xl bg-gradient-to-r from-accent to-accent-secondary py-3.5 text-sm font-medium text-white shadow-lg shadow-accent/20 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "submitting" ? "Joining waitlist..." : "Join early access"}
      </button>

      <p className="text-center text-xs text-muted">
        Join the waitlist only — no login is created. We&apos;ll email you when
        access opens.
      </p>
    </form>
  );
}
