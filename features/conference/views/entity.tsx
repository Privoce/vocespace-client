import { TilePlayer, TilePlayerAdd, type TilePlayerItem } from '@/app/pages/participant/player';
import { ParticipantItem } from '@/app/pages/participant/tile';
import { newPlayerTrack, type TrackReferenceOrPlaceholder, type VideoLayoutEntity } from '../shared';
import type { ConferenceModel } from './media-stage';

export function renderConferenceEntity(model: ConferenceModel, entity: VideoLayoutEntity, state: { isFocus: boolean }) {
  const {
    space,
    settings,
    selfRoom,
    messageApi,
    noteApi,
    setUserStatus,
    updateSettings,
    toRenameSetting,
    toSettingGeneral,
    showFlotApp,
    isFocus,
    fetchTilePlayers,
    fetchSettings,
    layoutContext,
    focusedTilePlayerId,
  } = model;
  if (!space) return null;
  if (entity.category === 'track') return <ParticipantItem trackRef={entity.payload as TrackReferenceOrPlaceholder}
    space={space} settings={settings} toSettings={toSettingGeneral} messageApi={messageApi} noteApi={noteApi}
    setUserStatus={setUserStatus} updateSettings={updateSettings} toRenameSettings={toRenameSetting}
    showFlotApp={showFlotApp} selfRoom={selfRoom} isFocus={state.isFocus || isFocus} />;
  if (!selfRoom) return null;
  if (entity.category === 'tile-player-add') return <TilePlayerAdd spaceName={space.name} room={selfRoom.name}
    myIdentity={space.localParticipant.identity} messageApi={messageApi} iframeUrls={settings.iframeUrls}
    onCreated={() => { void fetchTilePlayers(); void fetchSettings(); }} />;
  const item = entity.payload as TilePlayerItem;
  return <TilePlayer spaceInfo={settings} item={item} spaceName={space.name} room={selfRoom.name}
    roomParticipantIds={selfRoom.participants} myIdentity={space.localParticipant.identity} messageApi={messageApi}
    focus={focusedTilePlayerId === item.id} onRemoved={fetchTilePlayers}
    afterFocus={focus => layoutContext.pin.dispatch?.(focus ? { msg: 'set_pin', trackReference: newPlayerTrack(space.name, item.id) } : { msg: 'clear_pin' })} />;
}
