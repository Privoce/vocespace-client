import { Todos } from '@/lib/std/todo';
import { createClient } from '@/lib/supabase/client';
import { todos as database } from '../db/todo';
async function response(run: () => Promise<unknown>) {
  try { return Response.json(await run()); }
  catch { return Response.json({ error: 'TODO_REQUEST_FAILED' }, { status: 500 }); }
}
export const todos = {
  getTodos: (uid: string) => response(async () => ({ todos: await database.getAll(createClient(), uid) })),
  add: (todo: Todos) => response(() => database.insert(createClient(), todo)),
  deleteTodo: (uid: string, date: string, id: string) => response(() => database.deleteTodo(createClient(), uid, date, id)),
};
