# Frontend UI components (shadcn-svelte)

The frontend uses **shadcn-svelte** on **Tailwind v4** for reusable UI *chrome*
(buttons, dropdowns, dialogs, inputs, menus, toolbars). Prefer these components
when building new UI instead of hand-rolling markup — you get consistent styling,
accessibility, and keyboard behaviour for free.

## The one rule (read this first)

Build **chrome** with shadcn; keep the **canvas hot loop** DOM-as-state.

- **Chrome** (bars, popovers, dialogs, menus, form inputs, presence/landing UI) →
  use shadcn-svelte components. This is low-frequency reactive UI where the
  library's convenience is worth it.
- **Board objects, the camera, pan/zoom/drag/resize/draw** → stay bare-metal DOM
  as described in [frontend.md](./frontend.md). **Never** wrap board objects in a
  component library or reactive store — that reintroduces exactly the overhead the
  app's design avoids.

The first real use is the canvas switcher
([canvas-bar.svelte](../frontend/src/components/canvas-bar.svelte)), built on
`DropdownMenu`.

## Where things live

- Components: `frontend/src/lib/components/ui/<name>/` (one folder per component,
  re-exported from its `index.ts`).
- `cn()` class-merge helper + shadcn type helpers (`WithElementRef`,
  `WithoutChildrenOrChild`, …): `frontend/src/lib/utils.ts`.
- Design tokens (CSS variables, light/dark) + Tailwind entry:
  `frontend/src/style.css` (`@import "tailwindcss"`, `@theme inline`, `:root`/`.dark`).
- Config: `frontend/components.json`.
- The `$lib` alias points at `frontend/src/lib` — set in **both**
  [vite.config.ts](../frontend/vite.config.ts) (`resolve.alias`) and
  [tsconfig.json](../frontend/tsconfig.json) (`paths`).

## Setup facts (so you don't re-derive them)

- **Tailwind v4** runs via the `@tailwindcss/vite` plugin (no `postcss.config.js`,
  no `tailwind.config.js`, no `autoprefixer` — all removed). Config is CSS-first in
  `style.css`.
- `tsconfig.json` uses `"moduleResolution": "bundler"` — **required** so TS
  resolves package `exports` maps (bits-ui, `@lucide/svelte/icons/*`) and the
  `.js`→`.ts` imports the generated components emit. Don't switch it back to
  `"node"`.
- Peer versions that matter: **svelte ≥ 5.29** (bits-ui needs Svelte's
  `./attachments` export — the build fails otherwise) and **bits-ui v2**
  (headless primitives under the components).
- Icons: `@lucide/svelte`, imported per-icon by kebab path, e.g.
  `import ChevronDownIcon from "@lucide/svelte/icons/chevron-down"`.

## Adding a component

Run from `frontend/` (non-interactive):

```bash
bunx shadcn-svelte@latest add <name>       # e.g. dialog, input, tooltip, select
```

It reads `components.json`, writes to `src/lib/components/ui/<name>/`, and installs
any needed deps. Then `import * as X from "$lib/components/ui/<name>"`. After
adding, run `bun run check` (the CI gate). If the generated component imports a new
type helper from `$lib/utils`, add it there (the CLI won't always update `utils.ts`).

## Docs

- Components + usage: https://shadcn-svelte.com/docs/components
- Installation / theming: https://shadcn-svelte.com/docs
- Headless primitives (props/events like `onSelect`, `bind:open`):
  https://bits-ui.com/docs
- Icons: https://lucide.dev/icons
