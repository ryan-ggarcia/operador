'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/services';
import type { Status, UserRef } from '@/services/types';

interface ReferenceData {
  jobStatuses: Status[];
  projectStatuses: Status[];
  users: UserRef[];
  jobStatus: (id: string | null) => Status | undefined;
  projectStatus: (id: string | null) => Status | undefined;
  user: (id: string | null) => UserRef | undefined;
  reload: () => Promise<void>;
}

const Context = createContext<ReferenceData | null>(null);

function fetchAll(): Promise<[Status[], Status[], UserRef[]]> {
  return Promise.all([
    api.statuses.list('JOB', true).catch(() => []),
    api.statuses.list('PROJECT', true).catch(() => []),
    api.users.options().catch(() => []),
  ]);
}

/** Listas usadas em várias telas (status e usuários), carregadas uma vez. */
export function ReferenceDataProvider({ children }: { children: React.ReactNode }) {
  const [jobStatuses, setJobStatuses] = useState<Status[]>([]);
  const [projectStatuses, setProjectStatuses] = useState<Status[]>([]);
  const [users, setUsers] = useState<UserRef[]>([]);

  const apply = useCallback(([jobs, projects, people]: [Status[], Status[], UserRef[]]) => {
    setJobStatuses(jobs);
    setProjectStatuses(projects);
    setUsers(people);
  }, []);

  const reload = useCallback(async () => apply(await fetchAll()), [apply]);

  useEffect(() => {
    let active = true;
    fetchAll().then((result) => {
      if (active) apply(result);
    });
    return () => {
      active = false;
    };
  }, [apply]);

  const value = useMemo<ReferenceData>(() => {
    const jobMap = new Map(jobStatuses.map((status) => [status.id, status]));
    const projectMap = new Map(projectStatuses.map((status) => [status.id, status]));
    const userMap = new Map(users.map((user) => [user.id, user]));
    return {
      jobStatuses: jobStatuses.filter((status) => status.active),
      projectStatuses: projectStatuses.filter((status) => status.active),
      users,
      jobStatus: (id) => (id ? jobMap.get(id) : undefined),
      projectStatus: (id) => (id ? projectMap.get(id) : undefined),
      user: (id) => (id ? userMap.get(id) : undefined),
      reload,
    };
  }, [jobStatuses, projectStatuses, users, reload]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useReferenceData(): ReferenceData {
  const context = useContext(Context);
  if (!context) throw new Error('useReferenceData precisa estar dentro de <ReferenceDataProvider>.');
  return context;
}
