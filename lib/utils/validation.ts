
export const isUndefinedString = (value: string | undefined): boolean => {
  return value === undefined || value.trim() === '';
};


export const isUndefinedNumber = (value: number | undefined): boolean => {
  return value === undefined || isNaN(value);
};
