# Skip the hover/click race guard on contentless nav triggers

**Status: decided, in effect now.** `src/components/navigation-menu-trigger.tsx`'s
`MutationObserver`/`disable`-timer workaround (adapted from
[radix-ui/primitives#1630 comment](https://github.com/radix-ui/primitives/issues/1630#issuecomment-1545995075))
now only installs for triggers with a dropdown (`hasContent`). Plain links like the navbar's
`/arhiv` item no longer run it at all.

## Why this needed deciding

The `/arhiv` navbar link intermittently had its click silently cancelled in production
(Chrome showed the link target, navigation never happened), reported once, not reproducible by
the reporter.

Radix flips a trigger's `data-state` to `"open"` on hover regardless of whether it has an
attached `NavigationMenuContent` — open just means "this is the active item," not "there is
something to render." The guard's `MutationObserver` watches that attribute on the trigger's own
node and blocks clicks for 1000ms after it flips open, to stop a genuine open/close flicker on
triggers *with* a dropdown. For a contentless trigger, though, the guard was watching a
state-flip with no dropdown behind it — an ordinary hover-then-click could race the observer's
callback against the click handler and lose, cancelling a perfectly deliberate click for no
UX benefit at all.

## Considered options

- **Keep the guard as-is for every trigger.** Rejected: it's the actual cause of the bug for
  content-less triggers, and buys them nothing — there's no open/close state to protect.
- **Wait for Radix's upstream `activationMode="manual"`/`disableToggle`.** These props landed in
  Radix's `main` days before this decision but are unreleased (no version bump, undocumented) —
  not installable today, and adopting them would be a real hover-vs-click UX change, not a
  drop-in fix. Deferred, not rejected outright; worth revisiting once released.
- **Gate the guard on `hasContent` (chosen).** Small, local, addresses the actual mechanism of
  the bug directly: triggers with a dropdown keep exactly the behavior they had; triggers without
  one skip the `MutationObserver` and `disable` state entirely, so nothing can ever
  `preventDefault()` their click.

## Consequences

- Triggers with `hasContent` are unchanged — this doesn't touch the flicker-prevention behavior
  the guard exists for.
- If a future contentless trigger needs any hover-driven behavior, it won't get this guard for
  free; that's intentional, since the guard's cost (occasionally eating a real click) never had a
  matching benefit for that case.

## What would change the answer

- Radix's `activationMode`/`disableToggle` shipping in a released version.
