# Experiment Report

## Purpose

This document describes the intended experiment format for SpecAgent Lab. It is written as a template-style summary for discussing benchmark results in a portfolio or interview context.

## Experiment Question

Does a draft-verifier workflow improve multi-turn agent efficiency enough to justify its added system complexity compared with a baseline single-agent workflow?

## Compared Workflows

### Baseline

A standard multi-turn agent that handles planning, tool use, and final responses in one flow.

### Draft-Verifier

A two-stage workflow in which:

- a draft agent proposes an intermediate or provisional answer
- a verifier agent accepts, revises, or rejects the draft

This setup is inspired by speculative decoding concepts, but applied at the agent workflow level rather than token generation.

## Evaluation Setup

- Benchmark tasks are multi-turn and deterministic for the MVP.
- Tasks cover planning, retrieval, reasoning, and tool use.
- Tool contracts are intentionally simple so the product can highlight metric behavior clearly.
- Metrics are reported at both task level and run level.

## Key Metrics

- Task Success Rate
- Average Latency
- Estimated Cost per Task
- Tool Error Rate
- Draft Acceptance Rate
- User Correction Rate

## Example Hypotheses

1. Draft-verifier improves Average Latency when Draft Acceptance Rate is high.
2. Draft-verifier may reduce Estimated Cost per Task if the draft path is cheap and often accepted.
3. Tool Error Rate remains an important constraint regardless of workflow choice.
4. User Correction Rate may expose quality issues not captured by top-line task success alone.

## How to Read Results

- If Task Success Rate improves with acceptable latency and cost, the draft-verifier workflow is promising.
- If latency improves but User Correction Rate increases, the workflow may be over-optimizing for speed.
- If Draft Acceptance Rate is low, the draft path is likely not mature enough to justify additional orchestration.
- If Tool Error Rate is high, workflow-level conclusions may be confounded by tool instability.

## MVP Interpretation Guidance

At the MVP stage, results should be presented as directional evidence rather than production-grade truth. The value of the experiment is that it creates a structured way to discuss agent tradeoffs with product, engineering, and infra stakeholders.

## Portfolio Framing

For interview use, the strongest takeaway is not only that the system can display metrics, but that it frames the right product question:

How should teams evaluate whether a more complex agent architecture actually creates user and business value?
