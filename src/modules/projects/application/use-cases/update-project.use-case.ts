import { Inject, Injectable } from '@nestjs/common';
import {
  TRANSACTION_MANAGER,
  type TransactionManagerPort,
} from '@shared/application/ports';
import { assertRecordActive } from '@shared/domain/policies';
import type { ProjectEntity } from '../../domain/entities/project.entity';
import type { ProjectHero } from '../../domain/entities/project-hero';
import { InactiveProjectError } from '../../domain/errors/inactive-project.error';
import { ProjectNotFoundError } from '../../domain/errors/project-not-found.error';
import {
  projectScopeFor,
  type ProjectViewer,
} from '../../domain/policies/project-visibility.policy';
import { assertEligibleResponsibleHero } from '../../domain/policies/responsible-hero.policy';
import {
  PROJECT_HERO_REPOSITORY,
  type ProjectHeroRepository,
} from '../../domain/repositories/project-hero.repository';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../domain/repositories/project.repository';

export interface UpdateProjectInput {
  uuid: string;
  name?: string;
  description?: string;
  responsibleUuid?: string;
  viewer: ProjectViewer;
}

@Injectable()
export class UpdateProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(PROJECT_HERO_REPOSITORY)
    private readonly heroRepository: ProjectHeroRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: TransactionManagerPort,
  ) {}

  execute(input: UpdateProjectInput): Promise<ProjectEntity> {
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
        project.withDetails({
          name: input.name ?? project.name,
          description: input.description ?? project.description,
          responsible: await this.resolveResponsible(
            project.responsible,
            input.responsibleUuid,
          ),
          actorId: input.viewer.id,
        }),
      );
    });
  }

  private async resolveResponsible(
    current: ProjectHero,
    responsibleUuid?: string,
  ): Promise<ProjectHero> {
    if (responsibleUuid === undefined || responsibleUuid === current.uuid) {
      return current;
    }

    return assertEligibleResponsibleHero(
      await this.heroRepository.findCandidateByUuid(responsibleUuid),
    );
  }
}
