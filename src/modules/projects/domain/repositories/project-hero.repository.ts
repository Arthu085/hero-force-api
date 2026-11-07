import type { RecordStatus } from '@shared/domain/enums/record-status.enum';
import type { ProjectHero } from '../entities/project-hero';

export const PROJECT_HERO_REPOSITORY = Symbol('PROJECT_HERO_REPOSITORY');

export interface ProjectHeroCandidate extends ProjectHero {
  readonly status: RecordStatus;
  readonly holdsHeroRole: boolean;
}

export interface PaginatedProjectHeroes {
  items: ProjectHero[];
  total: number;
}

export interface ProjectHeroRepository {
  findCandidateByUuid(uuid: string): Promise<ProjectHeroCandidate | null>;
  findEligiblePaginated(
    offset: number,
    limit: number,
    name?: string,
  ): Promise<PaginatedProjectHeroes>;
}
