import * as h0 from './handlers/webhook';
import * as h1 from './handlers/s3';
import * as h2 from './handlers/record';
import * as h3 from './handlers/connection-details';
import * as h4 from './handlers/license';
import * as h5 from './handlers/chat';
import * as h6 from './handlers/feedback';
import * as h7 from './handlers/ai';
import * as h8 from './handlers/hello';
import * as h9 from './handlers/space';
import * as h10 from './handlers/conf';
import * as h11 from './handlers/upload';
import * as h12 from './handlers/files-file';
import * as h13 from './handlers/license-value';
import * as h14 from './handlers/license-domains-value';
import * as h15 from './handlers/webhook-status';

export const routes = [
  { path: '/api/webhook', handlers: h0 },
  { path: '/api/s3', handlers: h1 },
  { path: '/api/record', handlers: h2 },
  { path: '/api/connection-details', handlers: h3 },
  { path: '/api/license', handlers: h4 },
  { path: '/api/chat', handlers: h5 },
  { path: '/api/feedback', handlers: h6 },
  { path: '/api/ai', handlers: h7 },
  { path: '/api/hello', handlers: h8 },
  { path: '/api/space', handlers: h9 },
  { path: '/api/conf', handlers: h10 },
  { path: '/api/upload', handlers: h11 },
  { path: '/api/files/[...slug]', handlers: h12 },
  { path: '/api/license/[value]', handlers: h13 },
  { path: '/api/license/domains/[value]', handlers: h14 },
  { path: '/api/webhook/status', handlers: h15 },
];
