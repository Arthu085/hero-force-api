import { buildProjectHeroViewer } from '@test/support/builders/project.builder';
import { mockOf } from '@test/support/mocks/mock-of';
import type { TransactionManagerPort } from '@shared/application/ports';
import { ProjectGoalType } from '../../../domain/enums/project-goal-type.enum';
import { ProjectManagementForbiddenError } from '../../../domain/errors/project-management-forbidden.error';
import type { ProjectHeroRepository } from '../../../domain/repositories/project-hero.repository';
import type { ProjectRepository } from '../../../domain/repositories/project.repository';
import { CreateProjectUseCase } from '../create-project.use-case';
import { DeleteProjectUseCase } from '../delete-project.use-case';
import { UpdateProjectGoalsUseCase } from '../update-project-goals.use-case';
import { UpdateProjectUseCase } from '../update-project.use-case';

// A USER role can be granted CREATE, UPDATE, or DELETE on PROJECT through the role
// abilities endpoint; managing projects must still require the ADMIN role.
describe('Project management by a non-administrator', () => {
  const viewer = buildProjectHeroViewer();
  const runInTransaction = jest.fn();

  const projects = mockOf<ProjectRepository>({
    create: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    findByUuidForUpdate: jest.fn(),
  });

  const heroes = mockOf<ProjectHeroRepository>({
    findCandidateByUuid: jest.fn(),
  });

  const transactionManager = mockOf<TransactionManagerPort>({
    runInTransaction,
  });

  it.each([
    {
      name: 'create',
      run: () =>
        new CreateProjectUseCase(projects, heroes, transactionManager).execute({
          name: 'Operation Skyfall',
          description: 'Stop the meteor shower.',
          responsibleUuid: 'hero-uuid',
          viewer,
        }),
    },
    {
      name: 'update',
      run: () =>
        new UpdateProjectUseCase(projects, heroes, transactionManager).execute({
          uuid: 'project-uuid',
          name: 'Renamed',
          viewer,
        }),
    },
    {
      name: 'update goals',
      run: () =>
        new UpdateProjectGoalsUseCase(projects, transactionManager).execute({
          uuid: 'project-uuid',
          goals: [{ goal: ProjectGoalType.AGILITY, progress: 50 }],
          viewer,
        }),
    },
    {
      name: 'delete',
      run: () =>
        new DeleteProjectUseCase(projects, transactionManager).execute({
          uuid: 'project-uuid',
          viewer,
        }),
    },
  ])('rejects $name before touching any project', async ({ run }) => {
    await expect(run()).rejects.toBeInstanceOf(ProjectManagementForbiddenError);
    expect(runInTransaction).not.toHaveBeenCalled();
  });
});
