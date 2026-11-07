import {
  buildProject,
  buildProjectHero,
} from '@test/support/builders/project.builder';
import { RecordStatus } from '@shared/domain/enums/record-status.enum';
import {
  PROJECT_GOAL_TYPES,
  ProjectGoalType,
} from '../../enums/project-goal-type.enum';
import { ProjectStatus } from '../../enums/project-status.enum';
import { ProjectEntity } from '../project.entity';

describe('ProjectEntity', () => {
  it('creates a project with the six fixed goals at 0%, PENDING', () => {
    const project = ProjectEntity.create({
      uuid: 'new-uuid',
      name: 'Operation Skyfall',
      description: 'Stop the meteor shower.',
      responsible: buildProjectHero(),
      createdBy: 2,
    });

    expect(project.status).toBe(RecordStatus.ACTIVE);
    expect(project.goals).toEqual(
      PROJECT_GOAL_TYPES.map((goal) => ({
        goal,
        description: null,
        progress: 0,
      })),
    );
    expect(project.progress).toBe(0);
    expect(project.progressStatus).toBe(ProjectStatus.PENDING);
    expect(project.createdBy).toBe(2);
    expect(project.updatedBy).toBe(2);
  });

  it('keeps goals in catalog order whatever order they were loaded in', () => {
    const project = buildProject({
      goals: [...PROJECT_GOAL_TYPES].reverse().map((goal) => ({
        goal,
        description: null,
        progress: 0,
      })),
    });

    expect(project.goals.map((goal) => goal.goal)).toEqual(PROJECT_GOAL_TYPES);
  });

  it('applies goal changes and recalculates progress and status', () => {
    const updated = buildProject().withGoalChanges(
      [
        { goal: ProjectGoalType.AGILITY, progress: 100, description: 'Fast' },
        { goal: ProjectGoalType.AMBITION, progress: 51 },
      ],
      5,
    );

    expect(
      updated.goals.find((goal) => goal.goal === ProjectGoalType.AGILITY),
    ).toEqual({
      goal: ProjectGoalType.AGILITY,
      description: 'Fast',
      progress: 100,
    });
    expect(updated.progress).toBe(25);
    expect(updated.progressStatus).toBe(ProjectStatus.IN_PROGRESS);
    expect(updated.updatedBy).toBe(5);
  });

  it('keeps omitted goal fields and clears a description set to null', () => {
    const project = buildProject().withGoalChanges(
      [{ goal: ProjectGoalType.DELIGHT, description: 'Smile', progress: 40 }],
      1,
    );

    const updated = project.withGoalChanges(
      [{ goal: ProjectGoalType.DELIGHT, progress: 60 }],
      1,
    );

    expect(
      updated.goals.find((goal) => goal.goal === ProjectGoalType.DELIGHT),
    ).toEqual({
      goal: ProjectGoalType.DELIGHT,
      description: 'Smile',
      progress: 60,
    });

    const cleared = updated.withGoalChanges(
      [{ goal: ProjectGoalType.DELIGHT, description: null }],
      1,
    );

    expect(
      cleared.goals.find((goal) => goal.goal === ProjectGoalType.DELIGHT),
    ).toEqual({
      goal: ProjectGoalType.DELIGHT,
      description: null,
      progress: 60,
    });
  });

  it('is COMPLETED once every goal reaches 100%', () => {
    const completed = buildProject().withGoalChanges(
      PROJECT_GOAL_TYPES.map((goal) => ({ goal, progress: 100 })),
      1,
    );

    expect(completed.progress).toBe(100);
    expect(completed.progressStatus).toBe(ProjectStatus.COMPLETED);
  });

  it('updates details and records the actor', () => {
    const hero = buildProjectHero({ id: 99, uuid: 'other-hero' });

    const updated = buildProject().withDetails({
      name: 'Renamed',
      description: 'New description',
      responsible: hero,
      actorId: 4,
    });

    expect(updated.name).toBe('Renamed');
    expect(updated.description).toBe('New description');
    expect(updated.responsible).toBe(hero);
    expect(updated.updatedBy).toBe(4);
  });

  it('marks the project deleted by the actor', () => {
    const deleted = buildProject().markDeleted(4);

    expect(deleted.deletedAt).toBeInstanceOf(Date);
    expect(deleted.deletedBy).toBe(4);
    expect(deleted.updatedBy).toBe(4);
  });
});
