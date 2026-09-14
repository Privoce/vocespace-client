import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { DeviceList, PaginationCtl, PaginationInfo } from '@/lib/components';
import { mergeProps } from '@/lib/components/props';
import { createApiUrl } from '@/lib/http';

it('keeps device selection controlled and does not submit the containing form', () => {
  const onSelect = vi.fn();
  const onSubmit = vi.fn();
  const items = [{ value: 'a', label: 'Mic A' }, { value: 'b', label: 'Mic B' }];
  const view = render(<form onSubmit={onSubmit}><DeviceList items={items} activeValue="a" onSelect={onSelect} /></form>);
  fireEvent.click(screen.getByRole('button', { name: 'Mic B' }));
  expect(onSelect).toHaveBeenCalledWith('b');
  expect(onSubmit).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Mic A' }).getAttribute('aria-pressed')).toBe('true');
  view.rerender(<DeviceList items={items} activeValue="b" onSelect={onSelect} />);
  expect(screen.getByRole('button', { name: 'Mic B' }).getAttribute('aria-pressed')).toBe('true');
});

it('renders caller-provided empty text', () => {
  render(<DeviceList items={[]} activeValue="" onSelect={vi.fn()} emptyLabel="没有麦克风" />);
  expect(screen.getByText('没有麦克风')).toBeTruthy();
});

it('preserves pagination callbacks and hides controls for one page', () => {
  const pagination = { totalPageCount: 3, prevPage: vi.fn(), nextPage: vi.fn() };
  const view = render(<PaginationCtl pagination={pagination}><PaginationInfo currentPage={2} totalPageCount={3} /></PaginationCtl>);
  const buttons = screen.getAllByRole('button');
  fireEvent.click(buttons[0]);
  fireEvent.click(buttons[1]);
  expect(pagination.prevPage).toHaveBeenCalledOnce();
  expect(pagination.nextPage).toHaveBeenCalledOnce();
  expect(screen.getByText('(2/3)')).toBeTruthy();
  view.rerender(<PaginationCtl pagination={{ ...pagination, totalPageCount: 1 }}>One page</PaginationCtl>);
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  expect(screen.getByText('One page')).toBeTruthy();
});

it('merges classes and handlers while preserving previous values for undefined props', () => {
  const calls: string[] = [];
  const props = mergeProps(
    { className: 'first', title: 'kept', onClick: () => calls.push('first') },
    undefined,
    { className: 'second', title: undefined, onClick: () => calls.push('second') },
  );
  expect(props.className).toBe('first second');
  expect(props.title).toBe('kept');
  props.onClick?.({} as React.MouseEvent<HTMLElement>);
  expect(calls).toEqual(['first', 'second']);
});

it('resolves API paths and encodes query values without duplicating the deployment prefix', () => {
  const url = createApiUrl('/voce/api/conf', { name: '房间 & a', absent: undefined }, 'https://example.test');
  expect(url.pathname).toBe('/voce/api/conf');
  expect(url.searchParams.get('name')).toBe('房间 & a');
  expect(url.searchParams.has('absent')).toBe(false);
  expect(createApiUrl('/api/conf').origin).toBe(window.location.origin);
});
