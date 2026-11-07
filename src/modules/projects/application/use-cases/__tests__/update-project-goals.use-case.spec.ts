import { buildProject } from '@test/support/builders/project.builder';
import { mockOf } from '@test/support/mocks/mock-of';
import type { TransactionManagerPort } from '@shared/application/ports';
import { RecordStatus } from '@shared/domain/enums/record-status.enum';
import type { ProjectEntity } from '../../../domain/entities/project.entity';
import { ProjectGoalType } from '../../../domain/enums/project-goal-type.enum';
import { ProjectStatus } from '../../../domain/enums/project-status.enum';
import { InactiveProjectError } from '../../../domain/errors/inactive-project.error';
import { ProjectNotFoundError } from '../../../domain/errors/project-not-found.error';
import type { ProjectRepository } from '../../../domain/repositories/project.repository';
import { UpdateProjectGoalsUseCase } from '../update-project-goals.use-case';

const transactionManager = mockOf<TransactionManagerPort>({
  runInTransaction: (work) => work(),
});

const admin = (id: number) => ({ id, roles: ['ADMIN'] });

const hero = { id: 7, roles: ['USER'] };

describe('UpdateProjectGoalsUseCase', () => {
  function setup(project: ProjectEntity | null = buildProject()) {
    const update = jest.fn((updated: ProjectEntity) =>
      Promise.resolve(updated),
    );

    const findByUuidForUpdate = jest.fn().mockResolvedValue(project);

    const useCase = new UpdateProjectGoalsUseCase(
      mockOf<ProjectRepository>({ update, findByUuidForUpdate }),
      transactionManager,
    );

    return { useCase, update, findByUuidForUpdate };
  }

  it('persists the changed goals with recalculated progress', async () => {
    const { useCase, update } = setup();

    const updated = await useCase.execute({
      uuid: 'project-uuid',
      goals: [{ goal: ProjectGoalType.EXCELLENCE, progress: 60 }],
      viewer: admin(1),
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(updated.progress).toBe(10);
    expect(updated.progressStatus).toBe(ProjectStatus.IN_PROGRESS);
    expect(updated.updatedBy).toBe(1);
  });

  it('rejects a missing project', async () => {
    const { useCase, update } = setup(null);

    await expect(
      useCase.execute({ uuid: 'missing', goals: [], viewer: admin(1) }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects an inactive project', async () => {
    const { useCase } = setup(buildProject({ status: RecordStatus.INACTIVE }));

    await expect(
      useCase.execute({ uuid: 'project-uuid', goals: [], viewer: admin(1) }),
    ).rejects.toBeInstanceOf(InactiveProjectError);
  });

  it('looks the project up within the viewer scope', async () => {
    const { useCase, findByUuidForUpdate } = setup(null);

    await expect(
      useCase.execute({ uuid: 'project-uuid', goals: [], viewer: hero }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
    expect(findByUuidForUpdate).toHaveBeenCalledWith('project-uuid', {
      responsibleId: 7,
    });
  });
});
