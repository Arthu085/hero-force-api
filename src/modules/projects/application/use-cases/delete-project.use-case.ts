import { Inject, Injectable } from '@nestjs/common';
import {
  TRANSACTION_MANAGER,
  type TransactionManagerPort,
} from '@shared/application/ports';
import { ProjectNotFoundError } from '../../domain/errors/project-not-found.error';
import {
  projectScopeFor,
  type ProjectViewer,
} from '../../domain/policies/project-visibility.policy';
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
  ) {}

  async execute(input: DeleteProjectInput): Promise<void> {
    await this.transactionManager.runInTransaction(async () => {
      const project = await this.projectRepository.findByUuidForUpdate(
        input.uuid,
        projectScopeFor(input.viewer),
      );

      if (!project) {
        throw new ProjectNotFoundError();
      }

      await this.projectRepository.softDelete(
        project.markDeleted(input.viewer.id),
      );
    });
  }
}
