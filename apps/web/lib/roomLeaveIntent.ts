import { webMeetingAnalytics } from './analytics/meeting';
let explicitLeaveIntent = false;
let unloadAttempt = false;

export const markExplicitLeaveIntent = () => {
  explicitLeaveIntent = true;
  webMeetingAnalytics.reason('user');
};

export const consumeExplicitLeaveIntent = () => {
  const current = explicitLeaveIntent;
  explicitLeaveIntent = false;
  return current;
};

export const clearExplicitLeaveIntent = () => {
  explicitLeaveIntent = false;
};

export const markUnloadAttempt = () => {
  unloadAttempt = true;
};

export const clearUnloadAttempt = () => {
  unloadAttempt = false;
};

export const hasUnloadAttempt = () => unloadAttempt;