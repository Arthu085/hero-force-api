import { buildProject } from '@test/support/builders/project.builder';
import { mockOf } from '@test/support/mocks/mock-of';
import type { TransactionManagerPort } from '@shared/application/ports';
import type { ProjectEntity } from '../../../domain/entities/project.entity';
import { ProjectNotFoundError } from '../../../domain/errors/project-not-found.error';
import type { ProjectRepository } from '../../../domain/repositories/project.repository';
import { DeleteProjectUseCase } from '../delete-project.use-case';

const transactionManager = mockOf<TransactionManagerPort>({
  runInTransaction: (work) => work(),
});

const admin = (id: number) => ({ id, roles: ['ADMIN'] });

const hero = { id: 7, roles: ['USER'] };

describe('DeleteProjectUseCase', () => {
  function setup(project: ProjectEntity | null) {
    const softDelete = jest.fn().mockResolvedValue(undefined);
    const findByUuidForUpdate = jest.fn().mockResolvedValue(project);

    const useCase = new DeleteProjectUseCase(
      mockOf<ProjectRepository>({ softDelete, findByUuidForUpdate }),
      transactionManager,
    );

    return { useCase, softDelete, findByUuidForUpdate };
  }

  it('soft-deletes the project recording the actor', async () => {
    const { useCase, softDelete } = setup(buildProject());

    await useCase.execute({ uuid: 'project-uuid', viewer: admin(4) });

    const [deleted] = softDelete.mock.calls[0] as [ProjectEntity];

    expect(deleted.deletedAt).toBeInstanceOf(Date);
    expect(deleted.deletedBy).toBe(4);
  });

  it('rejects a missing project', async () => {
    const { useCase, softDelete } = setup(null);

    await expect(
      useCase.execute({ uuid: 'missing', viewer: admin(4) }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
    expect(softDelete).not.toHaveBeenCalled();
  });

  it('locks the project within the viewer scope', async () => {
    const { useCase, findByUuidForUpdate } = setup(buildProject());

    await useCase.execute({ uuid: 'project-uuid', viewer: hero });

    expect(findByUuidForUpdate).toHaveBeenCalledWith('project-uuid', {
      responsibleId: 7,
    });
  });
});
