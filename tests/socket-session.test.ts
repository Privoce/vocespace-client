import { expect, it, vi } from 'vitest';

const transport = vi.hoisted(() => ({ connect: vi.fn(), disconnect: vi.fn() }));
vi.mock('socket.io-client', () => ({ io: vi.fn(() => transport) }));
import { io } from 'socket.io-client';

it('does not connect on import and disconnects only when the last owner releases', async () => {
  const { retainSocket } = await import('@/lib/realtime/socket');
  expect(io).toHaveBeenCalledWith(expect.objectContaining({ autoConnect: false }));
  expect(transport.connect).not.toHaveBeenCalled();
  const room = retainSocket();
  const dashboard = retainSocket();
  room(); room();
  expect(transport.disconnect).not.toHaveBeenCalled();
  dashboard();
  expect(transport.disconnect).toHaveBeenCalledTimes(1);
  const nextRoom = retainSocket();
  expect(transport.connect).toHaveBeenCalledTimes(3);
  nextRoom();
  expect(transport.disconnect).toHaveBeenCalledTimes(2);
});
