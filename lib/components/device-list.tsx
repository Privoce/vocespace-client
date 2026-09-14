'use client';

import type { ReactNode } from 'react';

export interface DeviceListProps {
  items: readonly { value: string; label: string }[];
  activeValue: string;
  onSelect: (value: string) => void;
  emptyLabel?: ReactNode;
}

/** Controlled list; device discovery, permissions and switching belong to the caller. */
export function DeviceList({
  items,
  activeValue,
  onSelect,
  emptyLabel = 'No devices found',
}: DeviceListProps) {
  return (
    <div style={{ width: 320, maxHeight: 240, overflowY: 'auto', marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((device) => {
        const isActive = device.value === activeValue;
        return (
          <button
            key={device.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(device.value)}
            style={{
              width: '100%',
              textAlign: 'left',
              padding: '10px 12px',
              borderRadius: 8,
              border: isActive ? '1px solid #1677ff' : '1px solid rgba(255,255,255,0.12)',
              background: isActive ? 'rgba(22,119,255,0.14)' : 'rgba(255,255,255,0.04)',
              color: 'inherit',
              cursor: 'pointer',
            }}
          >
            {device.label}
          </button>
        );
      })}
      {items.length === 0 && <div style={{ padding: '10px 12px', opacity: 0.7 }}>{emptyLabel}</div>}
    </div>
  );
}
