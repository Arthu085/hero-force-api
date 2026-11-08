import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  TRANSACTION_MANAGER,
  type TransactionManagerPort,
} from '@shared/application/ports';
import { ProjectEntity } from '../../domain/entities/project.entity';
import { projectHistorySnapshot } from '../../domain/policies/project-history.policy';
import { ProjectHistoryType } from '../../domain/enums/project-history-type.enum';
import { assertProjectAdministrator } from '../../domain/policies/project-management.policy';
import type { ProjectViewer } from '../../domain/policies/project-visibility.policy';
import { assertEligibleResponsibleHero } from '../../domain/policies/responsible-hero.policy';
import {
  PROJECT_HERO_REPOSITORY,
  type ProjectHeroRepository,
} from '../../domain/repositories/project-hero.repository';
import {
  PROJECT_HISTORY_REPOSITORY,
  type ProjectHistoryRepository,
} from '../../domain/repositories/project-history.repository';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../domain/repositories/project.repository';

export interface CreateProjectInput {
  name: string;
  description: string;
  responsibleUuid: string;
  viewer: ProjectViewer;
}

@Injectable()
export class CreateProjectUseCase {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(PROJECT_HERO_REPOSITORY)
    private readonly heroRepository: ProjectHeroRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: TransactionManagerPort,
    @Inject(PROJECT_HISTORY_REPOSITORY)
    private readonly historyRepository: ProjectHistoryRepository,
  ) {}

  async execute(input: CreateProjectInput): Promise<ProjectEntity> {
    assertProjectAdministrator(input.viewer);

    return await this.transactionManager.runInTransaction(async () => {
      const responsible = assertEligibleResponsibleHero(
        await this.heroRepository.findCandidateByUuid(input.responsibleUuid),
      );

      const project = await this.projectRepository.create(
        ProjectEntity.create({
          uuid: randomUUID(),
          name: input.name,
          description: input.description,
          responsible,
          createdBy: input.viewer.id,
        }),
      );

      await this.historyRepository.append(project.id, input.viewer.id, [
        {
          type: ProjectHistoryType.PROJECT_CREATED,
          goal: null,
          previousValues: null,
          newValues: projectHistorySnapshot(project),
        },
      ]);

      return project;
    });
  }
}
