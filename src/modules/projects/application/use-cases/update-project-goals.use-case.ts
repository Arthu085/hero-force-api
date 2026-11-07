import { Inject, Injectable } from '@nestjs/common';
import {
  TRANSACTION_MANAGER,
  type TransactionManagerPort,
} from '@shared/application/ports';
import { assertRecordActive } from '@shared/domain/policies';
import type {
  ProjectEntity,
  ProjectGoalChange,
} from '../../domain/entities/project.entity';
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

export interface UpdateProjectGoalsInput {
  uuid: string;
  goals: ProjectGoalChange[];
  viewer: ProjectViewer;
}

@Injectable()
export class UpdateProjectGoalsUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  execute(input: UpdateProjectGoalsInput): Promise<ProjectEntity> {
    return this.transactionManager.runInTransaction(async () => {
      const project = await this.projectRepository.findByUuidForUpdate(
        input.uuid,
        projectScopeFor(input.viewer),
      );

      if (!project) {
        throw new ProjectNotFoundError();
      }

      assertRecordActive(project, new InactiveProjectError());

      return this.projectRepository.update(
        project.withGoalChanges(input.goals, input.viewer.id),
      );
    });
  }
}
