import type { ProjectGoal } from '../../entities/project.entity';
import type { ProjectGoalProgressTimeline } from '../../entities/project-goal-progress';
import { ProjectGoalProgressPeriod } from '../../enums/project-goal-progress-period.enum';
import {
  PROJECT_GOAL_TYPES,
  ProjectGoalType,
} from '../../enums/project-goal-type.enum';
import { ProjectHistoryType } from '../../enums/project-history-type.enum';
import {
  buildGoalProgress,
  goalProgressWindowStart,
} from '../project-goal-progress.policy';

const now = new Date('2026-06-30T12:00:00.000Z');

const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

const goalsAt = (
  progress: Partial<Record<ProjectGoalType, number>> = {},
): ProjectGoal[] =>
  PROJECT_GOAL_TYPES.map((goal) => ({
    goal,
    description: null,
    progress: progress[goal] ?? 0,
  }));

const emptyTimeline: ProjectGoalProgressTimeline = {
  firstEvent: null,
  progressBefore: [],
  changes: [],
};

const created = (at: Date): ProjectGoalProgressTimeline['firstEvent'] => ({
  type: ProjectHistoryType.PROJECT_CREATED,
  at,
});

const build = ({
  projectCreatedAt = daysAgo(200),
  from = daysAgo(30),
  goals = goalsAt(),
  timeline = emptyTimeline,
}: {
  projectCreatedAt?: Date;
  from?: Date;
  goals?: ProjectGoal[];
  timeline?: ProjectGoalProgressTimeline;
}) =>
  buildGoalProgress({
    period: ProjectGoalProgressPeriod.LAST_30_DAYS,
    now,
    from,
    projectCreatedAt,
    goals,
    timeline,
  });

const seriesOf = (
  result: ReturnType<typeof buildGoalProgress>,
  goal: ProjectGoalType,
) => result.goals.find((series) => series.goal === goal);

describe('goalProgressWindowStart', () => {
  it.each([
    [ProjectGoalProgressPeriod.LAST_7_DAYS, 7],
    [ProjectGoalProgressPeriod.LAST_30_DAYS, 30],
    [ProjectGoalProgressPeriod.LAST_90_DAYS, 90],
  ])('starts %s exactly %i days before now', (period, days) => {
    expect(goalProgressWindowStart(period, now, daysAgo(365))).toEqual(
      daysAgo(days),
    );
  });

  it('never starts before the project was created', () => {
    const createdAt = daysAgo(3);

    expect(
      goalProgressWindowStart(
        ProjectGoalProgressPeriod.LAST_30_DAYS,
        now,
        createdAt,
      ),
    ).toEqual(createdAt);
  });

  it('starts the whole history at the project creation', () => {
    const createdAt = daysAgo(1000);

    expect(
      goalProgressWindowStart(ProjectGoalProgressPeriod.ALL, now, createdAt),
    ).toEqual(createdAt);
  });
});

describe('buildGoalProgress', () => {
  it('returns flat zero series for a tracked project without progress changes', () => {
    const createdAt = daysAgo(10);

    const result = build({
      projectCreatedAt: createdAt,
      from: createdAt,
      timeline: { ...emptyTimeline, firstEvent: created(createdAt) },
    });

    expect(result).toMatchObject({
      period: ProjectGoalProgressPeriod.LAST_30_DAYS,
      from: createdAt,
      to: now,
      recordedFrom: createdAt,
    });
    expect(result.goals.map(({ goal }) => goal)).toEqual(PROJECT_GOAL_TYPES);
    expect(
      result.goals.every(
        (series) =>
          series.startProgress === 0 &&
          series.currentProgress === 0 &&
          series.changes.length === 0,
      ),
    ).toBe(true);
  });

  it('treats a creation event as tracking from the project creation instant', () => {
    const createdAt = daysAgo(10);

    const result = build({
      projectCreatedAt: createdAt,
      from: createdAt,
      timeline: {
        ...emptyTimeline,
        firstEvent: created(new Date(createdAt.getTime() + 5)),
      },
    });

    expect(result.recordedFrom).toEqual(createdAt);
  });

  it('starts from the last change recorded before the window', () => {
    const result = build({
      goals: goalsAt({ [ProjectGoalType.AGILITY]: 60 }),
      timeline: {
        firstEvent: created(daysAgo(200)),
        progressBefore: [{ goal: ProjectGoalType.AGILITY, progress: 40 }],
        changes: [
          {
            goal: ProjectGoalType.AGILITY,
            at: daysAgo(5),
            previousProgress: 40,
            progress: 60,
          },
        ],
      },
    });

    expect(seriesOf(result, ProjectGoalType.AGILITY)).toEqual({
      goal: ProjectGoalType.AGILITY,
      startProgress: 40,
      currentProgress: 60,
      changes: [{ at: daysAgo(5), previousProgress: 40, progress: 60 }],
    });
  });

  it('carries a value set before the window when the goal did not change inside it', () => {
    const result = build({
      goals: goalsAt({ [ProjectGoalType.DELIGHT]: 75 }),
      timeline: {
        firstEvent: created(daysAgo(200)),
        progressBefore: [{ goal: ProjectGoalType.DELIGHT, progress: 75 }],
        changes: [],
      },
    });

    expect(seriesOf(result, ProjectGoalType.DELIGHT)).toMatchObject({
      startProgress: 75,
      currentProgress: 75,
      changes: [],
    });
  });

  it('uses the previous value of the first change in the window when nothing was recorded before it', () => {
    const result = build({
      goals: goalsAt({ [ProjectGoalType.EFFICIENCY]: 30 }),
      timeline: {
        firstEvent: created(daysAgo(200)),
        progressBefore: [],
        changes: [
          {
            goal: ProjectGoalType.EFFICIENCY,
            at: daysAgo(2),
            previousProgress: 0,
            progress: 30,
          },
        ],
      },
    });

    expect(seriesOf(result, ProjectGoalType.EFFICIENCY)?.startProgress).toBe(0);
  });

  it('starts unchanged goals of a legacy project at their current value once tracking began', () => {
    const result = build({
      goals: goalsAt({ [ProjectGoalType.AMBITION]: 90 }),
      timeline: {
        firstEvent: {
          type: ProjectHistoryType.PROJECT_NAME_CHANGED,
          at: daysAgo(60),
        },
        progressBefore: [],
        changes: [],
      },
    });

    expect(result.recordedFrom).toEqual(daysAgo(30));
    expect(seriesOf(result, ProjectGoalType.AMBITION)).toMatchObject({
      startProgress: 90,
      currentProgress: 90,
      changes: [],
    });
  });

  it('marks history before the first event of a legacy project as unknown', () => {
    const firstChange = daysAgo(12);

    const result = build({
      goals: goalsAt({ [ProjectGoalType.EXCELLENCE]: 55 }),
      timeline: {
        firstEvent: {
          type: ProjectHistoryType.GOAL_PROGRESS_CHANGED,
          at: firstChange,
        },
        progressBefore: [],
        changes: [
          {
            goal: ProjectGoalType.EXCELLENCE,
            at: firstChange,
            previousProgress: 35,
            progress: 55,
          },
        ],
      },
    });

    expect(result.from).toEqual(daysAgo(30));
    expect(result.recordedFrom).toEqual(firstChange);
    expect(seriesOf(result, ProjectGoalType.EXCELLENCE)?.startProgress).toBe(
      35,
    );
    expect(seriesOf(result, ProjectGoalType.AGILITY)?.startProgress).toBe(0);
  });

  it('invents nothing for a project without recorded history', () => {
    const result = build({
      goals: goalsAt({ [ProjectGoalType.TRANSPARENCY]: 80 }),
    });

    expect(result.recordedFrom).toBeNull();
    expect(
      result.goals.every(
        (series) =>
          series.startProgress === null && series.changes.length === 0,
      ),
    ).toBe(true);
    expect(
      seriesOf(result, ProjectGoalType.TRANSPARENCY)?.currentProgress,
    ).toBe(80);
  });

  it('keeps the recorded order of several changes at the same instant and of other goals', () => {
    const instant = daysAgo(1);

    const result = build({
      goals: goalsAt({
        [ProjectGoalType.AGILITY]: 10,
        [ProjectGoalType.DELIGHT]: 20,
      }),
      timeline: {
        firstEvent: created(daysAgo(200)),
        progressBefore: [],
        changes: [
          {
            goal: ProjectGoalType.AGILITY,
            at: instant,
            previousProgress: 0,
            progress: 50,
          },
          {
            goal: ProjectGoalType.DELIGHT,
            at: instant,
            previousProgress: 0,
            progress: 20,
          },
          {
            goal: ProjectGoalType.AGILITY,
            at: instant,
            previousProgress: 50,
            progress: 10,
          },
        ],
      },
    });

    expect(seriesOf(result, ProjectGoalType.AGILITY)?.changes).toEqual([
      { at: instant, previousProgress: 0, progress: 50 },
      { at: instant, previousProgress: 50, progress: 10 },
    ]);
    expect(seriesOf(result, ProjectGoalType.DELIGHT)?.changes).toHaveLength(1);
  });

  it('extends the window end to a change recorded after the response time', () => {
    const later = new Date(now.getTime() + 50);

    const result = build({
      timeline: {
        firstEvent: created(daysAgo(200)),
        progressBefore: [],
        changes: [
          {
            goal: ProjectGoalType.AGILITY,
            at: later,
            previousProgress: 0,
            progress: 5,
          },
        ],
      },
    });

    expect(result.to).toEqual(later);
  });
});
