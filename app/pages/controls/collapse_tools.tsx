import { CSSProperties } from 'react';

export const DEFAULT_COLLAPSE_HEADER_STYLES: {
  header?: CSSProperties;
  body?: CSSProperties;
} = {
  header: {
    backgroundColor: '#1e1e1e',
    borderBottom: '1px solid #333',
  },
  body: {
    backgroundColor: '#1e1e1e',
  }
};
