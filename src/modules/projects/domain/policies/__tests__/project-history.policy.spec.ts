import { buildProject } from '@test/support/builders/project.builder';
import { ProjectGoalType } from '../../enums/project-goal-type.enum';
import { ProjectHistoryType } from '../../enums/project-history-type.enum';
import {
  projectHistoryChanges,
  projectHistorySnapshot,
} from '../project-history.policy';

describe('Project history changes', () => {
  it('ignores unchanged values, including omitted goal fields and zero progress', () => {
    const project = buildProject();

    const next = project.withGoalChanges(
      [{ goal: ProjectGoalType.AGILITY, progress: 0 }],
      1,
    );

    expect(projectHistoryChanges(project, next)).toEqual([]);
    expect(
      projectHistoryChanges(
        project,
        project.withDetails({
          name: project.name,
          description: project.description,
          responsible: project.responsible,
          actorId: 2,
        }),
      ),
    ).toEqual([]);
  });

  it('records only changed details with public responsible snapshots', () => {
    const previous = buildProject();

    const next = previous.withDetails({
      name: 'New name',
      description: 'New description',
      responsible: { id: 8, uuid: 'new-hero', name: 'Diana', character: null },
      actorId: 1,
    });

    expect(projectHistoryChanges(previous, next)).toEqual([
      {
        type: ProjectHistoryType.PROJECT_NAME_CHANGED,
        goal: null,
        previousValues: { name: previous.name },
        newValues: { name: 'New name' },
      },
      {
        type: ProjectHistoryType.PROJECT_DESCRIPTION_CHANGED,
        goal: null,
        previousValues: { description: previous.description },
        newValues: { description: 'New description' },
      },
      {
        type: ProjectHistoryType.RESPONSIBLE_HERO_CHANGED,
        goal: null,
        previousValues: {
          responsible: {
            uuid: previous.responsible.uuid,
            name: previous.responsible.name,
          },
        },
        newValues: { responsible: { uuid: 'new-hero', name: 'Diana' } },
      },
    ]);
    expect(projectHistorySnapshot(next)).toEqual({
      name: 'New name',
      description: 'New description',
      responsible: { uuid: 'new-hero', name: 'Diana' },
    });
  });

  it('records description clearing and both progress percentages separately', () => {
    const project = buildProject().withGoalChanges(
      [{ goal: ProjectGoalType.AGILITY, description: 'Before', progress: 20 }],
      1,
    );

    const next = project.withGoalChanges(
      [{ goal: ProjectGoalType.AGILITY, description: null, progress: 70 }],
      1,
    );

    expect(projectHistoryChanges(project, next)).toEqual([
      {
        type: ProjectHistoryType.GOAL_DESCRIPTION_CHANGED,
        goal: ProjectGoalType.AGILITY,
        previousValues: { description: 'Before' },
        newValues: { description: null },
      },
      {
        type: ProjectHistoryType.GOAL_PROGRESS_CHANGED,
        goal: ProjectGoalType.AGILITY,
        previousValues: { progress: 20 },
        newValues: { progress: 70 },
      },
    ]);
  });
});
