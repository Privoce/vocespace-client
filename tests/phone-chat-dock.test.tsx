import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { MeetingDock, MeetingChat, MeetingToolsPanel, type MeetingButtonProps, type MeetingInputProps } from '@vocespace/ui';

const Button = ({ children, onPress, label, disabled }: MeetingButtonProps) =>
  <button aria-label={label} onClick={onPress} disabled={disabled}>{children}</button>;
const Icon = () => null;
const Input = ({ value, onChangeText, placeholder }: MeetingInputProps) =>
  <input aria-label={placeholder} value={value} onChange={(event) => onChangeText(event.target.value)} />;
function Harness() {
  const [expanded, setExpanded] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [fileOpen, setFileOpen] = useState(false);
  return <>
    <MeetingDock Button={Button} Icon={Icon} chatLabel="Chat" expandLabel="Expand chat"
      expanded={expanded} onExpand={() => setExpanded(!expanded)} toolsOpen={toolsOpen}
      tools={<MeetingToolsPanel items={[{ id: 'files', label: 'Files', icon: null,
        content: (close) => <button onClick={() => { close(); setFileOpen(true); }}>View files</button> }]}
        onSelect={() => setToolsOpen(false)} />}
      chat={<MeetingChat Button={Button} Input={Input} Icon={Icon} compact={!expanded}
        maxLength={4000} draft={draft} onDraft={setDraft} onSend={() => {}} messages={[]} placeholder="Message"
        emptyLabel="No messages" sendLabel="Send"
        composerTools={<button onClick={() => setToolsOpen(!toolsOpen)}>Tools</button>} />} />
    {fileOpen && <div role="dialog" aria-label="Files"><button onClick={() => setFileOpen(false)}>Close files</button></div>}
  </>;
}
afterEach(cleanup);
it('keeps one composer and its draft when chat and the unmasked tools panel expand', () => {
  render(<Harness />);
  const composer = screen.getByRole('textbox', { name: 'Message' });
  fireEvent.change(composer, { target: { value: 'Unsent draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Expand chat' }));
  fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
  expect(screen.getAllByRole('textbox')).toHaveLength(1);
  expect(screen.getByRole('textbox')).toBe(composer);
  expect((composer as HTMLInputElement).value).toBe('Unsent draft');
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'View files' }));
  expect(screen.getByRole('dialog', { name: 'Files' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'View files' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Close files' }));
  fireEvent.click(screen.getByRole('button', { name: 'Expand chat' }));
  expect(screen.getByRole('textbox')).toBe(composer);
  expect((composer as HTMLInputElement).value).toBe('Unsent draft');
});
