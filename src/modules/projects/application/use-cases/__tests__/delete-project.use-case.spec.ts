import {
  buildProject,
  buildProjectAdmin,
} from '@test/support/builders/project.builder';
import { mockOf } from '@test/support/mocks/mock-of';
import type { TransactionManagerPort } from '@shared/application/ports';
import type { ProjectEntity } from '../../../domain/entities/project.entity';
import { ProjectNotFoundError } from '../../../domain/errors/project-not-found.error';
import type { ProjectHistoryRepository } from '../../../domain/repositories/project-history.repository';
import type { ProjectRepository } from '../../../domain/repositories/project.repository';
import { DeleteProjectUseCase } from '../delete-project.use-case';

const historyRepository = mockOf<ProjectHistoryRepository>({
  append: jest.fn().mockResolvedValue(undefined),
});

const transactionManager = mockOf<TransactionManagerPort>({
  runInTransaction: (work) => work(),
});

describe('DeleteProjectUseCase', () => {
  function setup(project: ProjectEntity | null) {
    const softDelete = jest.fn().mockResolvedValue(undefined);

    const useCase = new DeleteProjectUseCase(
      mockOf<ProjectRepository>({
        softDelete,
        findByUuidForUpdate: jest.fn().mockResolvedValue(project),
      }),
      transactionManager,
      historyRepository,
    );

    return { useCase, softDelete };
  }

  it('soft-deletes the project recording the actor', async () => {
    const { useCase, softDelete } = setup(buildProject());

    await useCase.execute({
      uuid: 'project-uuid',
      viewer: buildProjectAdmin(4),
    });

    const [deleted] = softDelete.mock.calls[0] as [ProjectEntity];

    expect(deleted.deletedAt).toBeInstanceOf(Date);
    expect(deleted.deletedBy).toBe(4);
  });

  it('rejects a missing project', async () => {
    const { useCase, softDelete } = setup(null);

    await expect(
      useCase.execute({ uuid: 'missing', viewer: buildProjectAdmin(4) }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
    expect(softDelete).not.toHaveBeenCalled();
  });
});
