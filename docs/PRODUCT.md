# Product

## Register

product

## Users

Primary: hackathon judges and demo audiences seeing BuildPath for the first time — they have ~3 minutes, no manual, and form their opinion on first glance. The interface must be instantly legible and visibly distinctive at presentation distance.

Secondary (and the retention story): solo builders and makers who return to the tool — they reopen saved roadmaps, mark phases complete, keep notes, and track progress over weeks. Everything that wows in the demo must also survive daily use.

Job to be done: turn a vague project idea into a credible, phase-by-phase roadmap fast enough to feel like magic, then act as the place where that roadmap lives.

## Product Purpose

BuildPath converts a short chat-style onboarding into an AI-generated project roadmap (phases, checkpoints, risks, named tools, confidence scores) rendered as an animated vertical timeline. It exists to give builders structure and momentum at the moment a project is just an idea. Success = a first-time viewer understands and trusts the output within the demo window, and a returning user finds their progress exactly where they left it.

## Brand Personality

Precise, engineered, alive — with a coach's voice. A serious engineering instrument (tight type, structured cards, tabular numbers) where exactly one element on screen feels alive: the lit timeline tracking the current phase. The copy and progress states are confident, fast, and encouraging — they celebrate completion and push toward the next phase, friendly without being cutesy.

## Anti-references

- **Generic SaaS dashboard**: identical card grids, hero-metric blocks, gradient buttons everywhere — the "AI-generated admin panel" look.
- **Neon cyberpunk overload**: glow on everything, animated gradients, glassmorphism. The dark theme must not tip into gamer aesthetic; glow is a budget, spent only on the current phase.
- **Sterile enterprise gray**: lifeless grayscale corporate UI with no identity.

## Design Principles

1. **One living element per screen.** The light/glow budget is concentrated on the single thing that matters now (the current phase, the active message, the generating state). Everything else stays quiet so the living element reads.
2. **Demo-speed comprehension.** Every screen must be parseable in five seconds from across a room. Hierarchy, not density; if a judge has to squint, it failed.
3. **Momentum is the product.** Progress is always visible and always celebrated — completion states, progress bars, quick wins early. The UI's job after generation is to get the user to start phase 1.
4. **Specifics over categories.** The agent names real tools and measurable checkpoints; the UI privileges that concreteness — chips, named items, exact numbers — over vague summaries.
5. **Engineered, not decorated.** Structure carries the aesthetic: hairline dividers, tabular numerals, tight letter-spacing, consistent radii. Ornament only where it communicates state.

## Accessibility & Inclusion

Best-effort posture: keep the existing `prefers-reduced-motion` alternatives for every animation (already in place for the particle, halo, shimmer, typing dots), visible focus states, and keyboard operability (existing E/C/N shortcuts must never trap focus). AA contrast is a goal, not a hard gate — but body text should stay near 4.5:1 and never drop below comfortable readability on the dark canvas.
