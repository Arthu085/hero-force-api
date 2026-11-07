import { Inject, Injectable } from '@nestjs/common';
import { assertRecordActive } from '@shared/domain/policies';
import type { ProjectEntity } from '../../domain/entities/project.entity';
import { InactiveProjectError } from '../../domain/errors/inactive-project.error';
import { ProjectNotFoundError } from '../../domain/errors/project-not-found.error';
import {
  projectScopeFor,
  type ProjectViewer,
} from '../../domain/policies/project-visibility.policy';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../domain/repositories/project.repository';

export interface GetProjectInput {
  uuid: string;
  viewer: ProjectViewer;
}

@Injectable()
export class GetProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
  ) {}

  async execute(input: GetProjectInput): Promise<ProjectEntity> {
    const project = await this.projectRepository.findByUuid(
      input.uuid,
      projectScopeFor(input.viewer),
    );

    if (!project) {
      throw new ProjectNotFoundError();
    }

    assertRecordActive(project, new InactiveProjectError());

    return project;
  }
}
