# Frontend principles

## Overview

The frontend is a Svelte 5 + TypeScript canvas client. Its defining convention is
**DOM-as-state**: board objects are real DOM elements (with `id` + `data-*`
attributes), not entries in a reactive store. Logic lives in `*.svelte.ts`
modules; `components/` is mostly presentational. (See `CLAUDE.md` for module
layering.)

## Performance is the point: the DOM *is* the state (not framework state)

This is the foundational decision the whole frontend is built around, and it is
deliberate — **performance is a top priority of this app**, so the canvas does
**not** go through a reactive framework.

- **Board/game state is never kept in framework state.** An object's position,
  size, content, type, etc. live on its DOM element (`style.transform`,
  `data-x`/`data-y`/`data-width`/`data-objtype`/…). The camera's `x`/`y`/`z` live
  on `dom.camera.dataset`. There is **no `$state` array of objects**, no reactive
  store driving the canvas, no Svelte bindings rendering objects.
- **Why:** a reactive framework re-runs effects / diffs / schedules updates on
  every state change. On a canvas where hundreds of objects can be dragged,
  resized, drawn, panned, and zoomed at 60fps, that overhead is exactly what we
  refuse to pay. So the hot paths bypass the framework entirely.
- **The rule:** anything touching **objects, the camera, or canvas navigation**
  (pan / zoom / drag / resize / draw / select) must be as **bare-metal** as it can
  be — read and write the DOM directly (`getElementById`, `querySelectorAll` by
  `CLASSES`, `element.style.transform`, `element.dataset.*`), imperatively, in
  plain `*.svelte.ts` functions. In `mousemove`-rate loops, write straight to
  `style.transform` (GPU-composited) and avoid layout-thrashing properties.
- **Svelte `$state` is for UI chrome only** — low-frequency app state like the
  current tool, toolbar/dialog/popover open state, the presence list, connection
  state (`cmState`), and saved-board membership. Never the canvas hot loop.
- **Corollary — don't "modernize" object code into a store.** Introducing a
  reactive store for board objects would re-add the exact overhead this design
  exists to avoid, *and* break the export/import/sync/persist pipeline that
  assumes the DOM is the single source of truth. Don't do it without a very good,
  measured reason.

## The sync contract (most important — #1 bug source)

Every mutation to a board object must do **two** things: update the local DOM
**and** broadcast it. The server never echoes your own change back, so if you
forget the broadcast the change is local-only and silently desyncs / vanishes on
reload.

- **Create** an object → `sendMessage({ type: "addItem", payload: { object } })`
- **Move / resize / edit** → `sendMessage({ type: "alterItem", payload: { object } })`
- **Delete** → `sendMessage({ type: "removeItem", payload: { id } })`

Broadcasts are emitted at the **end of a gesture** (mouse-up), not per-frame:
others see the finished move/resize, not the live drag.

## Adding a synced field: the export/import/update/factory quadrilateral

To make a new property on an object type sync and persist, thread it through
**all** of these — missing any one leg causes desync or a broken reload:

1. `types.ts` — add the field to `Object_Image` / `Object_Text` / `Object_SVG`.
2. `exportObject(el)` (`global.svelte.ts`) — read it off the DOM element.
3. `createX(...)` (`factories.svelte.ts`) — accept it and apply it to the element.
4. `importObject(json)` (`global.svelte.ts`) — pass it into the factory.
5. `updateObject(obj, isTransition)` (`global.svelte.ts`) — apply it to the
   existing element for remote `alterItem`s.

`exportObject`/`importObject` are the only bridge between DOM elements and the
`Object` wire type; `factories.svelte.ts` is the only place that constructs
objects. `updateObject` is the receive-side applicator and **must handle all
three object types** (it was once image-only, which silently dropped text/svg
updates).

## Object identity

An object's DOM element `id` **is** its wire id **and** its SQLite key
`(board_id, id)`. Factories must therefore preserve an `id` when one is passed
(re-import from storage/sync); only mint a fresh `nanoid` for brand-new objects.
Minting a new id on re-import makes a later edit write a **duplicate row** and
desyncs that object across clients.

## Gotchas

- **Text sizing is deferred.** `createTextElement` sets `width`/`height`/`dataset`
  in a `setTimeout`, so exporting a freshly-created text object synchronously
  yields `NaN` sizes. Defer the `addItem` a tick (see `spawnObjectsFromExports`).
- **Remote-change animation.** `updateObject(obj, true)` animates via a CSS
  transition that must cover `transform` **and** `width`/`height` (plus the SVG
  `<path>`'s scale `transform`), or resizes snap while moves glide.
- **Changing `global.svelte.ts` needs a hard refresh** of every tab — Vite HMR
  doesn't hot-patch runes modules in place.
- **Coordinate spaces.** Always convert with `Utils.screenToCanvas` /
  `canvasToScreen`; never mix screen pixels with canvas/world coords. The camera
  transform lives on `dom.camera.dataset` (`x`,`y`,`z`).

## Connection & board lifecycle

- `Container.svelte` gates on `cmState.connectionState`: it renders `Landing`
  (board picker) until **connected**, then `App`. So `App` mounts *after* join —
  `loadDomIntoMemory()` and the `joinResponse` import happen in the right order.
- **One board per tab.** `ConnectionManager.connect({ boardId, passphrase, name })`
  joins; switching boards = `leaveBoard()` (clear DOM objects + disconnect) then
  connect again. `cmState` holds the current `boardId`/`boardName`/`passphrase`.
- Joined boards persist to `localStorage` via `membership.svelte.ts` for
  one-click rejoin. The passphrase is stored **plaintext** — an accepted tradeoff
  for the self-hosted threat model.
- Presence (`presence.members`) is seeded from `joinResponse` and kept current by
  `memberJoined`/`memberLeft`.

## Clipboard & images

- **Copy/paste** uses the real `copy`/`paste` events. `onCopy` serializes the
  selected objects (any type, any count) as a marker-tagged JSON payload;
  `onPaste` detects that marker and recreates them via
  `spawnObjectsFromExports` — the shared "create from exported objects" path that
  `duplicateSelectedObjects` also uses. Routing through the single paste handler
  is deliberate (no double-paste vs the OS clipboard).
- **Image add pipeline** (`addImageFromBlob` + `uploads.svelte.ts`): convert to
  WebP client-side → show an instant base64 preview → upload to
  `POST /api/boards/:id/images` → swap the element `src` to the returned URL →
  **then** `addItem`. Never broadcast/persist the transient base64. Externally
  pasted image URLs are kept as-is (not side-loaded).
