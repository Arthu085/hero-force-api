import { buildProject } from '@test/support/builders/project.builder';
import { mockOf } from '@test/support/mocks/mock-of';
import type { TransactionManagerPort } from '@shared/application/ports';
import { RecordStatus } from '@shared/domain/enums/record-status.enum';
import type { ProjectEntity } from '../../../domain/entities/project.entity';
import { InactiveProjectError } from '../../../domain/errors/inactive-project.error';
import { IneligibleResponsibleHeroError } from '../../../domain/errors/ineligible-responsible-hero.error';
import { ProjectNotFoundError } from '../../../domain/errors/project-not-found.error';
import type { ProjectHeroRepository } from '../../../domain/repositories/project-hero.repository';
import type { ProjectRepository } from '../../../domain/repositories/project.repository';
import { UpdateProjectUseCase } from '../update-project.use-case';

const transactionManager = mockOf<TransactionManagerPort>({
  runInTransaction: (work) => work(),
});

describe('UpdateProjectUseCase', () => {
  function setup(project: ProjectEntity | null = buildProject()) {
    const update = jest.fn((updated: ProjectEntity) =>
      Promise.resolve(updated),
    );

    const findByUuidForUpdate = jest.fn().mockResolvedValue(project);
    const findCandidateByUuid = jest.fn();

    const useCase = new UpdateProjectUseCase(
      mockOf<ProjectRepository>({ update, findByUuidForUpdate }),
      mockOf<ProjectHeroRepository>({ findCandidateByUuid }),
      transactionManager,
    );

    return { useCase, update, findCandidateByUuid };
  }

  it('keeps omitted fields and the current hero', async () => {
    const { useCase, findCandidateByUuid } = setup();

    const updated = await useCase.execute({
      uuid: 'project-uuid',
      name: 'Renamed',
      actorId: 2,
    });

    expect(updated.name).toBe('Renamed');
    expect(updated.description).toBe('Stop the meteor shower.');
    expect(updated.responsible.uuid).toBe('hero-uuid');
    expect(updated.updatedBy).toBe(2);
    expect(findCandidateByUuid).not.toHaveBeenCalled();
  });

  it('does not re-validate the current hero when it is sent unchanged', async () => {
    const { useCase, findCandidateByUuid } = setup();

    await useCase.execute({
      uuid: 'project-uuid',
      responsibleUuid: 'hero-uuid',
      actorId: 2,
    });

    expect(findCandidateByUuid).not.toHaveBeenCalled();
  });

  it('reassigns the project to another eligible hero', async () => {
    const { useCase, findCandidateByUuid } = setup();

    findCandidateByUuid.mockResolvedValue({
      id: 20,
      uuid: 'new-hero',
      name: 'Diana Prince',
      character: null,
      status: RecordStatus.ACTIVE,
      holdsHeroRole: true,
    });

    const updated = await useCase.execute({
      uuid: 'project-uuid',
      responsibleUuid: 'new-hero',
      actorId: 2,
    });

    expect(updated.responsible).toEqual({
      id: 20,
      uuid: 'new-hero',
      name: 'Diana Prince',
      character: null,
    });
  });

  it('rejects reassignment to an inactive hero', async () => {
    const { useCase, findCandidateByUuid, update } = setup();

    findCandidateByUuid.mockResolvedValue({
      id: 20,
      uuid: 'new-hero',
      name: 'Diana Prince',
      character: null,
      status: RecordStatus.INACTIVE,
      holdsHeroRole: true,
    });

    await expect(
      useCase.execute({
        uuid: 'project-uuid',
        responsibleUuid: 'new-hero',
        actorId: 2,
      }),
    ).rejects.toBeInstanceOf(IneligibleResponsibleHeroError);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects a missing project', async () => {
    const { useCase } = setup(null);

    await expect(
      useCase.execute({ uuid: 'missing', actorId: 2 }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it('rejects an inactive project', async () => {
    const { useCase } = setup(buildProject({ status: RecordStatus.INACTIVE }));

    await expect(
      useCase.execute({ uuid: 'project-uuid', actorId: 2 }),
    ).rejects.toBeInstanceOf(InactiveProjectError);
  });
});
