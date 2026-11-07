import type { ListSort } from '@shared/domain/sorting/list-sort';

export const PROJECT_SORT_FIELDS = [
  'name',
  'status',
  'progress',
  'responsible',
  'createdAt',
  'updatedAt',
] as const;

export type ProjectListSort = ListSort<(typeof PROJECT_SORT_FIELDS)[number]>;
