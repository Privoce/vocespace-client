import { mergeProps } from '@/lib/std';
import {
  GridLayoutProps,
  TrackLoop,
  useGridLayout,
  usePagination,
  useSwipe,
} from '@livekit/components-react';
import React from 'react';
import { PaginationCtl, PaginationInfo } from '../controls/widgets/pagination';
import { PaginationControl, PaginationIndicator } from './cover';
import { TilePlayer } from '../participant/player';
import { MessageInstance } from 'antd/es/message/interface';

/**
 *  ## GLayout
 * enhanced GridLayout component for LiveKit (better pagination component)
 * @param
 * @returns
 */
export function GLayout({ tracks, ...props }: GridLayoutProps) {
  const gridEl = React.createRef<HTMLDivElement>();

  const elementProps = React.useMemo(
    () => mergeProps(props, { className: 'lk-grid-layout' }),
    [props],
  );
  const { layout } = useGridLayout(gridEl, tracks.length);
  const pagination = usePagination(layout.maxTiles, tracks);

  useSwipe(gridEl, {
    onLeftSwipe: pagination.nextPage,
    onRightSwipe: pagination.prevPage,
  });

  return (
    <PaginationCtl pagination={pagination}>
      <div ref={gridEl} data-lk-pagination={pagination.totalPageCount > 1} {...elementProps}>
        <TrackLoop tracks={pagination.tracks}>{props.children}</TrackLoop>
        {tracks.length > layout.maxTiles && (
          <div
            style={{
              height: 'fit-content',
              width: '100%',
              position: 'absolute',
              bottom: -6,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: '111',
            }}
          >
            <PaginationInfo
              totalPageCount={pagination.totalPageCount}
              currentPage={pagination.currentPage}
            ></PaginationInfo>
          </div>
        )}
      </div>
    </PaginationCtl>
  );
}

export function GLayout2({
  tracks,
  player,
  ...props
}: GridLayoutProps & { player: React.ReactNode }) {
  const gridEl = React.createRef<HTMLDivElement>();

  const elementProps = React.useMemo(
    () =>
      mergeProps(props, {
        className: 'lk-grid-layout',
        ...(player != undefined && tracks.length <= 2
          ? {
              style: {
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              },
            }
          : {}),
      }),
    [props, player],
  );
  const { layout } = useGridLayout(gridEl, tracks.length);
  const pagination = usePagination(layout.maxTiles, tracks);

  useSwipe(gridEl, {
    onLeftSwipe: pagination.nextPage,
    onRightSwipe: pagination.prevPage,
  });
  return (
    <div ref={gridEl} data-lk-pagination={pagination.totalPageCount > 1} {...elementProps}>
      <TrackLoop tracks={pagination.tracks}>{props.children}</TrackLoop>
      {player}
      {tracks.length > layout.maxTiles && (
        <>
          <PaginationIndicator
            totalPageCount={pagination.totalPageCount}
            currentPage={pagination.currentPage}
          />
          <PaginationControl pagesContainer={gridEl} {...pagination} />
        </>
      )}
    </div>
  );
}
