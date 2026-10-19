'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MeetingSheet, type MeetingSheetProps } from '@vocespace/ui';
import { MeetingButton, MeetingIcon } from './primitives';
/** DOM portal owns keyboard focus only; the sheet itself is shared with Native. */
export function PhoneSheet(
  props: Omit<MeetingSheetProps, 'Button' | 'Icon' | 'content'> & { children: ReactNode },
) {
  const [mounted, setMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(props.onClose);
  close.current = props.onClose;
  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (!mounted || !props.open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (!ref.current) return;
      const active = document.activeElement;
      const topDialog = Array.from(
        document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'),
      )
        .filter((el) => el.getClientRects().length)
        .at(-1);
      if (topDialog && topDialog !== ref.current) return;
      if (active !== document.body && !ref.current.contains(active)) return;
      if (event.key === 'Escape') {
        event.stopPropagation();
        close.current();
      }
      if (event.key === 'Tab') {
        const candidates = Array.from(
          ref.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]',
          ),
        ).filter((el) => el.getClientRects().length);
        const first = candidates[0],
          last = candidates.at(-1);
        if (!first) {
          event.preventDefault();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current ||
            document.activeElement === document.body)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last ||
            document.activeElement === ref.current ||
            document.activeElement === document.body)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKey);
      if (previous?.isConnected && previous.getClientRects().length) previous.focus();
    };
  }, [props.open, props.title, mounted]);
  if (!mounted) return null;
  return createPortal(
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-modal={props.open}
      aria-label={props.title}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1050,
        display: props.open ? 'flex' : 'none',
        outline: 'none',
      }}
    >
      <MeetingSheet {...props} Button={MeetingButton} Icon={MeetingIcon} content={props.children} />
    </div>,
    document.body,
  );
}
