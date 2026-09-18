import { PaginationControl, PaginationIndicator } from '@/app/pages/layout/cover';
import { UnifiedLayout } from '@/app/pages/layout/unified';
import type { useConference } from '../hooks/useConference';
import { renderConferenceEntity } from './entity';
export type ConferenceModel = ReturnType<typeof useConference>;
export function MediaStage({ model }: { model: ConferenceModel }) {
  const { isFullScreen, deviceType, unifiedEntities, unifiedFocusEntity, unifiedPageSize } = model;
  return <UnifiedLayout
    entities={unifiedEntities}
    focusEntity={unifiedFocusEntity}
    layoutType={unifiedFocusEntity ? 'focus' : 'grid'}
    deviceType={deviceType}
    fullScreen={isFullScreen}
    pageSize={unifiedPageSize}
    preserveOffscreen
    className="lk-unified-layout-stage"
    style={{ width: '100%', height: '100%' }}
    renderEntity={(entity, state) => renderConferenceEntity(model, entity, state)}
    renderOverlay={({ currentPage, totalPages, nextPage, prevPage }) => {
      if (totalPages <= 1) return null;

      return (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 30,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <PaginationIndicator
            totalPageCount={totalPages}
            currentPage={currentPage}
          />
          <PaginationControl
            totalPageCount={totalPages}
            currentPage={currentPage}
            nextPage={nextPage}
            prevPage={prevPage}
          />
        </div>
      );
    }}
  />;
}
