import * as React from 'react';

export interface PaginationIndicatorProps {
  totalPageCount: number;
  currentPage: number;
}

export const PaginationIndicator: (
  props: PaginationIndicatorProps & React.RefAttributes<HTMLDivElement>,
) => React.ReactNode = /* @__PURE__ */ React.forwardRef<HTMLDivElement, PaginationIndicatorProps>(
  function PaginationIndicator({ totalPageCount, currentPage }: PaginationIndicatorProps, ref) {
    const bubbles = new Array(totalPageCount).fill('').map((_, index) => {
      if (index + 1 === currentPage) {
        return <span data-lk-active key={index} />;
      } else {
        return <span key={index} />;
      }
    });

    return (
      <div ref={ref} className="lk-pagination-indicator">
        {bubbles}
      </div>
    );
  },
);

import { createInteractingObservable } from '@livekit/components-core';
import { usePagination } from '@livekit/components-react';


export interface PaginationControlProps
  extends Pick<
    ReturnType<typeof usePagination>,
    'totalPageCount' | 'nextPage' | 'prevPage' | 'currentPage'
  > {
  /** Reference to an HTML element that holds the pages, while interacting (`mouseover`)
   *  with it, the pagination controls will appear for a while. */
  pagesContainer?: React.RefObject<HTMLElement>;
}

export function PaginationControl({
  totalPageCount,
  nextPage,
  prevPage,
  currentPage,
  pagesContainer: connectedElement,
}: PaginationControlProps) {
  const [interactive, setInteractive] = React.useState(false);
  React.useEffect(() => {
    let subscription:
      | ReturnType<ReturnType<typeof createInteractingObservable>['subscribe']>
      | undefined;
    if (connectedElement) {
      subscription = createInteractingObservable(connectedElement.current, 2000).subscribe(
        setInteractive,
      );
    }
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [connectedElement]);

  return (
    <div className="lk-pagination-control" data-lk-user-interaction={interactive}>
      <button className="lk-button" onClick={prevPage}>
        <SvgChevron />
      </button>
      <span className="lk-pagination-count">{`${currentPage} of ${totalPageCount}`}</span>
      <button className="lk-button" onClick={nextPage}>
        <SvgChevron />
      </button>
    </div>
  );
}

const SvgChevron = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} fill="none" {...props}>
    <path
      fill="currentcolor"
      fillRule="evenodd"
      d="M5.293 2.293a1 1 0 0 1 1.414 0l4.823 4.823a1.25 1.25 0 0 1 0 1.768l-4.823 4.823a1 1 0 0 1-1.414-1.414L9.586 8 5.293 3.707a1 1 0 0 1 0-1.414z"
      clipRule="evenodd"
    />
  </svg>
);
export default SvgChevron;

