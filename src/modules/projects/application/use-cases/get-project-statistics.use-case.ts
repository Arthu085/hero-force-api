import { Inject, Injectable } from '@nestjs/common';
import {
  projectScopeFor,
  type ProjectViewer,
} from '../../domain/policies/project-visibility.policy';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
  type ProjectStatistics,
} from '../../domain/repositories/project.repository';

@Injectable()
export class GetProjectStatisticsUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
  ) {}

  execute(viewer: ProjectViewer): Promise<ProjectStatistics> {
    return this.projectRepository.getStatistics(projectScopeFor(viewer));
  }
}
