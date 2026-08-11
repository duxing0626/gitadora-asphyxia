import { PLUGIN_VER } from "../const";

const DEFAULT_NAME = '';
const DEFAULT_TITLE = '';

export interface PlayerInfo {
  collection: 'playerinfo',

  pluginVer: number;

  id: number;
  version: string,
  name: string;
  title: string;

  card?: {
    id: number;
    position: number[];
    scale: number[];
    rotation: number;
    /** 0-based WebUI slot index this sticker was placed in. Not sent to the game — see models/playerboard.ts. */
    slot?: number;
  }[];

  /** Background sheet id for the custom board. See models/playerboard.ts. */
  sheet?: number;
}

export function getDefaultPlayerInfo(version: string, id: number) : PlayerInfo {
  return {
    collection: 'playerinfo',
    pluginVer: PLUGIN_VER,
    id,
    version,
    name: DEFAULT_NAME,
    title: DEFAULT_TITLE,
  }
}

/**
 * Finds a playerinfo document from any other version for this refid, so a version
 * played for the first time can inherit the player's existing name/title instead
 * of resetting to the default. Prefers a version where the name/title were already
 * customized over one still sitting on the default placeholder values.
 */
export async function findInheritablePlayerInfo(refid: string): Promise<PlayerInfo | null> {
  const infos = await DB.Find<PlayerInfo>(refid, { collection: 'playerinfo' });
  if (!infos || infos.length === 0) {
    return null;
  }

  const customized = infos.find(info => info.name !== DEFAULT_NAME || info.title !== DEFAULT_TITLE);
  return customized ?? infos[0];
}
