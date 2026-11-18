/** Public errors must never include provider headers, credentials, or request bodies. */
export function aiAnalysisError(error: unknown) {
  const value = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const nested = value.error && typeof value.error === 'object'
    ? value.error as Record<string, unknown> : {};
  if (value.code === 'AllocationQuota.FreeTierOnly' || nested.code === 'AllocationQuota.FreeTierOnly') {
    return {
      status: 503,
      body: {
        code: 'AI_QUOTA_EXHAUSTED',
        error: 'The AI provider free quota is exhausted and free-tier-only mode is enabled. Contact the deployment administrator to review the provider billing settings.',
      },
    };
  }
  return {
    status: 500,
    body: { code: 'AI_ANALYSIS_FAILED', error: 'Failed to process AI analysis request.' },
  };
}
