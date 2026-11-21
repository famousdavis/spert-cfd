// Copyright (C) 2026 William W. Davis, MSPM, PMP. All rights reserved.
// Licensed under the GNU General Public License v3.0.
// See LICENSE file in the project root for full license text.

// The Projects dashboard's look, v0.18.0 (DASH26 R1a): SPERT® Forecaster's
// `src/features/projects/components/dashboard-styles.ts` at df59b2d, as literal
// class strings, so the dashboard looks the same across the suite. Forecaster's
// `spert-blue` token is CFD's too (globals.css); its other token colours are
// written here as hex values (DASH26 O8). The `dark:` classes are Forecaster's
// dark values; they stay off until CFD turns dark mode on for every screen at
// once (`@custom-variant dark` in globals.css follows a `dark` class only).
//
// ⚠️ The reveal, the whole-tile click and the grid depend on PAIRS of classes,
// and a class string is not proof that it renders:
// - the revealed row's `group-hover/tile:` and `group-focus-within/tile:`
//   match only inside an element carrying `group/tile` (the tile root);
// - the grid's `@min-[560px]:` / `@min-[860px]:` match only inside an
//   ANCESTOR carrying `@container`; on the grid itself they never match;
// - the name button's `::after` covers the tile because the tile root is
//   `relative`, and the grip, Delete and the revealed row sit above it only
//   because each is `relative z-[1]`.
// Hover is `hover:` utilities only: Tailwind 4 wraps them in
// `@media (hover: hover)`, so a touch screen never shows a hover look, and
// `[@media(hover:none)]` shows the revealed row there at rest.

/** The heading row: "Projects" on the left, the toolbar on the right; wraps on a narrow screen. */
export const HEAD_ROW = 'flex flex-wrap items-center justify-between gap-x-4 gap-y-3';
export const HEADING = 'text-2xl leading-[normal] font-bold text-[#333] dark:text-[#e2e8f0]';

/** The container the grid measures. Must be an ancestor of the grid, never the grid itself. */
export const GRID_AREA = '@container';
/** One column, two from 560 px of container width, three from 860; 16 px gaps. */
export const GRID = 'grid grid-cols-1 gap-4 @min-[560px]:grid-cols-2 @min-[860px]:grid-cols-3 list-none m-0 p-0';

/** The tile root. `group/tile` names the group the revealed row reads; `relative` anchors the name button's `::after`. */
export const TILE =
  'group/tile relative flex flex-col gap-0.5 min-w-0 pt-[10px] pr-[10px] pb-2 pl-3 border-2 rounded-[8px] cursor-pointer transition-[border-color,box-shadow,opacity,background-color] duration-[120ms] ease-in-out';
/** The untinted tile. */
export const TILE_BG = 'bg-[#f9f9f9] dark:bg-[#16213e]';
/** At rest: the border colour and its hover. */
export const TILE_BORDER = 'border-[#eee] dark:border-[#2d3748]';
export const TILE_HOVER =
  'hover:border-[#93c5fd] hover:shadow-[0_2px_10px_rgba(15,23,42,0.10)] dark:hover:border-[#3b82f6] dark:hover:shadow-[0_2px_10px_rgba(0,0,0,0.35)]';

export const NAME_ROW = 'flex items-start gap-1.5';
/** The drag grip, lifted above the name button's `::after`: under it, no drag can start. */
export const GRIP = 'relative z-[1] flex-none inline-flex mt-[5px] cursor-grab touch-none';
export const NAME =
  'flex-auto min-w-0 m-0 pt-px text-[1.05rem] font-semibold leading-[1.35] [overflow-wrap:anywhere]';
export const NAME_COLOR = 'text-[#333] dark:text-[#e2e8f0]';
/** The name button. Its `::after` covers the whole tile, so a click anywhere on the tile opens the CFD tab. */
export const OPEN =
  "bg-transparent border-0 p-0 m-0 text-left font-semibold cursor-pointer underline-offset-[3px] group-hover/tile:underline focus-visible:underline focus-visible:outline-none after:absolute after:inset-0 after:rounded-[6px] after:content-[''] focus-visible:after:shadow-[0_0_0_2px_#ffffff,0_0_0_4px_#0070f3] dark:focus-visible:after:shadow-[0_0_0_2px_var(--color-gray-900),0_0_0_4px_#60a5fa]";
export const BADGE =
  'flex-none self-center px-[7px] py-px rounded-[4px] text-[0.72rem] font-semibold leading-[normal] whitespace-nowrap bg-[#e5e7eb] text-[#374151] dark:bg-[#2d3748] dark:text-[#e2e8f0]';
/** Above the name button's `::after`, for the controls that carry no `z-[1]` of their own. */
export const ABOVE_OPEN = 'relative z-[1]';
export const META = 'm-0 pl-4 text-[0.85rem] leading-[1.45] text-[#666] dark:text-[#a0aec0]';
export const ACTIONS = 'flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 mt-auto pt-1.5 pl-2.5';
/** The revealed row: hidden at rest, shown on tile hover, on focus inside the tile, and always where there is no hover. */
export const REVEAL =
  'flex flex-wrap items-center gap-0.5 opacity-0 transition-opacity duration-[120ms] ease-in-out group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 [@media(hover:none)]:opacity-100';

// ── The project dialog (GanttApp's ProjectDialog shape; CFD's one field) ──
export const OVERLAY = 'fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50';
export const DIALOG =
  'w-full max-w-[560px] max-h-full overflow-auto px-8 py-7 rounded-[12px] text-[#333] dark:text-[#e2e8f0] shadow-[0_20px_60px_rgba(0,0,0,0.3)]';
/** The dialog's surface: the untinted tile's colour. */
export const DIALOG_BG = 'bg-[#f9f9f9] dark:bg-[#16213e]';
export const DIALOG_TITLE = 'text-xl leading-[normal] font-bold mb-4';
export const FIELD = 'mb-[0.9rem] min-w-0';
export const LABEL = 'block mb-[0.3rem] text-sm font-semibold leading-[normal] text-[#666] dark:text-[#a0aec0]';
export const INPUT =
  'w-full px-3 py-[0.6rem] text-base leading-[normal] border rounded-[4px] bg-white text-[#333] placeholder:text-[#666] dark:bg-[#2d3748] dark:text-[#e2e8f0] dark:placeholder:text-[#a0aec0] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0070f3] dark:focus-visible:outline-[#60a5fa] disabled:cursor-not-allowed disabled:opacity-70 dark:[color-scheme:dark] border-[#8a8a8a] dark:border-[#8b9bb4]';
export const DIALOG_BUTTONS = 'flex flex-wrap justify-end gap-3 mt-5';
const DIALOG_BUTTON =
  'inline-flex items-center gap-[0.4rem] px-5 py-[0.6rem] border rounded-[6px] text-[0.9rem] leading-[1.3] whitespace-nowrap cursor-pointer font-semibold disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0070f3] dark:focus-visible:outline-[#60a5fa]';
/** Cancel: the secondary look at the dialog's size, weight 600. */
export const DIALOG_CANCEL = `${DIALOG_BUTTON} bg-white text-[#333] border-[#8a8a8a] enabled:hover:bg-[#f5f5f5] dark:bg-gray-900 dark:text-[#e2e8f0] dark:border-[#8b9bb4] dark:enabled:hover:bg-[#2d3748]`;
/** Create / Update. */
export const DIALOG_SUBMIT = `${DIALOG_BUTTON} bg-spert-blue text-white border-spert-blue enabled:hover:bg-[#005bc4] enabled:hover:border-[#005bc4]`;

// ── The CFD tab's project picker (DASH26 R8, R22, O13) ──
/** "Cumulative flow for [project ▾]": 16 px, sentence case, one line; the select shrinks with an ellipsis. */
export const PICKER_ROW = 'mb-2 flex min-w-0 items-baseline gap-x-1.5 whitespace-nowrap text-base leading-6 text-[#666] dark:text-[#a0aec0]';
export const PICKER_SELECT =
  'min-w-0 max-w-full [field-sizing:content] overflow-hidden text-ellipsis whitespace-nowrap cursor-pointer rounded-[4px] border-0 bg-transparent p-0 font-semibold text-[#333] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0070f3] dark:text-[#e2e8f0] dark:[color-scheme:dark] dark:focus-visible:outline-[#60a5fa]';
