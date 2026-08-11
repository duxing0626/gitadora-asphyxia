import { PlayerInfo } from "./playerinfo";

/**
 * The WebUI board editor only exposes a 3x5 compass-style position grid (1-15) and two
 * discrete sizes (1-2), matching a reference community editor tool — it has no rotation
 * control and no continuous x/y input.
 *
 * The whole grid is now confirmed on a real cabinet: [160, 235] is the center anchor (a
 * full-board background image lines up exactly with the board panel there), and each grid step
 * — in both the 3-wide column direction and the 5-tall row direction — is a uniform 96px from
 * the center. Only rotation is still unverified (the picker has no control for it, always 0).
 * See PLAYERBOARD_DEV_NOTES.md.
 */
const CENTER_X = 160;
const CENTER_Y = 235;
const GRID_STEP = 96;
const COLUMN_OFFSETS = [CENTER_X - GRID_STEP, CENTER_X, CENTER_X + GRID_STEP];
const ROW_OFFSETS = [CENTER_Y - 2 * GRID_STEP, CENTER_Y - GRID_STEP, CENTER_Y, CENTER_Y + GRID_STEP, CENTER_Y + 2 * GRID_STEP];
// size 2 (▣) was originally guessed as 1.5x (bigger) — confirmed on a real cabinet that it does
// enlarge, but too much for normal sticker use, so it's now 0.6x (smaller) instead. size 1 (■)
// stays at the 1.0x baseline. See PLAYERBOARD_DEV_NOTES.md.
const SIZE_SCALE: Record<number, number> = { 1: 1, 2: 0.6 };

export const MIN_POSITION = 1;
export const MAX_POSITION = 15;
export const DEFAULT_POSITION = 8; // center
export const MIN_SIZE = 1;
export const MAX_SIZE = 2;
export const DEFAULT_SIZE = 1;
export const MAX_STICKER_SLOTS = 10;

export interface PickerSticker {
  id: number;
  position: number; // 1-15
  size: number; // 1-2
  /**
   * 0-based UI slot index (0..MAX_STICKER_SLOTS-1) this sticker was placed in. Stored alongside
   * the sticker (not just implied by array order) so that leaving an earlier slot empty doesn't
   * shift later slots forward the next time the board is loaded — see PLAYERBOARD_DEV_NOTES.md.
   */
  slot: number;
}

function positionToOffset(position: number): [number, number] {
  const clamped = Math.min(MAX_POSITION, Math.max(MIN_POSITION, Math.round(position)));
  const row = Math.floor((clamped - 1) / 3);
  const col = (clamped - 1) % 3;
  return [COLUMN_OFFSETS[col], ROW_OFFSETS[row]];
}

function sizeToScale(size: number): number {
  return SIZE_SCALE[size] ?? SIZE_SCALE[DEFAULT_SIZE];
}

/** Converts picker input (position/size presets) into the stored card shape. Rotation is always 0 — the picker has no rotation control. */
export function pickerToCard(stickers: PickerSticker[]): PlayerInfo['card'] {
  return stickers.map(sticker => {
    const [x, y] = positionToOffset(sticker.position);
    const scale = sizeToScale(sticker.size);
    return {
      id: sticker.id,
      position: [x, y],
      scale: [scale, scale],
      rotation: 0,
      slot: sticker.slot,
    };
  });
}

/**
 * The wire protocol has no separate field for the background — there's no "sheet"/background
 * entry anywhere in the gametop.get response, only the `sticker` list. What we call "sheet" in
 * the DB/WebUI is really just another sticker: this was confirmed on a real cabinet by placing a
 * Sheet-kind item (a full-board background image) directly in `card` at the center anchor and
 * scale 1 — it rendered correctly, filling the whole board. So to actually show up in-game, the
 * chosen sheet id needs to be merged into the `card` array as a regular entry before building the
 * response (see handlers/profiles.ts and handlers/profiles_delta.ts). It's put first in the
 * array so stickers layered on top of it are added after (assuming array order is z-order,
 * unconfirmed).
 */
export function sheetToCardEntry(sheetId: number): NonNullable<PlayerInfo['card']>[number] {
  return {
    id: sheetId,
    position: [CENTER_X, CENTER_Y],
    scale: [1, 1],
    rotation: 0,
  };
}
