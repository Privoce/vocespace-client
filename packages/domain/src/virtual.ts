export enum ModelRole {
  None = "None",
  Haru = 'Haru',
  Hiyori = 'Hiyori',
  Mao = 'Mao',
  Mark = 'Mark',
  Natori = 'Natori',
  Rice = 'Rice',
}

export enum ModelBg {
  ClassRoom = 'v_bg1.png',
  WaitingSpace = 'v_bg2.jpg',
  Office = 'v_bg3.jpg',
  LeisureSpace = 'v_bg4.jpg',
  MettingRoom = 'v_bg5.jpg',
}

export interface VirtualInfo {
  role: ModelRole;
  bg: ModelBg;
  enabled: boolean;
}

export function default_virtual_info(): VirtualInfo {
  return {
    role: ModelRole.Haru,
    bg: ModelBg.ClassRoom,
    enabled: false,
  };
}
