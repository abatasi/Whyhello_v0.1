---
name: Master footer AI preview
description: The agreed scope for the global utility footer and its first AI chat window.
---

The master utility footer belongs alongside the app shell's persistent navigation. Its assistant uses the authenticated Whyhello API for real replies. Each request contains only the newly submitted message; chat history stays in client memory and is never saved.

**Why:** The user later asked to connect the footer preview to real Whyhello AI replies while avoiding any implication that preview messages had already been sent to a model.

**How to apply:** Keep shared footer behavior in the app shell. State accurately that each message is sent for an independent reply and chat history is not saved. Do not send earlier local-preview messages or claim access to workspace data.
