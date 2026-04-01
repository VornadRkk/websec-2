import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useDebouncedValue } from './useDebouncedValue.js';

function emptyState() {
  return {
    stations: [],
    loading: false,
    error: '',
  };
}

export function useStationLookup(query, enabled = true) {
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = useDebouncedValue(deferredQuery.trim(), 420);
  const [state, setState] = useState(emptyState);

  useEffect(() => {
    if (!enabled || normalizedQuery.length < 2) {
      setState(emptyState());
      return undefined;
    }

    const controller = new AbortController();

    setState((previousState) => ({
      ...previousState,
      loading: true,
      error: '',
    }));

    api
      .searchStations(normalizedQuery, { signal: controller.signal })
      .then((result) => {
        startTransition(() => {
          setState({
            stations: result.stations || [],
            loading: false,
            error: '',
          });
        });
      })
      .catch((error) => {
        if (error.name === 'AbortError') {
          return;
        }

        setState({
          stations: [],
          loading: false,
          error: error.message,
        });
      });

    return () => {
      controller.abort();
    };
  }, [enabled, normalizedQuery]);

  return state;
}
