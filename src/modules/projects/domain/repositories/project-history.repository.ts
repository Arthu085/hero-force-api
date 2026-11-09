import type { ProjectGoalProgressTimeline } from '../entities/project-goal-progress';
import type {
  ProjectHistory,
  ProjectHistoryChange,
} from '../entities/project-history';

export const PROJECT_HISTORY_REPOSITORY = Symbol('PROJECT_HISTORY_REPOSITORY');

export interface ProjectHistoryRepository {
  append(
    projectId: number,
    actorId: number,
    changes: readonly ProjectHistoryChange[],
  ): Promise<void>;
  findByProject(
    projectId: number,
    offset: number,
    limit: number,
  ): Promise<{ items: ProjectHistory[]; total: number }>;
  findGoalProgressTimeline(
    projectId: number,
    from: Date,
  ): Promise<ProjectGoalProgressTimeline>;
}
