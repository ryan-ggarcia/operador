'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface Resource<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  /** Busca de novo; resolve quando a resposta chega. */
  reload: () => Promise<void>;
  setData: (data: T) => void;
}

interface State<T> {
  key: string | null;
  data: T | undefined;
  error: Error | null;
}

/**
 * Carrega um recurso da API e busca de novo quando as dependências mudam.
 * Enquanto carrega, mantém os dados anteriores na tela. Respostas de
 * requisições antigas são descartadas.
 */
export function useResource<T>(load: () => Promise<T>, deps: unknown[]): Resource<T> {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<State<T>>({ key: null, data: undefined, error: null });
  const loadRef = useRef(load);
  const waiting = useRef<(() => void)[]>([]);
  const requestKey = `${JSON.stringify(deps)}#${nonce}`;

  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    let active = true;
    const finish = () => {
      const resolvers = waiting.current;
      waiting.current = [];
      resolvers.forEach((resolve) => resolve());
    };
    loadRef.current().then(
      (data) => {
        if (!active) return;
        setState({ key: requestKey, data, error: null });
        finish();
      },
      (error: Error) => {
        if (!active) return;
        setState((current) => ({ key: requestKey, data: current.data, error }));
        finish();
      },
    );
    return () => {
      active = false;
    };
  }, [requestKey]);

  const reload = useCallback(
    () =>
      new Promise<void>((resolve) => {
        waiting.current.push(resolve);
        setNonce((value) => value + 1);
      }),
    [],
  );

  const setData = useCallback((data: T) => setState((current) => ({ ...current, data })), []);

  return {
    data: state.data,
    error: state.error,
    loading: state.key !== requestKey,
    reload,
    setData,
  };
}
