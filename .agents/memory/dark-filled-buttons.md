---
name: Dark-mode controls and tags
description: The user's contrast requirement for dark-mode buttons, labels and tags.
---

In dark mode, buttons, labels and tags must use either no background fill with light text, or a solid background dark enough to contrast with white text and icons. Target at least 4.5:1 contrast for normal-sized labels, including selected and hover states.

**Why:** The user repeatedly reported low-contrast dark-mode buttons and explicitly requested either unfilled buttons with light text or contrasting solid fills with white text. They then explicitly extended the same rule to labels and tags after showing the Competitor and High badges.

**How to apply:** Apply this across shared and hand-styled buttons, labels and tags, including category choices, hover fills, and disabled states. Keep unfilled controls unfilled, and preserve the established neutral dark-card surfaces and colorful Whyhello brand animation.

Contrast checks must include descendant labels, icon tiles and ancestor fills behind transparent buttons, not only the button's own computed foreground/background.

**Why:** A template-card button can pass a root-level contrast check while a nested pastel badge inherits white text and becomes unreadable. A transparent selected-pill button can also inherit white text while its wrapper retains a pale light-mode fill.

**How to apply:** Inspect nested badges in selectable cards and compare their own effective backgrounds. Standalone badges follow the same contrast policy; preserve their status meaning and keep brand images unchanged.
