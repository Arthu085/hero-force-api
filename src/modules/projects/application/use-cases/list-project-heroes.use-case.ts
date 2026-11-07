import { Inject, Injectable } from '@nestjs/common';
import { PaginatedResult } from '@shared/application/dto';
import { normalizeTextFilter } from '@shared/application/filters';
import type { ProjectHero } from '../../domain/entities/project-hero';
import {
  PROJECT_HERO_REPOSITORY,
  type ProjectHeroRepository,
} from '../../domain/repositories/project-hero.repository';

export interface ListProjectHeroesInput {
  page: number;
  limit: number;
  name?: string;
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
    const { items, total } = await this.heroRepository.findEligiblePaginated(
      (input.page - 1) * input.limit,
      input.limit,
      normalizeTextFilter(input.name),
    );

    return PaginatedResult.of(items, total, input.page, input.limit);
  }
}
