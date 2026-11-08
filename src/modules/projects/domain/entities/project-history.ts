import type { ProjectGoalType } from '../enums/project-goal-type.enum';
import type { ProjectHistoryType } from '../enums/project-history-type.enum';

export interface ProjectHistoryPerson {
  uuid: string;
  name: string;
}

export interface ProjectHistoryValues {
  name?: string;
  description?: string | null;
  responsible?: ProjectHistoryPerson;
  progress?: number;
}

export interface ProjectHistoryChange {
  type: ProjectHistoryType;
  goal: ProjectGoalType | null;
  previousValues: ProjectHistoryValues | null;
  newValues: ProjectHistoryValues | null;
}

export interface ProjectHistory extends ProjectHistoryChange {
  uuid: string;
  createdAt: Date;
  actor: ProjectHistoryPerson | null;
}
