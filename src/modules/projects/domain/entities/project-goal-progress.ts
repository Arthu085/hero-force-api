import type { ProjectGoalType } from '../enums/project-goal-type.enum';
import type { ProjectGoalProgressPeriod } from '../enums/project-goal-progress-period.enum';
import type { ProjectHistoryType } from '../enums/project-history-type.enum';

export interface ProjectGoalProgressChange {
  at: Date;
  previousProgress: number;
  progress: number;
}

export interface ProjectGoalProgressSeries {
  goal: ProjectGoalType;
  startProgress: number | null;
  currentProgress: number;
  changes: ProjectGoalProgressChange[];
}

export interface ProjectGoalProgress {
  period: ProjectGoalProgressPeriod;
  from: Date;
  to: Date;
  recordedFrom: Date | null;
  goals: ProjectGoalProgressSeries[];
}

export interface ProjectGoalProgressTimeline {
  firstEvent: { type: ProjectHistoryType; at: Date } | null;
  progressBefore: { goal: ProjectGoalType; progress: number }[];
  changes: (ProjectGoalProgressChange & { goal: ProjectGoalType })[];
}
