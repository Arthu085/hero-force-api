import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '@shared/application/dto';
import type { ProjectHistory } from '../../domain/entities/project-history';
import type { ProjectViewer } from '../../domain/policies/project-visibility.policy';
import {
  PROJECT_HISTORY_REPOSITORY,
  type ProjectHistoryRepository,
} from '../../domain/repositories/project-history.repository';
import { GetProjectUseCase } from './get-project.use-case';

export interface ListProjectHistoryInput {
  uuid: string;
  page: number;
  limit: number;
  viewer: ProjectViewer;
}

@Injectable()
export class ListProjectHistoryUseCase {
  constructor(
    private readonly getProject: GetProjectUseCase,
    @Inject(PROJECT_HISTORY_REPOSITORY)
    private readonly historyRepository: ProjectHistoryRepository,
  ) {}

  async execute(
    input: ListProjectHistoryInput,
  ): Promise<PaginatedResult<ProjectHistory>> {
    const project = await this.getProject.execute({
      uuid: input.uuid,
      viewer: input.viewer,
    });

    const { items, total } = await this.historyRepository.findByProject(
      project.id,
      (input.page - 1) * input.limit,
      input.limit,
    );

    return PaginatedResult.of(items, total, input.page, input.limit);
  }
}
