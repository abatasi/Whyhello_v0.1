---
name: Theme selector alignment
description: Why app-selected light mode can still render dark utilities on a dark-OS device.
---

Tailwind v4 dark utilities default to the device's color-scheme media query, while next-themes changes a class on the document. Keep those selectors aligned when the app lets users choose light or dark independently of the device.

**Why:** With dark OS settings but light selected in the app, a white-background header displayed the white-wordmark logo while a dark-styled sign-in card displayed the black-wordmark logo. The logo and background were controlled by different theme mechanisms.

**How to apply:** When adding theme-dependent styles, ensure dark utilities follow the same `.dark` class as the app theme and theme-dependent JavaScript. Check manually selected light and dark themes, not just default OS settings.