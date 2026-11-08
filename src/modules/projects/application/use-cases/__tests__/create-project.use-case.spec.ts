import { buildProjectAdmin } from '@test/support/builders/project.builder';
import { mockOf } from '@test/support/mocks/mock-of';
import type { TransactionManagerPort } from '@shared/application/ports';
import { RecordStatus } from '@shared/domain/enums/record-status.enum';
import type { ProjectEntity } from '../../../domain/entities/project.entity';
import { ProjectStatus } from '../../../domain/enums/project-status.enum';
import { IneligibleResponsibleHeroError } from '../../../domain/errors/ineligible-responsible-hero.error';
import { ResponsibleHeroNotFoundError } from '../../../domain/errors/responsible-hero-not-found.error';
import type { ProjectHeroRepository } from '../../../domain/repositories/project-hero.repository';
import type { ProjectHistoryRepository } from '../../../domain/repositories/project-history.repository';
import type { ProjectRepository } from '../../../domain/repositories/project.repository';
import { CreateProjectUseCase } from '../create-project.use-case';

const historyRepository = mockOf<ProjectHistoryRepository>({
  append: jest.fn().mockResolvedValue(undefined),
});

const transactionManager = mockOf<TransactionManagerPort>({
  runInTransaction: (work) => work(),
});

const hero = {
  id: 3,
  uuid: 'hero-uuid',
  name: 'Peter Parker',
  character: null,
  status: RecordStatus.ACTIVE,
  holdsHeroRole: true,
};

describe('CreateProjectUseCase', () => {
  function setup(candidate: typeof hero | null = hero) {
    const create = jest.fn((project: ProjectEntity) =>
      Promise.resolve(project),
    );

    const findCandidateByUuid = jest.fn().mockResolvedValue(candidate);

    const useCase = new CreateProjectUseCase(
      mockOf<ProjectRepository>({ create }),
      mockOf<ProjectHeroRepository>({ findCandidateByUuid }),
      transactionManager,
      historyRepository,
    );

    return { useCase, create, findCandidateByUuid };
  }

  const input = {
    name: 'Operation Skyfall',
    description: 'Stop the meteor shower.',
    responsibleUuid: 'hero-uuid',
    viewer: buildProjectAdmin(1),
  };

  it('creates a PENDING project with six goals for an eligible hero', async () => {
    const { useCase, create, findCandidateByUuid } = setup();

    const project = await useCase.execute(input);

    expect(findCandidateByUuid).toHaveBeenCalledWith('hero-uuid');
    expect(create).toHaveBeenCalledTimes(1);
    expect(project.responsible).toEqual({
      id: 3,
      uuid: 'hero-uuid',
      name: 'Peter Parker',
      character: null,
    });
    expect(project.goals).toHaveLength(6);
    expect(project.progressStatus).toBe(ProjectStatus.PENDING);
    expect(project.createdBy).toBe(1);
  });

  it('rejects a missing hero without creating the project', async () => {
    const { useCase, create } = setup(null);

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      ResponsibleHeroNotFoundError,
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects an ineligible hero without creating the project', async () => {
    const { useCase, create } = setup({ ...hero, holdsHeroRole: false });

    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      IneligibleResponsibleHeroError,
    );
    expect(create).not.toHaveBeenCalled();
  });
});
