'use client';

import { useEffect, useImperativeHandle, useMemo } from 'react';
import type { VideoLayoutEntity } from '../shared';
import type { useConferenceMedia } from './useConferenceMedia';

export function useConferenceLayout(context: ReturnType<typeof useConferenceMedia>) {
  const {
    space,
    selfRoom,
    tilePlayerItems,
    focusedTilePlayerId,
    isTilePlayerFocused,
    trackEntities,
    focusedTrackEntity,
    device,
    layoutContext,
    ref,
    clearRoom,
  } = context;
  const tilePlayerEntities = useMemo<VideoLayoutEntity[]>(() => {
    if (!space?.name || !selfRoom) return [];
    return [
      { id: 'tile-player:add', category: 'tile-player-add', type: 'tile-player-add', label: 'tile-player-add', payload: null },
      ...tilePlayerItems.map(item => ({ id: `tile-player:${item.id}`, category: 'tile-player' as const, type: 'tile-player', label: item.id, payload: item })),
    ];
  }, [space?.name, selfRoom, tilePlayerItems]);
  const unifiedEntities = useMemo(() => [...trackEntities, ...tilePlayerEntities], [trackEntities, tilePlayerEntities]);
  const unifiedFocusEntity = isTilePlayerFocused
    ? tilePlayerEntities.find(entity => entity.id === `tile-player:${focusedTilePlayerId}`) ?? null
    : focusedTrackEntity;
  const unifiedPageSize = device === 'phone' ? 4 : unifiedFocusEntity ? 5 : 9;
  useEffect(() => {
    if (focusedTilePlayerId && !tilePlayerItems.some(item => item.id === focusedTilePlayerId)) {
      layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
    }
  }, [focusedTilePlayerId, tilePlayerItems, layoutContext]);
  useImperativeHandle(ref, () => ({ clearRoom }));
  return { ...context, tilePlayerEntities, unifiedEntities, unifiedFocusEntity, unifiedPageSize };
}
