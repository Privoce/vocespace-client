import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { FeedbackForm, type FeedbackFormProps } from '@vocespace/ui';
import { usePhoneMeeting } from '../packages/ui/src/meeting/usePhoneMeeting';
afterEach(cleanup);
function props(): FeedbackFormProps {
  return {
    t: (key) => key,
    Button: ({ children, onPress, disabled, label }) => (
      <button onClick={onPress} disabled={disabled} aria-label={label}>
        {children}
      </button>
    ),
    Input: ({ value, onChangeText, placeholder, disabled }) => (
      <input
        value={value}
        onChange={(e) => onChangeText(e.target.value)}
        aria-label={placeholder}
        disabled={disabled}
      />
    ),
    onSubmit: vi.fn(async () => {}),
    onUpload: vi.fn(async () => ({
      name: 'screen.png',
      url: 'https://test.invalid/feedback/screen.png',
    })),
    onDone: vi.fn(),
  };
}
it('uses the signed-in email without asking the user, preserves failed drafts and sends uploaded attachments', async () => {
  const p = props();
  vi.mocked(p.onSubmit).mockRejectedValueOnce(new Error('SMTP down'));
  render(<FeedbackForm {...p} accountEmail="member@example.test" />);
  const email = screen.getByLabelText('channel.feedback.email_placeholder') as HTMLInputElement;
  expect(email.disabled).toBe(true);
  expect(email.value).toBe('member@example.test');
  fireEvent.change(screen.getByLabelText('channel.feedback.content_placeholder'), {
    target: { value: 'Video cuts off' },
  });
  fireEvent.click(screen.getByText('channel.feedback.upload_action'));
  await screen.findByText(/screen.png/);
  fireEvent.click(screen.getByText('channel.feedback.submit'));
  await screen.findByRole('alert');
  expect(p.onDone).not.toHaveBeenCalled();
  expect(
    (screen.getByLabelText('channel.feedback.content_placeholder') as HTMLInputElement).value,
  ).toBe('Video cuts off');
  fireEvent.click(screen.getByText('channel.feedback.submit'));
  await waitFor(() => expect(p.onDone).toHaveBeenCalledOnce());
  expect(p.onSubmit).toHaveBeenLastCalledWith({
    email: 'member@example.test',
    feedbackType: 'bug',
    content: 'Video cuts off',
    attachments: ['https://test.invalid/feedback/screen.png'],
  });
});
it('validates guest email and custom type and serializes duplicate submissions', async () => {
  const p = props();
  let complete!: () => void;
  vi.mocked(p.onSubmit).mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve;
      }),
  );
  render(<FeedbackForm {...p} />);
  fireEvent.click(screen.getByText('channel.feedback.upload_action'));
  expect(p.onUpload).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('channel.feedback.email_placeholder'), {
    target: { value: 'guest@example.test' },
  });
  fireEvent.change(screen.getByLabelText('channel.feedback.content_placeholder'), {
    target: { value: 'Question' },
  });
  fireEvent.click(screen.getByLabelText('channel.feedback.types.other'));
  fireEvent.click(screen.getByText('channel.feedback.submit'));
  expect(p.onSubmit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('channel.feedback.other_placeholder'), {
    target: { value: 'Custom' },
  });
  fireEvent.click(screen.getByText('channel.feedback.submit'));
  expect((screen.getByText('channel.feedback.uploading_wait') as HTMLButtonElement).disabled).toBe(
    true,
  );
  fireEvent.click(screen.getByText('channel.feedback.uploading_wait'));
  expect(p.onSubmit).toHaveBeenCalledOnce();
  await act(async () => complete());
});
it('keeps two-person grid heights equal to three-person grid and focus rail heights stable', () => {
  const tiles = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
  ];
  const hook = renderHook(({ count }) => usePhoneMeeting(tiles.slice(0, count)), {
    initialProps: { count: 2 },
  });
  act(() => hook.result.current.measure(390, 500));
  const grid = hook.result.current.size.height;
  expect(grid).toBeLessThan(250);
  hook.rerender({ count: 3 });
  expect(hook.result.current.size.height).toBe(grid);
  act(() => hook.result.current.setPinned('a'));
  const focus = hook.result.current.size;
  hook.rerender({ count: 2 });
  expect(hook.result.current.size).toEqual(focus);
});
it('explains a missing native picker and still permits text feedback', async () => {
  const p = props();
  vi.mocked(p.onUpload).mockRejectedValue(new Error('DOCUMENT_PICKER_UNAVAILABLE'));
  render(<FeedbackForm {...p} accountEmail="member@example.test" />);
  fireEvent.change(screen.getByLabelText('channel.feedback.content_placeholder'), {
    target: { value: 'Keep this text draft' },
  });
  fireEvent.click(screen.getByText('channel.feedback.upload_action'));
  await screen.findByText('channel.feedback.document_picker_unavailable');
  fireEvent.click(screen.getByText('channel.feedback.submit'));
  await waitFor(() => expect(p.onDone).toHaveBeenCalledOnce());
  expect(p.onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({
      content: 'Keep this text draft',
      attachments: [],
    }),
  );
});
