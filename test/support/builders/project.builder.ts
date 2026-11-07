import { RecordStatus } from '@shared/domain/enums/record-status.enum';
import type { ProjectHero } from '@modules/projects/domain/entities/project-hero';
import {
  ProjectEntity,
  type ReconstituteProjectInput,
} from '@modules/projects/domain/entities/project.entity';
import { PROJECT_GOAL_TYPES } from '@modules/projects/domain/enums/project-goal-type.enum';

export function buildProjectHero(
  overrides: Partial<ProjectHero> = {},
): ProjectHero {
  return {
    id: 10,
    uuid: 'hero-uuid',
    name: 'Peter Parker',
    character: null,
    ...overrides,
  };
}

export function buildProject(
  overrides: Partial<ReconstituteProjectInput> = {},
): ProjectEntity {
  return ProjectEntity.reconstitute({
    id: 1,
    uuid: 'project-uuid',
    status: RecordStatus.ACTIVE,
    name: 'Operation Skyfall',
    description: 'Stop the meteor shower.',
    responsible: buildProjectHero(),
    goals: PROJECT_GOAL_TYPES.map((goal) => ({
      goal,
      description: null,
      progress: 0,
    })),
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    createdBy: null,
    updatedBy: null,
    deletedBy: null,
    ...overrides,
  });
}
