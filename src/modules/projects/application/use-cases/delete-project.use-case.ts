import { Inject, Injectable } from '@nestjs/common';
import {
  TRANSACTION_MANAGER,
  type TransactionManagerPort,
} from '@shared/application/ports';
import { ProjectHistoryType } from '../../domain/enums/project-history-type.enum';
import { ProjectNotFoundError } from '../../domain/errors/project-not-found.error';
import { projectHistorySnapshot } from '../../domain/policies/project-history.policy';
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

export interface DeleteProjectInput {
  uuid: string;
  viewer: ProjectViewer;
}

@Injectable()
export class DeleteProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: TransactionManagerPort,
    @Inject(PROJECT_HISTORY_REPOSITORY)
    private readonly historyRepository: ProjectHistoryRepository,
  ) {}

  async execute(input: DeleteProjectInput): Promise<void> {
    assertProjectAdministrator(input.viewer);

    await this.transactionManager.runInTransaction(async () => {
      const project = await this.projectRepository.findByUuidForUpdate(
        input.uuid,
      );

      if (!project) {
        throw new ProjectNotFoundError();
      }

      await this.projectRepository.softDelete(
        project.markDeleted(input.viewer.id),
      );

      await this.historyRepository.append(project.id, input.viewer.id, [
        {
          type: ProjectHistoryType.PROJECT_DELETED,
          goal: null,
          previousValues: projectHistorySnapshot(project),
          newValues: null,
        },
      ]);
    });
  }
}
