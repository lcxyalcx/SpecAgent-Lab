import {
  AgentMode,
  PrismaClient,
  RunStatus,
  ToolCallStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

const seededTasks = [
  {
    slug: "support-refund-resolution",
    title: "Support refund resolution",
    description: "Resolve a refund request with policy checks, order lookup, and escalation rules.",
    category: "tool-use",
    difficulty: 2,
    conversation: [
      "User requests a refund for a delayed shipment.",
      "Agent must inspect order status and refund policy.",
      "Agent should decide whether to approve, deny, or escalate.",
    ],
    evaluationRubric: {
      successDefinition: "Applies policy correctly, explains outcome, and records next step.",
      requiredChecks: ["order.lookup", "policy.match"],
      userCorrectionSignals: ["incorrect policy application", "missing escalation path"],
    },
    expectedTools: ["order.lookup", "policy.match"],
  },
  {
    slug: "supplier-risk-triage",
    title: "Supplier risk triage",
    description: "Classify supplier risk using contract notes, shipment history, and policy guidance.",
    category: "retrieval",
    difficulty: 3,
    conversation: [
      "User asks whether a supplier should be flagged as high risk.",
      "Agent reviews contract clauses, shipment performance, and compliance notes.",
      "Agent produces a recommendation with reasoning.",
    ],
    evaluationRubric: {
      successDefinition: "Identifies risk level and cites the most relevant evidence.",
      requiredChecks: ["knowledge.search", "spreadsheet.lookup"],
      userCorrectionSignals: ["unsupported claim", "ignored compliance signal"],
    },
    expectedTools: ["knowledge.search", "spreadsheet.lookup", "email.draft"],
  },
  {
    slug: "release-readiness-plan",
    title: "Release readiness plan",
    description: "Build a launch readiness plan from open issues, owner availability, and rollout gates.",
    category: "planning",
    difficulty: 4,
    conversation: [
      "PM asks whether a release can launch this week.",
      "Agent inspects unresolved issues and owner status.",
      "Agent returns a go or no-go recommendation with blockers.",
    ],
    evaluationRubric: {
      successDefinition: "Summarizes blockers, owners, and launch decision clearly.",
      requiredChecks: ["issue.search", "calendar.check"],
      userCorrectionSignals: ["missed blocker", "unclear ownership"],
    },
    expectedTools: ["issue.search", "calendar.check", "doc.summarize"],
  },
  {
    slug: "revenue-mismatch-investigation",
    title: "Revenue mismatch investigation",
    description: "Explain a mismatch between two revenue exports and open a follow-up ticket.",
    category: "reasoning",
    difficulty: 5,
    conversation: [
      "Finance reports a mismatch between warehouse and spreadsheet totals.",
      "Agent compares exports, identifies likely cause, and proposes a fix.",
      "Agent opens a ticket for the owning team.",
    ],
    evaluationRubric: {
      successDefinition: "Finds the likely mismatch source and creates an actionable next step.",
      requiredChecks: ["warehouse.query", "spreadsheet.diff"],
      userCorrectionSignals: ["wrong root cause", "no follow-up action"],
    },
    expectedTools: ["warehouse.query", "spreadsheet.diff", "ticket.create"],
  },
  {
    slug: "inbox-prioritization",
    title: "Inbox prioritization",
    description: "Rank customer messages by urgency, revenue impact, and response readiness.",
    category: "planning",
    difficulty: 2,
    conversation: [
      "Manager asks for the top customer emails needing a response.",
      "Agent reviews inbox and account context.",
      "Agent returns a prioritized response queue.",
    ],
    evaluationRubric: {
      successDefinition: "Produces a sensible priority order with concise rationale.",
      requiredChecks: ["mail.search", "crm.lookup"],
      userCorrectionSignals: ["wrong priority order", "ignored account context"],
    },
    expectedTools: ["mail.search", "crm.lookup"],
  },
  {
    slug: "incident-status-brief",
    title: "Incident status brief",
    description: "Prepare a short incident update from logs, open tickets, and timeline notes.",
    category: "reasoning",
    difficulty: 3,
    conversation: [
      "Operations lead asks for a status brief on a live incident.",
      "Agent checks notes, recent errors, and pending tickets.",
      "Agent drafts a concise internal update.",
    ],
    evaluationRubric: {
      successDefinition: "Summarizes status, impact, and next action without speculation.",
      requiredChecks: ["log.search", "ticket.search"],
      userCorrectionSignals: ["invented details", "missing impact summary"],
    },
    expectedTools: ["log.search", "ticket.search", "doc.summarize"],
  },
  {
    slug: "compliance-escalation-check",
    title: "Compliance escalation check",
    description: "Determine whether a customer workflow needs compliance review before approval.",
    category: "tool-use",
    difficulty: 3,
    conversation: [
      "User asks whether a workflow can be approved immediately.",
      "Agent inspects policy rules and account metadata.",
      "Agent decides approve, deny, or escalate.",
    ],
    evaluationRubric: {
      successDefinition: "Applies the correct rule and states whether escalation is required.",
      requiredChecks: ["policy.match", "crm.lookup"],
      userCorrectionSignals: ["missed escalation requirement", "policy mismatch"],
    },
    expectedTools: ["policy.match", "crm.lookup", "ticket.create"],
  },
  {
    slug: "sales-meeting-brief",
    title: "Sales meeting brief",
    description: "Prepare a meeting brief from CRM notes, emails, and calendar context.",
    category: "retrieval",
    difficulty: 2,
    conversation: [
      "Sales rep needs a prep brief for an upcoming customer meeting.",
      "Agent gathers account notes, open threads, and meeting participants.",
      "Agent produces a concise prep summary.",
    ],
    evaluationRubric: {
      successDefinition: "Highlights account state, risks, and recommended talking points.",
      requiredChecks: ["crm.lookup", "mail.search"],
      userCorrectionSignals: ["missing account risk", "poor summary quality"],
    },
    expectedTools: ["crm.lookup", "mail.search", "calendar.check"],
  },
  {
    slug: "knowledge-base-answer",
    title: "Knowledge base answer",
    description: "Answer a user question by synthesizing multiple internal documentation sources.",
    category: "retrieval",
    difficulty: 3,
    conversation: [
      "User asks a policy question with edge-case conditions.",
      "Agent searches internal docs and related release notes.",
      "Agent answers with a grounded, scoped response.",
    ],
    evaluationRubric: {
      successDefinition: "Answers correctly and references the relevant documentation context.",
      requiredChecks: ["knowledge.search", "doc.summarize"],
      userCorrectionSignals: ["unsupported statement", "missed edge case"],
    },
    expectedTools: ["knowledge.search", "doc.summarize"],
  },
  {
    slug: "subscription-change-request",
    title: "Subscription change request",
    description: "Handle a plan change request using account context, billing policy, and usage data.",
    category: "tool-use",
    difficulty: 4,
    conversation: [
      "Customer asks to downgrade after an unexpected invoice.",
      "Agent reviews account usage and billing rules.",
      "Agent recommends the correct plan action and next step.",
    ],
    evaluationRubric: {
      successDefinition: "Balances billing policy, usage evidence, and customer outcome.",
      requiredChecks: ["billing.lookup", "crm.lookup"],
      userCorrectionSignals: ["wrong billing advice", "missing usage context"],
    },
    expectedTools: ["billing.lookup", "crm.lookup", "policy.match"],
  },
] as const;

async function main() {
  const tools = Array.from(
    new Set(seededTasks.flatMap((task) => task.expectedTools)),
  ).sort();

  await prisma.toolCall.deleteMany();
  await prisma.run.deleteMany();
  await prisma.agentConfig.deleteMany();
  await prisma.benchmarkTask.deleteMany();

  for (const task of seededTasks) {
    await prisma.benchmarkTask.create({
      data: {
        slug: task.slug,
        title: task.title,
        description: task.description,
        category: task.category,
        difficulty: task.difficulty,
        conversation: task.conversation,
        evaluationRubric: task.evaluationRubric,
        expectedTools: task.expectedTools,
        toolConfig: {
          deterministic: true,
          maxTurns: task.conversation.length,
        },
      },
    });
  }

  const baselineConfig = await prisma.agentConfig.create({
    data: {
      name: "Baseline agent",
      mode: AgentMode.BASELINE,
      model: "openai/gpt-5.4",
      systemPrompt:
        "You are a reliable multi-turn agent that solves benchmark tasks with grounded tool use.",
      enabledTools: tools,
      toolConfig: {
        verification: "none",
        deterministicMocks: true,
      },
      metadata: {
        owner: "seed",
        purpose: "baseline-comparison",
      },
    },
  });

  const draftVerifierConfig = await prisma.agentConfig.create({
    data: {
      name: "Draft + verifier agent",
      mode: AgentMode.DRAFT_VERIFIER,
      model: "openai/gpt-5.4 + openai/gpt-5.4-mini",
      systemPrompt:
        "You coordinate a draft agent and verifier agent to reduce latency while preserving task quality.",
      enabledTools: tools,
      toolConfig: {
        verification: "step-level",
        deterministicMocks: true,
        speculativeStyle: "draft-verifier",
      },
      metadata: {
        owner: "seed",
        purpose: "speculative-comparison",
      },
    },
  });

  const benchmarkTask = await prisma.benchmarkTask.findUniqueOrThrow({
    where: { slug: "support-refund-resolution" },
  });

  const baselineRun = await prisma.run.create({
    data: {
      name: "Seeded baseline support run",
      agentConfigId: baselineConfig.id,
      benchmarkTaskId: benchmarkTask.id,
      status: RunStatus.SUCCEEDED,
      input: {
        userRequest: "Can I refund this delayed shipment order?",
        scenario: "policy-evaluation",
      },
      output: {
        finalAnswer:
          "Approved for refund based on delay threshold and order state. Customer should receive confirmation in email.",
      },
      summary: {
        success: true,
        notes: "Baseline run completed with two tool calls.",
      },
      metrics: {
        taskSuccessRate: 1,
        averageLatencyMs: 8420,
        estimatedCostPerTaskUsd: 0.034,
        toolErrorRate: 0,
        draftAcceptanceRate: null,
        userCorrectionRate: 0,
      },
      startedAt: new Date("2026-05-01T10:00:00.000Z"),
      finishedAt: new Date("2026-05-01T10:00:08.420Z"),
    },
  });

  await prisma.toolCall.createMany({
    data: [
      {
        runId: baselineRun.id,
        toolName: "order.lookup",
        sequence: 1,
        status: ToolCallStatus.SUCCEEDED,
        input: {
          orderId: "ORD-1042",
        },
        output: {
          shipmentStatus: "delayed",
          fulfilled: false,
        },
        latencyMs: 410,
      },
      {
        runId: baselineRun.id,
        toolName: "policy.match",
        sequence: 2,
        status: ToolCallStatus.SUCCEEDED,
        input: {
          policy: "refund-delay-policy",
          shippingDelayHours: 54,
        },
        output: {
          eligible: true,
          rule: "delay-over-48h",
        },
        latencyMs: 290,
      },
    ],
  });

  const verifierRun = await prisma.run.create({
    data: {
      name: "Seeded draft-verifier support run",
      agentConfigId: draftVerifierConfig.id,
      benchmarkTaskId: benchmarkTask.id,
      status: RunStatus.SUCCEEDED,
      input: {
        userRequest: "Can I refund this delayed shipment order?",
        scenario: "policy-evaluation",
      },
      output: {
        finalAnswer:
          "Refund approved after verifier confirmed delay threshold and order status. Confirmation email should be sent immediately.",
      },
      summary: {
        success: true,
        verifierDecision: "accepted-with-minor-revision",
      },
      metrics: {
        taskSuccessRate: 1,
        averageLatencyMs: 6910,
        estimatedCostPerTaskUsd: 0.027,
        toolErrorRate: 0,
        draftAcceptanceRate: 0.67,
        userCorrectionRate: 0,
      },
      startedAt: new Date("2026-05-01T10:10:00.000Z"),
      finishedAt: new Date("2026-05-01T10:10:06.910Z"),
    },
  });

  await prisma.toolCall.createMany({
    data: [
      {
        runId: verifierRun.id,
        toolName: "order.lookup",
        sequence: 1,
        status: ToolCallStatus.SUCCEEDED,
        input: {
          orderId: "ORD-1042",
        },
        output: {
          shipmentStatus: "delayed",
          fulfilled: false,
        },
        latencyMs: 395,
      },
      {
        runId: verifierRun.id,
        toolName: "policy.match",
        sequence: 2,
        status: ToolCallStatus.SUCCEEDED,
        input: {
          policy: "refund-delay-policy",
          shippingDelayHours: 54,
        },
        output: {
          eligible: true,
          rule: "delay-over-48h",
        },
        latencyMs: 260,
      },
      {
        runId: verifierRun.id,
        toolName: "email.draft",
        sequence: 3,
        status: ToolCallStatus.SUCCEEDED,
        input: {
          template: "refund-confirmation",
          tone: "clear",
        },
        output: {
          draftId: "draft-001",
          ready: true,
        },
        latencyMs: 180,
      },
    ],
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
