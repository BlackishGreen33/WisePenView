import { useStore } from 'zustand';

import { driveRefreshStore } from '@/domains/Drive/session/driveRefresh';

/** 各 Drive 实例订阅同一变更版本，分别重新加载自己的数据。 */
export function useDriveRefreshVersion(): number {
  return useStore(driveRefreshStore, (state) => state.refreshVersion);
}
