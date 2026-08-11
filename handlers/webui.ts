import { PlayerInfo } from "../models/playerinfo"
import { MAX_POSITION, MAX_SIZE, MAX_STICKER_SLOTS, MIN_POSITION, MIN_SIZE, pickerToCard, PickerSticker } from "../models/playerboard"
import Logger from "../utils/logger"

const logger = new Logger("webui")

export const updatePlayerInfo = async (data: {
  refid: string;
  version: string;
  name?: string;
  title?: string;
}) => {
  if (data.refid == null) return;

  const update: Update<PlayerInfo>['$set'] = {};

  if (data.name && data.name.length > 0) {
    //TODO: name validator
    update.name = data.name;
  }

  if (data.title && data.title.length > 0) {
    //TODO: title validator
    update.title = data.title;
  }

  await DB.Update<PlayerInfo>(
    data.refid,
    { collection: 'playerinfo', version: data.version },
    { $set: update }
  );
};

function isValidPickerStickers(value: any): value is PickerSticker[] {
  if (!Array.isArray(value) || value.length > MAX_STICKER_SLOTS) return false;

  return value.every(item =>
    item != null &&
    isFinite(item.id) &&
    isFinite(item.position) && item.position >= MIN_POSITION && item.position <= MAX_POSITION &&
    isFinite(item.size) && item.size >= MIN_SIZE && item.size <= MAX_SIZE &&
    isFinite(item.slot) && item.slot >= 0 && item.slot < MAX_STICKER_SLOTS
  );
}

// カスタムボード / プレーヤーボード is edited entirely through this WebUI form (webui/js/playerboard.js
// builds the picker UI and serializes it into the `board` field below) — the game client only ever
// displays the board, it never sends board edits back through gameend.regist. See PLAYERBOARD_DEV_NOTES.md.
export const updatePlayerBoard = async (data: {
  refid: string;
  version: string;
  board?: string;
}) => {
  if (data.refid == null) return;

  if (data.board == null || data.board.trim().length === 0) {
    return;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(data.board);
  } catch (e) {
    logger.error(`Failed to parse player board JSON for refid ${data.refid}: ${e}`);
    return;
  }

  const sheet = parsed?.sheet;
  const stickers = parsed?.stickers;

  if (sheet != null && !isFinite(sheet)) {
    logger.error(`Rejected invalid player board sheet for refid ${data.refid}`);
    return;
  }

  if (!isValidPickerStickers(stickers)) {
    logger.error(`Rejected invalid player board stickers for refid ${data.refid}`);
    return;
  }

  const update: Update<PlayerInfo>['$set'] = {
    card: pickerToCard(stickers),
  };
  if (sheet != null) {
    update.sheet = sheet;
  }

  await DB.Update<PlayerInfo>(
    data.refid,
    { collection: 'playerinfo', version: data.version },
    { $set: update }
  );
};