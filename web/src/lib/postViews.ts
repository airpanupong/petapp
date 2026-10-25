import {useEffect} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {recordPostView} from '../api/community.api';

/** Counts a post view at most once per browser session and updates the cached post with the new total. */
export function usePostView(kind: 'lost' | 'found', id: string, ready: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!ready || !id) return;
    const key = `viewed:${kind}:${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      return;
    }
    recordPostView(kind, id)
      .then(({view_count}) => qc.setQueryData([`${kind}-post`, id], (old: object | undefined) => (old ? {...old, view_count} : old)))
      .catch(() => sessionStorage.removeItem(key));
  }, [kind, id, ready, qc]);
}
