/** Cursor for newest-first endpoints: the last item already shown. */
export function cursorOf(item?: {created_at: string; id: string}) {
  return item ? `${item.created_at}|${item.id}` : undefined;
}
