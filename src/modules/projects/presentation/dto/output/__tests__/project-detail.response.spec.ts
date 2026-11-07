import {
  buildProject,
  buildProjectHero,
} from '@test/support/builders/project.builder';
import { CharacterCode } from '@modules/characters';
import { ProjectGoalType } from '../../../../domain/enums/project-goal-type.enum';
import { ProjectDetailResponseDto } from '../project-detail.response';
import { ProjectStatisticsResponseDto } from '../project-statistics.response';

const translate = (key: string) => `t:${key}`;

describe('ProjectDetailResponseDto', () => {
  it('maps the derived status, labels, goals, and public hero fields', () => {
    const project = buildProject({
      responsible: buildProjectHero({ character: CharacterCode.SPIDER_MAN }),
    }).withGoalChanges(
      [{ goal: ProjectGoalType.AGILITY, progress: 60, description: 'Fast' }],
      null,
    );

    const dto = ProjectDetailResponseDto.fromDomain(project, translate);

    expect(dto).toMatchObject({
      uuid: 'project-uuid',
      name: 'Operation Skyfall',
      description: 'Stop the meteor shower.',
      status: 'IN_PROGRESS',
      statusLabel: 't:enums.project_status.in_progress',
      progress: 10,
    });
    expect(dto.goals[0]).toEqual({
      goal: ProjectGoalType.AGILITY,
      goalLabel: 't:enums.project_goal.agility',
      description: 'Fast',
      progress: 60,
    });
    expect(Object.keys(dto.responsible).sort()).toEqual([
      'character',
      'name',
      'uuid',
    ]);
    expect(dto.responsible.character?.code).toBe(CharacterCode.SPIDER_MAN);
  });

  it('maps a hero without a character to null', () => {
    const dto = ProjectDetailResponseDto.fromDomain(buildProject(), translate);

    expect(dto.responsible.character).toBeNull();
  });
});

describe('ProjectStatisticsResponseDto', () => {
  it('copies every indicator', () => {
    const statistics = {
      total: 3,
      pending: 1,
      inProgress: 1,
      completed: 1,
      averageProgress: 44,
    };

    expect({
      ...ProjectStatisticsResponseDto.fromDomain(statistics),
    }).toEqual(statistics);
  });
});
