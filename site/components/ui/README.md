# `components/ui/`

shadcn/ui primitives, copied source. Do **not** install `shadcn-ui` as
a package.

## Convention

- One primitive per file. `button.tsx`, `dialog.tsx`, `popover.tsx`,
  `tabs.tsx`, `tooltip.tsx`, etc.
- Source comes from the official shadcn/ui repo
  (https://ui.shadcn.com/docs/components). Copied verbatim, then
  adjusted only if a Tailwind token differs from this project's.
- Each primitive uses `cn()` from `lib/utils.ts` to merge classes.
- Each primitive may pull in a Radix peer dep
  (`@radix-ui/react-tabs`, `@radix-ui/react-dialog`, etc.). Install
  the Radix dep at the moment you copy the primitive in. Approve
  the dep with the user first per the project's "no surprise
  libraries" rule.

## What's here

This directory is intentionally empty in the cleanup phase.
Primitives are added one at a time as features need them, starting
with spec build step 1 (static recursive renderer) where the canvas
will need at least `tooltip` and `button`.
