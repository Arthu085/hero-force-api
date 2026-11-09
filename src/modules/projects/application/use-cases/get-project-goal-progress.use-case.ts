import { Inject, Injectable } from '@nestjs/common';
import type { ProjectGoalProgress } from '../../domain/entities/project-goal-progress';
import type { ProjectGoalProgressPeriod } from '../../domain/enums/project-goal-progress-period.enum';
import {
  buildGoalProgress,
  goalProgressWindowStart,
} from '../../domain/policies/project-goal-progress.policy';
import type { ProjectViewer } from '../../domain/policies/project-visibility.policy';
import {
  PROJECT_HISTORY_REPOSITORY,
  type ProjectHistoryRepository,
} from '../../domain/repositories/project-history.repository';
import { GetProjectUseCase } from './get-project.use-case';

export interface GetProjectGoalProgressInput {
  uuid: string;
  period: ProjectGoalProgressPeriod;
  viewer: ProjectViewer;
}

@Injectable()
export class GetProjectGoalProgressUseCase {
  constructor(
    private readonly getProject: GetProjectUseCase,
    @Inject(PROJECT_HISTORY_REPOSITORY)
    private readonly historyRepository: ProjectHistoryRepository,
  ) {}

  async execute(
    input: GetProjectGoalProgressInput,
  ): Promise<ProjectGoalProgress> {
    const project = await this.getProject.execute({
      uuid: input.uuid,
      viewer: input.viewer,
    });

    const now = new Date();
    const from = goalProgressWindowStart(input.period, now, project.createdAt);

    const timeline = await this.historyRepository.findGoalProgressTimeline(
      project.id,
      from,
    );

    return buildGoalProgress({
      period: input.period,
      now,
      from,
      projectCreatedAt: project.createdAt,
      goals: project.goals,
      timeline,
    });
  }
}
