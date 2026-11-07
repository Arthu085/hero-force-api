import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  TRANSACTION_MANAGER,
  type TransactionManagerPort,
} from '@shared/application/ports';
import { ProjectEntity } from '../../domain/entities/project.entity';
import { assertEligibleResponsibleHero } from '../../domain/policies/responsible-hero.policy';
import {
  PROJECT_HERO_REPOSITORY,
  type ProjectHeroRepository,
} from '../../domain/repositories/project-hero.repository';
import {
  PROJECT_REPOSITORY,
  type ProjectRepository,
} from '../../domain/repositories/project.repository';

export interface CreateProjectInput {
  name: string;
  description: string;
  responsibleUuid: string;
  actorId: number | null;
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
  ) {}

  execute(input: CreateProjectInput): Promise<ProjectEntity> {
    return this.transactionManager.runInTransaction(async () => {
      const responsible = assertEligibleResponsibleHero(
        await this.heroRepository.findCandidateByUuid(input.responsibleUuid),
      );

      return this.projectRepository.create(
        ProjectEntity.create({
          uuid: randomUUID(),
          name: input.name,
          description: input.description,
          responsible,
          createdBy: input.actorId,
        }),
      );
    });
  }
}
