export type BenchmarkTaskCategory =
  | "travel-planning"
  | "customer-support"
  | "product-requirement-clarification"
  | "data-analysis"
  | "coding-assistant"
  | "meeting-summarization"
  | "product-recommendation"
  | "budget-planning"
  | "multi-constraint-decision-making"
  | "agent-self-correction";

export type BenchmarkTaskDifficulty = "easy" | "medium" | "hard";

export type BenchmarkTaskDefinition = {
  id: string;
  title: string;
  category: BenchmarkTaskCategory;
  difficulty: BenchmarkTaskDifficulty;
  initialPrompt: string;
  userGoal: string;
  expectedOutcome: string;
  evaluationRubric: {
    successCriteria: string[];
    failureModes: string[];
    scoringNotes: string;
  };
};

export const benchmarkTaskLibrary: BenchmarkTaskDefinition[] = [
  {
    id: "travel-europe-family-itinerary",
    title: "Europe family itinerary under budget",
    category: "travel-planning",
    difficulty: "medium",
    initialPrompt:
      "Plan a 7-day Europe trip for two adults and one child. I care about kid-friendly stops, train travel, and staying under a tight budget.",
    userGoal:
      "Get a realistic itinerary that can adapt when the user later adds constraints about arrival times, hotel location, and total cost.",
    expectedOutcome:
      "A multi-turn travel plan that balances destination order, transport, lodging tradeoffs, and budget clarity without ignoring later constraints.",
    evaluationRubric: {
      successCriteria: [
        "Produces a coherent day-by-day plan rather than isolated suggestions.",
        "Tracks budget and revises recommendations when constraints change.",
        "Explains tradeoffs between convenience, child-friendliness, and cost.",
      ],
      failureModes: [
        "Suggests an unrealistic route or impossible pacing.",
        "Ignores follow-up constraints about budget or transport.",
        "Provides generic attractions without integrating them into an itinerary.",
      ],
      scoringNotes:
        "Strong answers feel like collaborative trip planning over several turns, not a one-shot destination list.",
    },
  },
  {
    id: "support-refund-escalation",
    title: "Refund request with policy edge case",
    category: "customer-support",
    difficulty: "medium",
    initialPrompt:
      "A customer wants a refund for a delayed delivery, but the order also used a promotional discount. Help decide the correct response.",
    userGoal:
      "Receive a policy-grounded support resolution that stays calm, handles ambiguity, and adapts if the user reveals new order details later.",
    expectedOutcome:
      "A support response that clarifies missing facts, applies policy correctly, and recommends approve, deny, or escalate with a clear explanation.",
    evaluationRubric: {
      successCriteria: [
        "Identifies missing facts before making a definitive decision when needed.",
        "Applies policy consistently across follow-up details.",
        "Produces a user-facing response that is clear and actionable.",
      ],
      failureModes: [
        "Commits to a refund decision without enough information.",
        "Contradicts policy after the user adds follow-up details.",
        "Uses harsh or vague customer communication.",
      ],
      scoringNotes:
        "The best responses combine operational correctness with strong support communication quality.",
    },
  },
  {
    id: "prd-clarification-for-ai-feature",
    title: "Clarify a vague AI feature request",
    category: "product-requirement-clarification",
    difficulty: "hard",
    initialPrompt:
      "We want to add an AI copilot to our product. Can you help turn that into a product requirement?",
    userGoal:
      "Be guided through a structured clarification process that surfaces target users, workflows, non-goals, and measurable outcomes across multiple turns.",
    expectedOutcome:
      "A sharpened product requirement summary that converts vague intent into a scoped feature proposal with risks and open questions.",
    evaluationRubric: {
      successCriteria: [
        "Asks high-value clarification questions instead of jumping to a solution.",
        "Distinguishes user problem, feature scope, and success metrics.",
        "Synthesizes follow-up answers into a coherent requirement framing.",
      ],
      failureModes: [
        "Responds with a generic PRD template without engaging the ambiguity.",
        "Assumes the target user or use case without validating it.",
        "Fails to identify meaningful product metrics or non-goals.",
      ],
      scoringNotes:
        "This task rewards product thinking and iterative requirement shaping more than polished writing alone.",
    },
  },
  {
    id: "sales-dataset-diagnosis",
    title: "Diagnose a sales funnel drop",
    category: "data-analysis",
    difficulty: "hard",
    initialPrompt:
      "Our weekly dashboard shows a drop in conversions from demo to paid. Help investigate what might be happening.",
    userGoal:
      "Work through a realistic analysis conversation where new cohort details and segmentation clues appear over multiple turns.",
    expectedOutcome:
      "A structured diagnosis that proposes likely causes, identifies missing data, and recommends next analysis steps without overclaiming.",
    evaluationRubric: {
      successCriteria: [
        "Separates observed facts from hypotheses.",
        "Uses follow-up turns to refine the diagnosis as new slices of data appear.",
        "Ends with actionable analysis next steps or decisions.",
      ],
      failureModes: [
        "Jumps to a single root cause too early.",
        "Ignores segmentation, seasonality, or instrumentation uncertainty.",
        "Returns a generic analytics checklist without adapting to the scenario.",
      ],
      scoringNotes:
        "High scores require disciplined reasoning under partial information, not just familiarity with metrics vocabulary.",
    },
  },
  {
    id: "codebase-bug-fix-guidance",
    title: "Fix a flaky async bug in a web app",
    category: "coding-assistant",
    difficulty: "hard",
    initialPrompt:
      "A user says our save button sometimes succeeds visually but the data is missing after refresh. Help debug and propose a fix.",
    userGoal:
      "Get an assistant that can reason about likely causes, ask for the right code or logs, and adapt its diagnosis as new snippets are revealed.",
    expectedOutcome:
      "A plausible debugging path and implementation recommendation that covers race conditions, optimistic UI, and persistence verification.",
    evaluationRubric: {
      successCriteria: [
        "Requests the most relevant logs or code context instead of guessing wildly.",
        "Updates the debugging hypothesis when new evidence appears.",
        "Suggests a fix and verification plan, not just a suspected cause.",
      ],
      failureModes: [
        "Suggests random fixes without narrowing the problem.",
        "Ignores async state, retries, or backend persistence issues.",
        "Fails to include a validation or testing strategy.",
      ],
      scoringNotes:
        "The best answers feel like a strong pair programmer working through uncertainty over multiple turns.",
    },
  },
  {
    id: "executive-meeting-synthesis",
    title: "Summarize a messy leadership meeting",
    category: "meeting-summarization",
    difficulty: "medium",
    initialPrompt:
      "I have rough notes from a leadership meeting. I need a concise summary, key decisions, and unresolved questions.",
    userGoal:
      "Turn fragmented notes into a clear summary that can be refined when the user later reveals contradictions or missing context.",
    expectedOutcome:
      "A multi-turn synthesis that separates decisions, open items, and owners while cleaning up ambiguity in the notes.",
    evaluationRubric: {
      successCriteria: [
        "Distinguishes decisions from discussion points and unresolved issues.",
        "Handles incomplete or conflicting notes carefully.",
        "Produces a summary format suitable for team follow-up.",
      ],
      failureModes: [
        "Invents certainty where the notes are ambiguous.",
        "Loses action items or owner assignments.",
        "Returns a wall of prose that is hard to scan.",
      ],
      scoringNotes:
        "Strong performance combines summarization quality with careful handling of uncertainty across turns.",
    },
  },
  {
    id: "laptop-recommendation-tradeoffs",
    title: "Recommend a laptop across changing needs",
    category: "product-recommendation",
    difficulty: "medium",
    initialPrompt:
      "Recommend a laptop for me. I do some coding, travel often, and care about battery life.",
    userGoal:
      "Have the assistant refine its recommendation as the user adds budget, OS preference, and performance constraints over multiple turns.",
    expectedOutcome:
      "A reasoned recommendation process that narrows options, explains tradeoffs, and updates confidently when requirements shift.",
    evaluationRubric: {
      successCriteria: [
        "Asks for the missing constraints that matter most.",
        "Explains tradeoffs instead of listing products blindly.",
        "Revises recommendations coherently when requirements change.",
      ],
      failureModes: [
        "Gives a static recommendation without clarifying needs.",
        "Contradicts earlier logic when the user adds new constraints.",
        "Produces shallow comparison criteria with no real prioritization.",
      ],
      scoringNotes:
        "This task measures iterative recommendation quality rather than catalog knowledge breadth alone.",
    },
  },
  {
    id: "quarterly-team-budget-plan",
    title: "Plan a quarterly team budget",
    category: "budget-planning",
    difficulty: "hard",
    initialPrompt:
      "Help me plan next quarter’s team budget. We have hiring goals, software renewals, and pressure to reduce spend.",
    userGoal:
      "Get a practical budget plan that can respond to changing hiring assumptions, cuts, and dependencies over multiple turns.",
    expectedOutcome:
      "A structured budget recommendation with categories, tradeoffs, and scenarios rather than a simple spreadsheet-style list.",
    evaluationRubric: {
      successCriteria: [
        "Separates fixed, variable, and discretionary costs.",
        "Recomputes priorities when the user changes assumptions.",
        "Explains budget tradeoffs in operational terms, not only arithmetic.",
      ],
      failureModes: [
        "Treats all expenses as equally flexible.",
        "Fails to adapt when the user changes constraints.",
        "Provides numbers without a decision rationale.",
      ],
      scoringNotes:
        "Good answers show both financial reasoning and managerial prioritization under shifting constraints.",
    },
  },
  {
    id: "vendor-selection-under-constraints",
    title: "Choose a vendor with competing constraints",
    category: "multi-constraint-decision-making",
    difficulty: "hard",
    initialPrompt:
      "We need to choose between three vendors for a customer data platform. Security is critical, but implementation speed and cost matter too.",
    userGoal:
      "Use the assistant to work through a real decision where requirements conflict and stakeholders introduce new priorities over time.",
    expectedOutcome:
      "A recommendation that compares options transparently, updates with new constraints, and shows why one tradeoff is favored.",
    evaluationRubric: {
      successCriteria: [
        "Keeps track of multiple constraints instead of optimizing a single dimension.",
        "Explains how new stakeholder priorities change the ranking.",
        "Produces a recommendation with clear rationale and residual risks.",
      ],
      failureModes: [
        "Chooses a winner too early without comparative reasoning.",
        "Ignores a constraint once the conversation becomes more complex.",
        "Presents a vague recommendation with no decision framework.",
      ],
      scoringNotes:
        "This task is strong when the assistant behaves like a careful decision partner under changing constraints.",
    },
  },
  {
    id: "agent-self-correction-after-misread",
    title: "Recover after a mistaken assumption",
    category: "agent-self-correction",
    difficulty: "medium",
    initialPrompt:
      "You previously summarized my request incorrectly. I need you to fix the misunderstanding and continue from the corrected goal.",
    userGoal:
      "Evaluate whether the assistant can acknowledge an error, repair context, and continue productively in later turns without getting defensive.",
    expectedOutcome:
      "A self-correcting response that identifies the mistake, updates the working understanding, and proceeds with the corrected task cleanly.",
    evaluationRubric: {
      successCriteria: [
        "Clearly acknowledges the earlier mistake.",
        "Restates the corrected user goal accurately.",
        "Continues the task without repeating the same misunderstanding.",
      ],
      failureModes: [
        "Defends the earlier mistake instead of correcting it.",
        "Apologizes but fails to update the task interpretation.",
        "Repeats the same wrong assumption in later turns.",
      ],
      scoringNotes:
        "This task rewards graceful recovery and contextual repair, which are important for multi-turn agent trust.",
    },
  },
];
