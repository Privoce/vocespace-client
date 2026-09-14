let explicitLeaveIntent = false;
let unloadAttempt = false;

export const markExplicitLeaveIntent = () => {
  explicitLeaveIntent = true;
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