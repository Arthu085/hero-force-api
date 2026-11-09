import { ProjectGoalProgressPeriod } from '../../../../domain/enums/project-goal-progress-period.enum';
import { ProjectGoalType } from '../../../../domain/enums/project-goal-type.enum';
import { ProjectGoalProgressResponseDto } from '../project-goal-progress.response';

const translate = (key: string) => `t:${key}`;

describe('ProjectGoalProgressResponseDto', () => {
  it('maps the window, labels, baselines, and ordered changes', () => {
    const from = new Date('2026-06-01T00:00:00.000Z');
    const to = new Date('2026-06-30T00:00:00.000Z');
    const at = new Date('2026-06-10T00:00:00.000Z');

    const dto = ProjectGoalProgressResponseDto.fromDomain(
      {
        period: ProjectGoalProgressPeriod.LAST_30_DAYS,
        from,
        to,
        recordedFrom: from,
        goals: [
          {
            goal: ProjectGoalType.AGILITY,
            startProgress: 10,
            currentProgress: 40,
            changes: [{ at, previousProgress: 10, progress: 40 }],
          },
          {
            goal: ProjectGoalType.DELIGHT,
            startProgress: null,
            currentProgress: 0,
            changes: [],
          },
        ],
      },
      translate,
    );

    expect(JSON.parse(JSON.stringify(dto))).toEqual({
      period: '30d',
      from: from.toISOString(),
      to: to.toISOString(),
      recordedFrom: from.toISOString(),
      goals: [
        {
          goal: 'AGILITY',
          goalLabel: 't:enums.project_goal.agility',
          startProgress: 10,
          currentProgress: 40,
          changes: [
            { at: at.toISOString(), previousProgress: 10, progress: 40 },
          ],
        },
        {
          goal: 'DELIGHT',
          goalLabel: 't:enums.project_goal.delight',
          startProgress: null,
          currentProgress: 0,
          changes: [],
        },
      ],
    });
  });
});
