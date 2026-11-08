import {
  buildProject,
  buildProjectHeroViewer,
} from '@test/support/builders/project.builder';
import { mockOf } from '@test/support/mocks/mock-of';
import type { ProjectHistoryRepository } from '../../../domain/repositories/project-history.repository';
import { ProjectNotFoundError } from '../../../domain/errors/project-not-found.error';
import { GetProjectUseCase } from '../get-project.use-case';
import { ListProjectHistoryUseCase } from '../list-project-history.use-case';

describe('ListProjectHistoryUseCase', () => {
  it('checks visibility through the existing details use case before paging history', async () => {
    const project = buildProject();
    const execute = jest.fn().mockResolvedValue(project);
    const findByProject = jest.fn().mockResolvedValue({ items: [], total: 0 });

    const useCase = new ListProjectHistoryUseCase(
      mockOf<GetProjectUseCase>({ execute }),
      mockOf<ProjectHistoryRepository>({ findByProject }),
    );

    const viewer = buildProjectHeroViewer();

    const result = await useCase.execute({
      uuid: project.uuid,
      viewer,
      page: 3,
      limit: 5,
    });

    expect(execute).toHaveBeenCalledWith({ uuid: project.uuid, viewer });
    expect(findByProject).toHaveBeenCalledWith(project.id, 10, 5);
    expect(result).toMatchObject({ items: [], total: 0, page: 3, limit: 5 });
  });

  it('does not read history when project details reject access', async () => {
    const execute = jest.fn().mockRejectedValue(new ProjectNotFoundError());
    const findByProject = jest.fn();

    const useCase = new ListProjectHistoryUseCase(
      mockOf<GetProjectUseCase>({ execute }),
      mockOf<ProjectHistoryRepository>({ findByProject }),
    );

    await expect(
      useCase.execute({
        uuid: 'unknown',
        viewer: buildProjectHeroViewer(),
        page: 1,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
    expect(findByProject).not.toHaveBeenCalled();
  });
});
