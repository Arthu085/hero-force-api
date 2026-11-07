import {
  buildProject,
  buildProjectHero,
} from '@test/support/builders/project.builder';
import { mockOf } from '@test/support/mocks/mock-of';
import { RecordStatus } from '@shared/domain/enums/record-status.enum';
import { ProjectStatus } from '../../../domain/enums/project-status.enum';
import { InactiveProjectError } from '../../../domain/errors/inactive-project.error';
import { ProjectHeroesForbiddenError } from '../../../domain/errors/project-heroes-forbidden.error';
import { ProjectNotFoundError } from '../../../domain/errors/project-not-found.error';
import type { ProjectHeroRepository } from '../../../domain/repositories/project-hero.repository';
import type { ProjectRepository } from '../../../domain/repositories/project.repository';
import { GetProjectStatisticsUseCase } from '../get-project-statistics.use-case';
import { GetProjectUseCase } from '../get-project.use-case';
import { ListProjectHeroesUseCase } from '../list-project-heroes.use-case';
import { ListProjectsUseCase } from '../list-projects.use-case';

const admin = { id: 1, roles: ['ADMIN'] };
const hero = { id: 7, roles: ['USER'] };

describe('ListProjectsUseCase', () => {
  it('passes filters, sorting, and offset, unscoped for an admin', async () => {
    const project = buildProject();

    const findAllPaginated = jest
      .fn()
      .mockResolvedValue({ items: [project], total: 21 });

    const useCase = new ListProjectsUseCase(
      mockOf<ProjectRepository>({ findAllPaginated }),
    );

    const result = await useCase.execute({
      page: 2,
      limit: 20,
      name: '  sky ',
      status: ProjectStatus.PENDING,
      responsibleUuid: 'hero-uuid',
      sortBy: 'progress',
      sortOrder: 'DESC',
      viewer: admin,
    });

    expect(findAllPaginated).toHaveBeenCalledWith(
      20,
      20,
      {
        name: 'sky',
        status: ProjectStatus.PENDING,
        responsibleUuid: 'hero-uuid',
      },
      { sortBy: 'progress', sortOrder: 'DESC' },
    );
    expect(result.items).toEqual([project]);
    expect(result.total).toBe(21);
  });

  it('scopes a regular user to their own projects', async () => {
    const findAllPaginated = jest
      .fn()
      .mockResolvedValue({ items: [], total: 0 });

    const useCase = new ListProjectsUseCase(
      mockOf<ProjectRepository>({ findAllPaginated }),
    );

    await useCase.execute({ page: 1, limit: 20, viewer: hero });

    expect(findAllPaginated).toHaveBeenCalledWith(
      0,
      20,
      expect.objectContaining({ responsibleId: 7 }),
      expect.anything(),
    );
  });
});

describe('GetProjectUseCase', () => {
  it('looks the project up within the viewer scope', async () => {
    const project = buildProject();
    const findByUuid = jest.fn().mockResolvedValue(project);

    const useCase = new GetProjectUseCase(
      mockOf<ProjectRepository>({ findByUuid }),
    );

    await expect(
      useCase.execute({ uuid: 'project-uuid', viewer: hero }),
    ).resolves.toBe(project);
    expect(findByUuid).toHaveBeenCalledWith('project-uuid', {
      responsibleId: 7,
    });
  });

  it('reports a project outside the scope as not found', async () => {
    const useCase = new GetProjectUseCase(
      mockOf<ProjectRepository>({
        findByUuid: jest.fn().mockResolvedValue(null),
      }),
    );

    await expect(
      useCase.execute({ uuid: 'project-uuid', viewer: hero }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
  });

  it('rejects an inactive project', async () => {
    const useCase = new GetProjectUseCase(
      mockOf<ProjectRepository>({
        findByUuid: jest
          .fn()
          .mockResolvedValue(buildProject({ status: RecordStatus.INACTIVE })),
      }),
    );

    await expect(
      useCase.execute({ uuid: 'project-uuid', viewer: admin }),
    ).rejects.toBeInstanceOf(InactiveProjectError);
  });
});

describe('GetProjectStatisticsUseCase', () => {
  it('computes statistics within the viewer scope', async () => {
    const statistics = {
      total: 2,
      pending: 1,
      inProgress: 1,
      completed: 0,
      averageProgress: 12,
    };

    const getStatistics = jest.fn().mockResolvedValue(statistics);

    const useCase = new GetProjectStatisticsUseCase(
      mockOf<ProjectRepository>({ getStatistics }),
    );

    await expect(useCase.execute(hero)).resolves.toBe(statistics);
    expect(getStatistics).toHaveBeenCalledWith({ responsibleId: 7 });

    await useCase.execute(admin);
    expect(getStatistics).toHaveBeenLastCalledWith({});
  });
});

describe('ListProjectHeroesUseCase', () => {
  it('pages through eligible heroes with a normalized name filter', async () => {
    const heroes = [buildProjectHero()];

    const findEligiblePaginated = jest
      .fn()
      .mockResolvedValue({ items: heroes, total: 1 });

    const useCase = new ListProjectHeroesUseCase(
      mockOf<ProjectHeroRepository>({ findEligiblePaginated }),
    );

    const result = await useCase.execute({
      page: 3,
      limit: 10,
      name: ' pe ',
      viewer: admin,
    });

    expect(findEligiblePaginated).toHaveBeenCalledWith(20, 10, 'pe');
    expect(result.items).toBe(heroes);
  });

  it('rejects a caller without the ADMIN role before querying', async () => {
    const findEligiblePaginated = jest.fn();

    const useCase = new ListProjectHeroesUseCase(
      mockOf<ProjectHeroRepository>({ findEligiblePaginated }),
    );

    await expect(
      useCase.execute({ page: 1, limit: 10, viewer: hero }),
    ).rejects.toBeInstanceOf(ProjectHeroesForbiddenError);
    expect(findEligiblePaginated).not.toHaveBeenCalled();
  });
});
