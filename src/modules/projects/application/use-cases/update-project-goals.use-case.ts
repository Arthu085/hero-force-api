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
import { projectHistoryChanges } from '../../domain/policies/project-history.policy';
import { assertProjectAdministrator } from '../../domain/policies/project-management.policy';
import type { ProjectViewer } from '../../domain/policies/project-visibility.policy';
import {
  PROJECT_HISTORY_REPOSITORY,
  type ProjectHistoryRepository,
} from '../../domain/repositories/project-history.repository';
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
    @Inject(PROJECT_HISTORY_REPOSITORY)
    private readonly historyRepository: ProjectHistoryRepository,
  ) {}

  async execute(input: UpdateProjectGoalsInput): Promise<ProjectEntity> {
    assertProjectAdministrator(input.viewer);

    return await this.transactionManager.runInTransaction(async () => {
      const project = await this.projectRepository.findByUuidForUpdate(
        input.uuid,
      );

      if (!project) {
        throw new ProjectNotFoundError();
      }

      assertRecordActive(project, new InactiveProjectError());

      const updated = await this.projectRepository.update(
        project.withGoalChanges(input.goals, input.viewer.id),
      );

      await this.historyRepository.append(
        project.id,
        input.viewer.id,
        projectHistoryChanges(project, updated),
      );

      return updated;
    });
  }
}
