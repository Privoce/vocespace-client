import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SvgResource } from '../apps/web/components/Icon';
import { OriginalMeetingIcon } from './fixtures/meeting-icons-original';
it('preserves approved Web SVGs while Native uses separate LiveKit toolbar variants', () => {
  for (const type of ['screen', 'leave', 'focus', 'host'] as const)
    for (const size of [16, 28, '1em']) {
      const props = { type, svgSize: size, color: '#22CCEE' };
      expect(renderToStaticMarkup(<SvgResource {...props} />)).toBe(
        renderToStaticMarkup(<OriginalMeetingIcon {...props} />),
      );
    }
});
