import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '@shared/application/dto';
import { normalizeTextFilter } from '@shared/application/filters';
import type { ProjectEntity } from '../../domain/entities/project.entity';
import type { ProjectStatus } from '../../domain/enums/project-status.enum';
import {
  projectScopeFor,
  type ProjectViewer,
} from '../../domain/policies/project-visibility.policy';
import type { ProjectListSort } from '../../domain/repositories/project-list-sort';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../domain/repositories/project.repository';

export interface ListProjectsInput extends ProjectListSort {
  page: number;
  limit: number;
  name?: string;
  status?: ProjectStatus;
  responsibleUuid?: string;
  viewer: ProjectViewer;
}

@Injectable()
export class ListProjectsUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
  ) {}

  async execute(
    input: ListProjectsInput,
  ): Promise<PaginatedResult<ProjectEntity>> {
    const { items, total } = await this.projectRepository.findAllPaginated(
      (input.page - 1) * input.limit,
      input.limit,
      {
        ...projectScopeFor(input.viewer),
        name: normalizeTextFilter(input.name),
        status: input.status,
        responsibleUuid: input.responsibleUuid,
      },
      { sortBy: input.sortBy, sortOrder: input.sortOrder },
    );

    return PaginatedResult.of(items, total, input.page, input.limit);
  }
}
