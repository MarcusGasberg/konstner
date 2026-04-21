export const ADAPTER_DESIGN_PROMPT = `
## Adapter Design Guidelines
- When editing classes, prefer Tailwind utility classes over inline styles.
- Avoid adding new <style> blocks for one-off changes; use utility classes.
- When choosing colors, avoid the default Tailwind purple/violet/cyan palette. Use the project's custom theme colors (--color-*) if available.
- Ensure any text you add uses adequate contrast against its background.
- Respect the existing design system: match spacing scale, border radius, and typography.
`;