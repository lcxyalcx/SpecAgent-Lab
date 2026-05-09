# Metric Design

## Purpose

SpecAgent Lab measures multi-turn agent performance across both product quality and system efficiency. The metric set is intentionally compact for the MVP so the dashboard remains understandable in demos and interviews.

## Primary Metrics

### Task Success Rate

The percentage of benchmark tasks completed successfully according to a task-specific rubric.

Why it matters:
This is the most direct signal of whether the agent is useful.

### Average Latency

The average end-to-end task completion time across a benchmark run.

Why it matters:
Multi-turn systems often improve quality by adding extra reasoning or verification, but that can introduce unacceptable delays.

### Estimated Cost per Task

The average estimated token cost of completing one task.

Why it matters:
Agent systems can become expensive quickly, especially when they call multiple models or repeat verification steps.

### Tool Error Rate

The percentage of tool calls that fail, return invalid results, or require recovery behavior.

Why it matters:
Tool reliability is often a hidden bottleneck in multi-turn agents. A high-performing model can still produce a poor user experience if tool calls are brittle.

### Draft Acceptance Rate

The percentage of draft-agent steps accepted by the verifier without revision.

Why it matters:
This is the core efficiency signal for the speculative workflow. A low acceptance rate suggests the draft path is not providing enough useful acceleration.

### User Correction Rate

The percentage of tasks that require a manual user correction, retry, or follow-up to reach an acceptable outcome.

Why it matters:
A system can appear successful in benchmark logs while still causing too much correction burden for users. This metric keeps the product view grounded in user effort.

## Metric Relationships

These metrics should be interpreted together rather than in isolation.

- Higher Task Success Rate is valuable only if latency and cost stay within reasonable bounds.
- Lower Average Latency is useful only if it does not reduce success quality.
- Draft Acceptance Rate should correlate with lower latency or lower cost; otherwise the workflow may not justify its complexity.
- Tool Error Rate and User Correction Rate help explain why quality drops even when model outputs look strong.

## MVP Measurement Approach

For the MVP, metric calculation may use deterministic mock data and estimated token costs. This is acceptable as long as the product communicates that the system is an evaluation scaffold rather than a production observability platform.

The design goal is not perfect measurement on day one. The goal is to establish a credible product framework for reasoning about agent performance.

## Dashboard Design Guidance

The dashboard should emphasize:

- benchmark-level summaries for fast scanning
- task-level comparisons for deeper inspection
- clear baseline versus draft-verifier deltas
- simple labels that non-specialists can explain in an interview setting

## Future Metric Extensions

Potential future additions include:

- p95 latency
- verifier intervention rate
- average tool calls per task
- task abandonment rate
- human rating or preference score
