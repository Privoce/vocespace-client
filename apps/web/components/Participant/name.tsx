import React from 'react';

export function PName({ name }: { name: string }) {
  // 如果name超过8个字符，仅显示前8个字符

  return <span>{name.length > 8 ? name.slice(0, 8) + '...' : name}</span>;
}
