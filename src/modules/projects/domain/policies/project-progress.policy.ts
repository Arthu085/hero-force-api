import {
  PROJECT_GOAL_PROGRESS_MAX,
  PROJECT_GOAL_PROGRESS_MIN,
} from '../constraints/project-input.constraints';
import { ProjectStatus } from '../enums/project-status.enum';

interface GoalProgress {
  readonly progress: number;
}

export function calculateProjectProgress(
  goals: readonly GoalProgress[],
): number {
  if (goals.length === 0) {
    return PROJECT_GOAL_PROGRESS_MIN;
  }

  const total = goals.reduce((sum, goal) => sum + goal.progress, 0);

  return Math.floor(total / goals.length);
}

export function deriveProjectStatus(
  goals: readonly GoalProgress[],
): ProjectStatus {
  if (goals.every((goal) => goal.progress === PROJECT_GOAL_PROGRESS_MIN)) {
    return ProjectStatus.PENDING;
  }

  if (goals.every((goal) => goal.progress === PROJECT_GOAL_PROGRESS_MAX)) {
    return ProjectStatus.COMPLETED;
  }

  return ProjectStatus.IN_PROGRESS;
}
