import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '@shared/application/dto';
import { normalizeTextFilter } from '@shared/application/filters';
import type { ProjectHero } from '../../domain/entities/project-hero';
import { ProjectHeroesForbiddenError } from '../../domain/errors/project-heroes-forbidden.error';
import {
  isProjectAdministrator,
  type ProjectViewer,
} from '../../domain/policies/project-visibility.policy';
import {
  PROJECT_HERO_REPOSITORY,
  type ProjectHeroRepository,
} from '../../domain/repositories/project-hero.repository';

export interface ListProjectHeroesInput {
  page: number;
  limit: number;
  name?: string;
  viewer: ProjectViewer;
}

@Injectable()
export class ListProjectHeroesUseCase {
  constructor(
    @Inject(PROJECT_HERO_REPOSITORY)
    private readonly heroRepository: ProjectHeroRepository,
  ) {}

  async execute(
    input: ListProjectHeroesInput,
  ): Promise<PaginatedResult<ProjectHero>> {
    if (!isProjectAdministrator(input.viewer)) {
      throw new ProjectHeroesForbiddenError();
    }

    const { items, total } = await this.heroRepository.findEligiblePaginated(
      (input.page - 1) * input.limit,
      input.limit,
      normalizeTextFilter(input.name),
    );

    return PaginatedResult.of(items, total, input.page, input.limit);
  }
}
