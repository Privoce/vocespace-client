import { isMobile, mergeProps } from '@/lib/std';
import {
  GridLayoutProps,
  TrackLoop,
  useGridLayout,
  usePagination,
  useSwipe,
} from '@livekit/components-react';
import React from 'react';

import { PaginationControl, PaginationIndicator } from './cover';
import { PaginationCtl, PaginationInfo } from '@/components/Widgets/pagination';


/**
 *  ## GLayout
 * enhanced GridLayout component for LiveKit (better pagination component)
 * @param
 * @returns
 */
export function GLayout({ tracks, ...props }: GridLayoutProps) {
  // LiveKit 2.8 uses React 18 ref declarations; its hooks guard null at runtime.
  const gridEl = React.useRef<HTMLDivElement>(null);

  const elementProps = React.useMemo(
    () => mergeProps(props, { className: 'lk-grid-layout' }),
    [props],
  );
  const { layout } = useGridLayout(gridEl as React.RefObject<HTMLDivElement>, tracks.length);
  const pagination = usePagination(layout.maxTiles, tracks);

  useSwipe(gridEl as React.RefObject<HTMLElement>, {
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
  players,
  ...props
}: GridLayoutProps & { players?: React.ReactNode[] }) {
  // LiveKit 2.8 uses React 18 ref declarations; its hooks guard null at runtime.
  const gridEl = React.useRef<HTMLDivElement>(null);
  const shouldForceTwoColumns = !isMobile() && !!players && players.length > 0 && tracks.length <= 2;

  const elementProps = React.useMemo(
    () =>
      mergeProps(props, {
        className: 'lk-grid-layout',
        ...(shouldForceTwoColumns
          ? {
              style: {
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              },
            }
          : {}),
      }),
    [props, shouldForceTwoColumns],
  );
  const { layout } = useGridLayout(gridEl as React.RefObject<HTMLDivElement>, tracks.length);
  const pagination = usePagination(layout.maxTiles, tracks);

  useSwipe(gridEl as React.RefObject<HTMLElement>, {
    onLeftSwipe: pagination.nextPage,
    onRightSwipe: pagination.prevPage,
  });
  return (
    <div ref={gridEl} data-lk-pagination={pagination.totalPageCount > 1} {...elementProps}>
      <TrackLoop tracks={pagination.tracks}>{props.children}</TrackLoop>
      {players}
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
