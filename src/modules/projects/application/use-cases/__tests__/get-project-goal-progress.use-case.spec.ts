import {
  buildProject,
  buildProjectHeroViewer,
} from '@test/support/builders/project.builder';
import { mockOf } from '@test/support/mocks/mock-of';
import type { ProjectHistoryRepository } from '../../../domain/repositories/project-history.repository';
import { ProjectGoalProgressPeriod } from '../../../domain/enums/project-goal-progress-period.enum';
import { ProjectHistoryType } from '../../../domain/enums/project-history-type.enum';
import { ProjectNotFoundError } from '../../../domain/errors/project-not-found.error';
import { GetProjectUseCase } from '../get-project.use-case';
import { GetProjectGoalProgressUseCase } from '../get-project-goal-progress.use-case';

describe('GetProjectGoalProgressUseCase', () => {
  const now = new Date('2026-06-30T12:00:00.000Z');

  beforeEach(() => {
    jest.useFakeTimers({ now });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('checks visibility through the details use case and reads only the selected window', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    const project = buildProject({ createdAt });
    const execute = jest.fn().mockResolvedValue(project);

    const findGoalProgressTimeline = jest.fn().mockResolvedValue({
      firstEvent: { type: ProjectHistoryType.PROJECT_CREATED, at: createdAt },
      progressBefore: [],
      changes: [],
    });

    const useCase = new GetProjectGoalProgressUseCase(
      mockOf<GetProjectUseCase>({ execute }),
      mockOf<ProjectHistoryRepository>({ findGoalProgressTimeline }),
    );

    const viewer = buildProjectHeroViewer();

    const result = await useCase.execute({
      uuid: project.uuid,
      period: ProjectGoalProgressPeriod.LAST_7_DAYS,
      viewer,
    });

    const from = new Date('2026-06-23T12:00:00.000Z');

    expect(execute).toHaveBeenCalledWith({ uuid: project.uuid, viewer });
    expect(findGoalProgressTimeline).toHaveBeenCalledWith(project.id, from);
    expect(result).toMatchObject({
      period: ProjectGoalProgressPeriod.LAST_7_DAYS,
      from,
      to: now,
      recordedFrom: from,
    });
    expect(result.goals).toHaveLength(6);
  });

  it('does not read history when project details reject access', async () => {
    const execute = jest.fn().mockRejectedValue(new ProjectNotFoundError());
    const findGoalProgressTimeline = jest.fn();

    const useCase = new GetProjectGoalProgressUseCase(
      mockOf<GetProjectUseCase>({ execute }),
      mockOf<ProjectHistoryRepository>({ findGoalProgressTimeline }),
    );

    await expect(
      useCase.execute({
        uuid: 'unknown',
        period: ProjectGoalProgressPeriod.ALL,
        viewer: buildProjectHeroViewer(),
      }),
    ).rejects.toBeInstanceOf(ProjectNotFoundError);
    expect(findGoalProgressTimeline).not.toHaveBeenCalled();
  });
});
