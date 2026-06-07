# Sprint 7 Design Brief: Trip Profile Inline Editing

## Goal & UX Summary

Make every field in the Trip Profile card directly editable by clicking on it — no chat interaction required.

**Pattern:** click a field → a popover opens anchored to that row → user edits → commits on Enter or by clicking away, cancels on Esc → popover closes.

This applies to all fields in the Trip Profile, both single-value fields (Origin, Travelers, When, Duration, Budget) and tag/chip fields (Vacation type & vibe, Things we like, Let's avoid).

When the agent sends updated trip profile data, it overwrites any local edits (last-write-wins).

---

## Layout

The Trip Profile is a card with two rows of fields:

- **Top row:** 5 equal-width columns — Origin, Travelers, When, Duration, Budget
- **Divider** between the two rows
- **Bottom row:** 3 equal-width columns — Vacation type & vibe, Things we like, Let's avoid

Bottom row cells grow vertically as chips wrap — they are not fixed height.

---

## Field Row (the clickable trigger)

Each field row is a clickable button spanning the full width of its column. Clicking anywhere on the row opens the editor popover.

**Visual structure of each row:**
- A small circular icon bubble on the left (color varies per field — see below)
- Label text above in small caps / muted style
- Value below in slightly larger, medium-weight text

**Hover state:** a small pencil icon appears next to the label (subtle, opacity transition). This signals the row is editable without cluttering the default state.

**Keyboard:** the row is a real button element, so it's tab-focusable and has a visible focus ring.

**Icon bubble accent colors:**
- Origin → blue/ocean
- Travelers → teal
- When → yellow/sun
- Duration → sage/green
- Budget → coral/red-pink
- Vacation type & vibe → yellow/sun
- Things we like → coral/red-pink
- Let's avoid → blue/ocean

**Empty state:** if a field has no value, display "not set" in italics/muted style. For chip fields, same.

---

## Popover

- Opens left-aligned to the field row, ~256px wide
- Uses the existing Radix popover component already in the project
- Contains either a **ScalarEditor** or an **ArrayEditor** depending on the field type
- Single-value fields (Origin, Travelers, When, Duration, Budget) → ScalarEditor
- Chip fields (Vibe, Likes, Avoid) → ArrayEditor

---

## ScalarEditor (single-value fields)

**Layout:**
```
[LABEL IN CAPS]
[ text input — autofocused ]
Enter to save · Esc to cancel
```

**Behavior:**
- Input is pre-populated with the current value
- Enter → saves the trimmed value and closes the popover
- Esc → cancels, no change, closes the popover
- Clicking away (blur) → saves the current draft
- All scalar fields are free text — no dropdowns or validation

---

## ArrayEditor (chip fields)

**Layout:**
```
[LABEL IN CAPS]
[chip ×]  [chip ×]  [chip ×]
[ text input — autofocused        ] [ + ]
Enter to add · Backspace to remove last · Esc to close
```

**Behavior:**
- Existing chips displayed with an × remove button each
- Input field for adding new chips
- Enter → adds the typed value as a new chip (trimmed; duplicates ignored), clears input
- Backspace when input is empty → removes the last chip
- Esc → closes the popover (chips already added/removed are kept)
- Clicking away → adds any pending input text as a chip before closing
- The `+` button adds the current input text
- Chip style: pill shape, cream/light background, medium weight text

---

## Accessibility

- Each field row is a `<button>` with an accessible label (e.g. "Edit Origin")
- Chip remove buttons have accessible labels (e.g. "Remove swimming")
- The editor input autofocuses when the popover opens
- Esc closes the popover (both via keyboard handler and Radix built-in dismiss)
- Focus rings use the existing theme tokens

---

## Out of Scope for This Sprint

- No saving edits back to the server — edits are client-side only
- No locking user edits against agent overwrite
- No validation or constrained selectors (Budget, Duration are free text)
- No drag-to-reorder chips
- No undo/redo
