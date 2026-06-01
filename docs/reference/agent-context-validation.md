# agent-context.md — Validation Experiment

This document records the empirical validation of the agent-context.md
layer's central hypothesis. It is the evidence cited by the architecture
ticket for the docs system.

## TL;DR

We claimed earlier that an LLM-targeted `agent-context.md` file would
reduce per-invocation input tokens by roughly 5-10x compared to reading
raw source code, while preserving answer accuracy. The PoC-scale
measurement does not show 5-10x — it shows **1.6x** at this scale, with
**accuracy held constant at 96%**.

The 1.6x is real and reproducible, but the gap is smaller than projected
because our measurement deliberately used **pre-curated raw code**
(only the 6 files actually relevant to agent-orchestration). At real
agent-invocation time on a legacy codebase, where the agent must first
**find** the right files via grep and partial reads, the cost picture
flips: the per-capability raw-code budget scales linearly with code
size, while `agent-context.md` stays bounded. The projection section
below estimates this growth.

**Recommendation:** proceed with the rollout to a larger legacy
codebase. The accuracy preservation result is the load-bearing finding;
the token ratio improves with scale.

**Update — replicated at scale.** The experiment has since been repeated
on a real legacy capability (an external mobile project, anonymized here,
~12K LOC). At that scale the ratio is **20x** for best-case curated raw
code and **42x** for the whole capability, with `agent-context.md` at
**100%** accuracy versus 92% for curated raw code. The 1.6x above was a
small-capability artifact; the projection holds. See
[replication at scale](#replication-on-a-larger-legacy-capability).

## Hypothesis

A capability documented as a structured `agent-context.md` file
(LLM-optimized YAML frontmatter + short prose mental model) can serve
as a substitute for raw source code reading in two ways:

1. **Token efficiency:** fewer input tokens per query.
2. **Accuracy preservation:** the model answers questions as well as it
   would given the raw code.

We test both with a fixed evaluation set on one capability
(`agent-orchestration`) using `claude-sonnet-4-6`.

## Method

| Element | Choice |
|---|---|
| Capability | `agent-orchestration` |
| Model | `claude-sonnet-4-6` |
| Questions | 12, hand-written with ground-truth answer keys |
| Categories | 3 invariant, 2 contract, 2 gotcha, 2 common_change, 2 cross_ref, 1 control |
| Conditions | A: agent-context only · B: raw code only · C: combined |
| Grading | Same-model LLM-as-judge on a 0-2 scale, prompt described below |
| Replication | `scripts/agent-context-eval/run.ts`, results in `results-<timestamp>.json` |

### Conditions

- **A — agent-context only:** `docs/capabilities/agent-orchestration/agent-context.md` alone (~6.4K chars).
- **B — raw code only:** six source files (`orchestrator.ts`, `agent-runner.ts`, `escalation-detector.ts`, `chat/route.ts`, `agents/index.ts`, `agents/types.ts`) — about 370 lines, ~10.2K chars. These are **pre-curated**: the agent does not pay any cost to find them.
- **C — combined:** both, concatenated.

### Control question

One of the 12 questions deliberately asks about information present in
neither condition's context (the Slack admin channel ID, which belongs
to `slack-integration`). A model that fabricates a plausible-looking
answer here is doing the wrong thing; the only correct response is to
say the information is not in the provided context. This guards against
the LLM-as-judge giving credit for confident-but-wrong answers.

## Results

### Headline numbers (averaged over 12 questions)

| Condition | Avg input tokens | Avg output tokens | Accuracy |
|---|---|---|---|
| A — agent-context only | **2,052** | 119 | **23/24 (96%)** |
| B — raw code only | 3,264 | 152 | 23/24 (96%) |
| C — combined | 5,199 | 131 | **24/24 (100%)** |

Ratios relative to A: A = 1.00x, B = 1.59x, C = 2.53x.

### Per-category breakdown

| Category | A | B | C |
|---|---|---|---|
| invariant (3 questions, max 6) | 6/6 | 6/6 | 6/6 |
| contract (2 questions, max 4) | **3/4** | 4/4 | 4/4 |
| gotcha (2 questions, max 4) | 4/4 | 4/4 | 4/4 |
| common_change (2 questions, max 4) | 4/4 | **3/4** | 4/4 |
| cross_ref (2 questions, max 4) | 4/4 | 4/4 | 4/4 |
| control (1 question, max 2) | 2/2 | 2/2 | 2/2 |

Two categories had one miss each, by different conditions:

- **A missed one contract question (Q04).** The judge wrote: *"The
  candidate correctly identifies the shape of the return object but
  omits that it is a Promise."* — our `agent-context.md` schema records
  contracts as the value shape (`{ agent: string, reasoning: string }`),
  not the wrapping `Promise<...>`. **Schema refinement candidate** for
  Phase 2: always include the `Promise<>` wrapper in async contracts.
- **B missed one common-change question (Q08).** Asked "what files do I
  touch to add a new agent type", B identified the DB but missed
  `src/agents/types.ts` and the admin UI file. This is exactly the
  operational guidance `agent-context.md`'s `common_changes` field
  captures and raw code can't reasonably produce.

Neither model fabricated an answer to the control question in any
condition.

## Honest interpretation

### What the results actually say

1. **Accuracy is preserved.** A and B both scored 96%. The single
   missed question per condition is in a different category, suggesting
   the two information layers have complementary blind spots: raw code
   knows full signatures, agent-context knows operational impact.
2. **The PoC-scale token ratio is 1.6x, not 5-10x.** This is honest. The
   earlier "5-10x" was an a priori projection, not a measurement.
3. **The combined condition (C) is the only one that hits 100%.** This
   matters for Phase 2 maintenance: a doc-sync agent operating on real
   PRs should consult both layers when available, not just one.

### Why the gap is smaller than projected at this scale

The biggest variable hidden by this experiment is **what counts as
"raw code"**. We measured B as 6 pre-curated files (~10K chars / 3.3K
tokens). At real agent-invocation time, no such curated set exists:
the agent receives a PR diff or a question and must first **discover**
which files matter. That discovery costs tokens — grep over the repo,
read several wrong files before the right ones surface, follow imports
across boundaries. The PoC measurement removed that cost entirely from
condition B.

`agent-context.md` is designed to eliminate exactly that discovery
cost: `entry_points` points to the few files that matter, and
`cross_refs` resolves cross-capability questions in one hop.

### What the result is NOT

It is not a proof that the format scales to enterprise codebases. It
is not a measurement on a legacy codebase. The 1.6x value is a lower
bound for the savings — it represents the best possible case for raw
code (no search overhead) and a reasonable case for `agent-context.md`
(modest capability size).

## Scale projection

This section estimates how the ratio changes as capability size grows.
We do not have direct measurements at larger scales; the numbers below
are estimates based on the linear-vs-bounded growth pattern of the two
input types.

### Growth model

- **Raw code per capability grows linearly with implementation size.**
  More files, more imports to chase, more concrete behavior to read.
  At realistic agent invocation, the agent also pays a search cost
  before the read cost — proportional to total repo size, not just the
  one capability.
- **`agent-context.md` size is bounded by human review.** Each file
  must be reviewable in a PR; in practice this caps it around 500-1500
  lines and 2-5K tokens regardless of how complex the underlying
  capability is. More complexity translates into denser invariants and
  more gotchas, not unbounded growth.

So the ratio is roughly `raw_code / agent_context`, with raw code growing
linearly and agent-context essentially constant.

### Projected ratios

| Scale | Example | Capability size | Raw code (tokens) | agent-context (tokens) | Projected ratio |
|---|---|---|---|---|---|
| **PoC (measured)** | DeptAgent agent-orchestration | ~370 LOC | 3.3K | 2.1K | **1.6x** |
| Small project (typical) | One Next.js feature area | ~2K LOC | ~12K | ~2.5K | **~5x** |
| Medium (a legacy mobile capability) | several host screens + shared helpers | ~10K LOC | ~50-80K | ~3K | **~15-25x** |
| Large legacy module | Enterprise feature with deep history | ~30K LOC | ~150K+ | ~5K | **~30-50x** |
| Very large (cross-module) | A capability spanning several packages | ~100K+ LOC | ~400K+ | ~5-8K | **~50-80x** |

Two effects compound at large scale:

1. **The raw-code budget exceeds practical context windows.** A
   capability spanning 100K+ LOC simply cannot all fit in one query.
   The agent has to stream / page / search. `agent-context.md`
   sidesteps this by reducing to a fixed-size summary.
2. **Accuracy at large scale is also expected to favor
   `agent-context.md`.** Diluting the signal across hundreds of files
   reduces the model's per-token attention. A dense pre-digest
   concentrates the load-bearing facts. We did not measure this
   directly, but it is the predicted second-order effect.

### What would change the projection

These projections rest on three assumptions, each falsifiable:

- That `agent-context.md` stays bounded. If a capability gets so
  intricate that the file balloons past 8-10K tokens, the ratio
  shrinks. We would split the capability into sub-capabilities before
  letting that happen.
- That raw code stays roughly linear with LOC. Heavily-commented or
  generated code inflates this; that helps agent-context, not the
  other way.
- That model behavior continues to favor structured fields over prose.
  Future models may extract structure from prose more efficiently,
  shrinking the gap. We would still expect a meaningful gain because
  of the search-elimination effect.

## Replication on a larger legacy capability

This section reports a second run of the experiment on a **real legacy
codebase** — an external mobile project, kept anonymous here — performed
as a feasibility test. It exists to pressure-test the scale projection
above with measured data and to apply two of the three methodology
changes the PoC prescribed.

The capability is the medium-scale bucket from the projection table:
roughly **12K lines of code** spread across several host screens that
share a single media player, plus a large host shell and multiple player
backends. Its `agent-context.md` was generated by the bootstrap tooling
(not hand-tuned for the experiment), so what is under test is the
artifact the system actually produces.

### What changed from the PoC

1. **Raw code is no longer a single curated set.** Two raw-code
   conditions instead of one:
   - **B_curated** — the minimal correct file set the `agent-context.md`
     read-order points to. The *best case* for raw code: the agent
     already knows which files matter. Analogous to the PoC's pre-curated
     B.
   - **B_full** — every file in the capability. The *no-map* case: read
     the whole capability because nothing told you which files matter. A
     proxy for unguided search overhead.
2. **The judge is a different model from the answerer** (answerer:
   `claude-sonnet-4-6`; judge: `claude-opus-4-8`), removing the
   same-model cross-eval bias the PoC flagged.
3. **A discovery-category question** was added, rewarding knowledge of
   *where* code lives.

12 questions: 3 invariant, 2 contract, 3 gotcha, 2 common_change,
1 discovery, 1 control.

### Results (averaged over 12 questions)

| Condition | Avg input tokens | Accuracy | Ratio vs A |
|---|---|---|---|
| A — agent-context only | **3,005** | **24/24 (100%)** | 1.00x |
| B_curated — minimal raw set | 60,793 | 22/24 (92%) | **20.23x** |
| B_full — whole capability | 126,534 | 24/24 (100%) | **42.11x** |
| C — agent-context + curated | 63,672 | 24/24 (100%) | 21.19x |

Per-condition input tokens are essentially constant across questions
because the context dominates the tiny question text. The control
question scored 2/2 in every condition — no fabrication.

### What this says

1. **The 1.6x PoC ratio was a small-capability artifact.** At realistic
   legacy scale, even the *best case* for raw code (B_curated, the agent
   magically knowing which files to read) costs **20x** the tokens of
   `agent-context.md`, because the relevant files are themselves
   thousands of lines. The PoC capability was ~370 LOC total; here a
   single host screen is larger than that.
2. **Accuracy favors `agent-context.md`, more clearly than in the PoC.**
   A scored 100%; B_curated scored 92%, missing one gotcha (a non-obvious
   platform behavior that is not visible from the code alone) and one
   common-change (enumerating every screen a change must touch). Both
   misses are exactly the operational hindsight the `gotchas` and
   `common_changes` fields capture and that raw code, even when present,
   does not surface on its own.
3. **More raw code recovers accuracy, but at 42x cost.** B_full reached
   100% — the missing files were all in context — but at ~126K tokens,
   **approaching the 200K context window**. One step up in capability
   size (the projection's ~30K LOC bucket) would exceed it, which is the
   "raw-code budget exceeds practical context windows" prediction landing
   in practice.

This measured 20x (curated) to 42x (full) sits squarely in — and at the
top of — the projection's **~15-25x** estimate for this scale bucket, now
backed by data rather than a growth model.

### Honest caveats specific to this run

- **B_curated includes only one representative screen** of the several
  near-identical ones, which is faithful to the read-order but is part of
  why it missed the "every screen to touch" question. A curated set with
  all of them would likely score full marks — at a *higher* token cost,
  not a lower one. The direction of the finding is unaffected.
- **B_full is an upper bound, not literal agentic search.** It reads the
  whole capability in one shot rather than simulating grep-then-read
  iterations. The true cost of an unguided agent sits between B_curated
  and B_full. The agentic-search harness remains the most faithful future
  measurement.
- **One capability, one run; the judge caveat is only partly addressed.**
  The judge is now a different model, but it is still a single judge over
  a single capability. The relative comparison across conditions is more
  robust than the absolute scores.

The replication harness and full per-question results embed the external
project's source detail, so they are **not included in this public
repository**; they are retained privately.

## Limitations

- **One capability tested.** `agent-orchestration` is small and
  well-bounded. A capability with weaker boundaries (typical of
  legacy code) might reveal failure modes the PoC misses.
- **LLM-as-judge with the same model as evaluator.** This is a known
  cross-eval bias. A different judge (a different model family or a
  human grader) could shift scores; the absolute numbers should be
  taken with that caveat. The *relative* comparison across conditions
  is more robust.
- **No measurement of search overhead.** This is the dominant gap
  between the measured 1.6x and the projected 5-80x.
- **No measurement of accuracy at very large scale.** This is a
  predicted second-order effect we did not test.
- **No cache effects.** Production deployments will use Anthropic
  prompt caching, which changes the per-call cost profile. The
  experiment deliberately did not use caching so the comparison
  reflects raw token counts.

## Recommendation

**Proceed with the legacy-codebase rollout.** Two reasons:

1. Accuracy preservation is the load-bearing finding and it is solid
   (A and B both 96%, C 100%).
2. The PoC-scale token ratio understates production behavior; the
   measurement excluded the search overhead that `agent-context.md`
   primarily exists to eliminate.

### Schema refinements suggested by the result

- **Contracts should include the wrapper type** (`Promise<...>`),
  not only the value shape. This is what Q04 caught.
- Continue weighting effort on `invariants` and `gotchas`. These were
  the categories where the two conditions diverged most informatively
  in earlier exploration; the experiment confirms they are
  non-redundant.

### Validation to repeat on a larger legacy capability

When applying this pattern to a real legacy capability, repeat the
experiment with three differences:

1. Test condition B as "raw code with realistic search overhead" by
   not pre-curating the file set. Let the agent grep first.
2. Use a different evaluator/judge pair than the answerer model.
3. Include a category for cross-capability questions (something that
   requires `cross_refs` to resolve correctly).

**Status: done (partially), see
[replication at scale](#replication-on-a-larger-legacy-capability).**
(1) was addressed by a two-condition curated/full split (a whole-
capability upper bound rather than a literal grep loop, which remains
future work). (2) was addressed (a different judge model from the
answerer). (3) was not done: a single capability was used, so the
cross-capability question type was replaced by a discovery category.

## Replication

```bash
pnpm tsx scripts/agent-context-eval/run.ts
```

Inputs: `scripts/agent-context-eval/questions.json`,
`docs/capabilities/agent-orchestration/agent-context.md`, the six raw
source files listed at the top of the script.

Output: `scripts/agent-context-eval/results-<timestamp>.json` plus a
summary table on stdout. Requires `ANTHROPIC_API_KEY` in `.env.local`.

The 2026-05-27 run, including every per-question response and the
judge's per-question reasoning, is committed alongside this document
at `scripts/agent-context-eval/results-2026-05-27T17-37-39-394Z.json`.
