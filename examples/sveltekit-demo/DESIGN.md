---
version: "1.0"
name: Konstner Demo
description: Minimal design system fixture used to exercise DESIGN.md integration in the sveltekit demo app.
colors:
  background: "#0e1013"
  surface: "#151a20"
  primary: "#7aa2f7"
  accent: "#e0af68"
  text: "#c0caf5"
  muted: "#737aa2"
typography:
  display:
    fontFamily: "Fraunces"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "IBM Plex Sans"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  mono:
    fontFamily: "JetBrains Mono"
    fontSize: "14px"
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "8px"
  lg: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
components:
  button:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
    rounded: "{rounded.md}"
    padding: "{spacing.sm}"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
---

# Konstner Demo — Design System

Dark, literary feel. Serif display paired with a humanist sans for body. Never
pure black; surfaces tint warm-to-cool. Accent sparingly.

## Do's and Don'ts

- DO pair Fraunces with IBM Plex Sans. Use JetBrains Mono only for code.
- DO use `surface` (#151a20) for cards, not `background`.
- DON'T introduce new colors — extend the palette via DESIGN.md first.
- DON'T use pure black (#000) for backgrounds.
- DON'T mix rounded scales inside a single component.
