---
name: gpt-5-mini API parameters
description: Known unsupported parameters and workarounds for the gpt-5-mini model via Replit's OpenAI proxy.
---

## Rule
Do NOT set `max_tokens` or `max_completion_tokens` when calling `gpt-5-mini`. Setting either causes `finish_reason: "length"` with empty content (silent failure — no error thrown, just empty string returned).

**Why:** `max_tokens` throws a `BadRequestError 400` at request time. `max_completion_tokens` appears accepted but silently caps output at 0 tokens, returning empty content with `finish_reason: "length"`.

**How to apply:** Omit both parameters entirely. Rely on the model's default output length. See `insight-summarize.ts` as the reference pattern — it never sets a token limit.
