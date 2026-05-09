# Roadmap

## Roadmap Goal

The roadmap for SpecAgent Lab is to evolve from a polished evaluation scaffold into a more realistic agent experimentation product. The focus should remain on measurable product outcomes rather than feature count.

## Phase 1: MVP Foundation

Goals:

- Launch the core routes and navigation
- Provide deterministic benchmark tasks
- Support baseline versus draft-verifier comparison
- Show core metrics in a simple dashboard
- Keep the experience clean, fast, and demo-friendly

Expected outcome:
An interview-ready portfolio project that clearly demonstrates product thinking for AI agents.

## Phase 2: Real Evaluation Loop

Goals:

- Persist real benchmark runs and task-level traces
- Replace some mock metrics with observed metrics
- Improve run detail pages with more useful debugging context
- Add clearer benchmark configuration and run management

Expected outcome:
A more credible internal tool for agent iteration and workflow comparison.

## Phase 3: Advanced Workflow Research

### Real Speculative Decoding Integration

Explore how speculative decoding concepts can be translated more directly into agent workflows, including tighter interaction between draft generation and verification.

### Async Rollout Inspired by AReaL

Investigate asynchronous execution and rollout patterns inspired by AReaL-style systems to improve throughput and reduce blocking in multi-turn evaluation pipelines.

Expected outcome:
A stronger technical story around latency optimization and workflow design.

## Phase 4: Human-Centered Evaluation

### Human Feedback Loop

Add review workflows that allow humans to inspect runs, rate outputs, and provide feedback signals that complement automated benchmark metrics.

### More Realistic Benchmark Tasks

Expand beyond deterministic mock tasks into scenarios that better reflect real product usage, including noisier tool behavior and more ambiguous user goals.

Expected outcome:
A more realistic evaluation framework that better reflects production agent quality.

## Long-Term Vision

SpecAgent Lab could develop into a lightweight control plane for agent evaluation, where product teams can compare workflows, understand operational tradeoffs, and make better decisions about when increased architectural complexity is worth the cost.

## Prioritization Principle

Each roadmap step should be evaluated by one question:

Does this improve the team’s ability to understand and optimize multi-turn agent performance across success rate, latency, cost, and tool reliability?
