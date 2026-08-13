export const navLinks = [
  { label: "Capabilities", href: "#capabilities" },
  { label: "Approach", href: "#approach" },
  { label: "Contact", href: "#contact" },
];

export const capabilities = [
  {
    title: "Edge Protocol Bridging",
    description:
      "Translate and normalize protocols at the edge—MQTT, OPC-UA, Modbus, and custom transports—without round-tripping through the cloud.",
    icon: "bridge",
  },
  {
    title: "Deterministic Messaging",
    description:
      "Priority queues, QoS tiers, and bounded latency paths engineered for control loops, telemetry bursts, and fault-tolerant sync.",
    icon: "signal",
  },
  {
    title: "Zero-Trust Device Identity",
    description:
      "Mutual TLS, hardware-backed keys, and policy-driven access so every machine authenticates before it communicates.",
    icon: "shield",
  },
  {
    title: "Offline-First Resilience",
    description:
      "Local buffering, conflict resolution, and store-and-forward so operations continue when uplinks drop or partitions occur.",
    icon: "resilience",
  },
  {
    title: "Observability at the Edge",
    description:
      "Structured logs, trace propagation, and health metrics surfaced locally and aggregated upstream for full pipeline visibility.",
    icon: "observe",
  },
  {
    title: "Fleet Orchestration",
    description:
      "Roll out configs, firmware, and routing policies across thousands of edge nodes with staged canaries and rollback.",
    icon: "fleet",
  },
];

export const approachSteps = [
  {
    step: "01",
    title: "Assess & Map",
    description:
      "Inventory devices, protocols, and latency budgets. Identify edge placement, failure domains, and security boundaries.",
  },
  {
    step: "02",
    title: "Design the Edge Layer",
    description:
      "Define gateway topology, message schemas, and identity model. Prototype critical paths with realistic load profiles.",
  },
  {
    step: "03",
    title: "Deploy & Harden",
    description:
      "Ship to pilot sites with monitoring baked in. Validate failover, certificate rotation, and operator runbooks under stress.",
  },
  {
    step: "04",
    title: "Scale & Optimize",
    description:
      "Expand fleet-wide with automated provisioning. Tune routing, compression, and local compute as traffic patterns evolve.",
  },
];
