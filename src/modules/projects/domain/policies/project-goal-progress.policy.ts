import type { ProjectGoal } from '../entities/project.entity';
import type {
  ProjectGoalProgress,
  ProjectGoalProgressTimeline,
} from '../entities/project-goal-progress';
import { ProjectGoalProgressPeriod } from '../enums/project-goal-progress-period.enum';
import { ProjectHistoryType } from '../enums/project-history-type.enum';

const DAY_MS = 24 * 60 * 60 * 1000;

const PERIOD_DAYS: Record<
  Exclude<ProjectGoalProgressPeriod, ProjectGoalProgressPeriod.ALL>,
  number
> = {
  [ProjectGoalProgressPeriod.LAST_7_DAYS]: 7,
  [ProjectGoalProgressPeriod.LAST_30_DAYS]: 30,
  [ProjectGoalProgressPeriod.LAST_90_DAYS]: 90,
};

const latest = (left: Date, right: Date): Date =>
  left.getTime() >= right.getTime() ? left : right;

export function goalProgressWindowStart(
  period: ProjectGoalProgressPeriod,
  now: Date,
  projectCreatedAt: Date,
): Date {
  if (period === ProjectGoalProgressPeriod.ALL) {
    return projectCreatedAt;
  }

  return latest(
    new Date(now.getTime() - PERIOD_DAYS[period] * DAY_MS),
    projectCreatedAt,
  );
}

export interface BuildGoalProgressInput {
  period: ProjectGoalProgressPeriod;
  now: Date;
  from: Date;
  projectCreatedAt: Date;
  goals: readonly ProjectGoal[];
  timeline: ProjectGoalProgressTimeline;
}

function trackingStart(
  timeline: ProjectGoalProgressTimeline,
  projectCreatedAt: Date,
): Date | null {
  if (!timeline.firstEvent) {
    return null;
  }

  return timeline.firstEvent.type === ProjectHistoryType.PROJECT_CREATED
    ? projectCreatedAt
    : timeline.firstEvent.at;
}

export function buildGoalProgress(
  input: BuildGoalProgressInput,
): ProjectGoalProgress {
  const { timeline } = input;
  const trackedSince = trackingStart(timeline, input.projectCreatedAt);
  const recordedFrom = trackedSince ? latest(input.from, trackedSince) : null;
  const lastChange = timeline.changes.at(-1);

  return {
    period: input.period,
    from: input.from,
    to: lastChange ? latest(input.now, lastChange.at) : input.now,
    recordedFrom,
    goals: input.goals.map(({ goal, progress }) => {
      const changes = timeline.changes
        .filter((change) => change.goal === goal)
        .map(({ at, previousProgress, progress: next }) => ({
          at,
          previousProgress,
          progress: next,
        }));

      const before = timeline.progressBefore.find(
        (entry) => entry.goal === goal,
      );

      return {
        goal,
        startProgress: recordedFrom
          ? (before?.progress ?? changes[0]?.previousProgress ?? progress)
          : null,
        currentProgress: progress,
        changes,
      };
    }),
  };
}
