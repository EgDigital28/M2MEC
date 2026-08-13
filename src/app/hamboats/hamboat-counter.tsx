"use client";

import { useState } from "react";

export function HamboatCounter() {
  const [count, setCount] = useState(0);
  const [status, setStatus] = useState(
    "No hamboats acquired yet. The night is young. The roller grill is warm.",
  );

  function acquireHamboat() {
    setCount((current) => current + 1);
    const messages = [
      "SUCCESS: One (1) hamboat secured from Pump #3.",
      "ALERT: Hamboat was lukewarm. Still counts. Legally binding.",
      "CONFIRMED: Cashier did not ask questions. Professional.",
      "UPDATE: Two hamboats touching. This is called a flotilla.",
      "WARNING: Freezer hamboat acquired. Handle with oven mitts.",
      "STATUS: You now own more hamboats than most municipalities.",
    ];
    setStatus(messages[Math.floor(Math.random() * messages.length)]);
  }

  function locateHamboats() {
    const locations = [
      "7-Eleven on Route 9 — roller grill humming ominously",
      "Wawa — freezer section, behind the taquitos",
      "Sheetz — ask for the secret hamboat drawer (they will deny it)",
      "Local Citgo — bathroom key also unlocks the hamboat vault",
      "Love's Travel Stop — premium hamboats near the air pump",
    ];
    setStatus(`NEAREST SOURCE: ${locations[Math.floor(Math.random() * locations.length)]}`);
  }

  return (
    <div className="panel">
      <h2>Hamboat acquisition console</h2>
      <p>
        Press the buttons. Do not think about it too hard. That&apos;s how you
        lose the hamboat.
      </p>
      <div className="cta-row">
        <button className="ham-btn" type="button" onClick={acquireHamboat}>
          Acquire hamboat
        </button>
        <button
          className="ham-btn ham-btn-secondary"
          type="button"
          onClick={locateHamboats}
        >
          Locate gas station hamboats
        </button>
      </div>
      <div className="status-box">
        <div>{status}</div>
        <div className="counter">{count} hamboat{count === 1 ? "" : "s"}</div>
      </div>
    </div>
  );
}
