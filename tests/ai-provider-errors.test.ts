// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { aiAnalysisError } from '../services/api/lib/ai/errors';
import { AICutAnalysisService } from '../services/api/lib/ai/analysis';

const quotaError = { status: 403, code: 'AllocationQuota.FreeTierOnly', message: 'private-provider-detail', headers: { authorization: 'private-key' } };
function setup() {
  const service = new AICutAnalysisService('sk-test-not-real', 'https://provider.invalid/v1', 'test-model', {
    analysis: { system: 'test', user: '{current_timestamp}' },
    summary: { system: 'test', user: 'test' },
    extraction: { easy: '', medium: '', max: '' },
  }, 1);
  const create = vi.fn();
  // Inject a local provider stub: no screenshot or credential leaves this test.
  Object.assign(service, { OPENAI: { chat: { completions: { create } } } });
  return { service, create };
}
it('maps provider quota denial to a stable public error without private data', () => {
  const result = aiAnalysisError(quotaError);
  expect(result.status).toBe(503);
  expect(result.body.code).toBe('AI_QUOTA_EXHAUSTED');
  expect(JSON.stringify(result)).not.toContain('private-');
  expect(aiAnalysisError({ error: quotaError }).body.code).toBe('AI_QUOTA_EXHAUSTED');
  expect(aiAnalysisError(new Error('private-key')).body.code).toBe('AI_ANALYSIS_FAILED');
});
it('does not request a summary when nothing was analyzed', async () => {
  const { service, create } = setup();
  await service.stop();
  expect(create).not.toHaveBeenCalled();
});
it('preserves earlier results and avoids another model request after quota failure', async () => {
  const { service, create } = setup();
  const content = JSON.stringify({ timestamp: 1, name: 'Task', content: 'Work', same: 0 });
  create.mockResolvedValueOnce({ choices: [{ message: { content } }] }).mockRejectedValueOnce(quotaError);
  await service.doAnalysisLine({ data: 'data:image/jpeg;base64,test', timestamp: 1, showTime: false }, []);
  expect(service.result.lines).toHaveLength(1);
  await expect(service.doAnalysisLine({ data: 'data:image/jpeg;base64,test', timestamp: 2, showTime: false }, [])).rejects.toEqual(quotaError);
  const result = await service.stop();
  expect(result.lines).toHaveLength(1);
  expect(create).toHaveBeenCalledTimes(2);
});
it('still summarizes a healthy session', async () => {
  const { service, create } = setup();
  create.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ timestamp: 1, name: 'Task', content: 'Work', same: 0 }) } }] })
    .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ summary: 'Summary', markdown: '# Work' }) } }] });
  await service.doAnalysisLine({ data: 'data:image/jpeg;base64,test', timestamp: 1, showTime: false }, []);
  expect((await service.stop()).markdown).toBe('# Work');
  expect(create).toHaveBeenCalledTimes(2);
});
