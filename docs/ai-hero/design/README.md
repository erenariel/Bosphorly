# AI hero – approved design reference

Source of the approved design (Claude Design canvas). Match these files visually.

- `desktop-1440.dc.html` – desktop hero, frame 1440×940
- `mobile-390.dc.html` – mobile hero, frame 390×1180

How to read them: plain HTML with inline styles. `<sc-for>` repeats its child for each item, `<sc-if>` shows a block conditionally, `{{name}}` values come from `renderVals()` in the script at the bottom (tabs, chips, field lists, button styles). The `<helmet><style>` block holds the background, the animated gradient ring, the typing dots and the pulse keyframes.

Use the exact values: colors, font (DM Sans 800 for the H1), sizes, radii, spacing, centred desktop layout, transparent input inside the dark Mimo box, sparkle icon on the coral "Ask Mimo" button, 4-field transfer form, pill tabs, ✓ trust row.

Intentional differences on the live site (keep them): the real shared site header; questions open the existing Mimo chat instead of an inline demo answer; the "online" badge only shows when /v1/public/channels says Mimo is on; the floating Mimo bubble hides while the hero box is visible.
