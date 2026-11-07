import { RecordStatus } from '@shared/domain/enums/record-status.enum';
import type { ProjectHero } from '../entities/project-hero';
import { IneligibleResponsibleHeroError } from '../errors/ineligible-responsible-hero.error';
import { ResponsibleHeroNotFoundError } from '../errors/responsible-hero-not-found.error';
import type { ProjectHeroCandidate } from '../repositories/project-hero.repository';

export function assertEligibleResponsibleHero(
  candidate: ProjectHeroCandidate | null,
): ProjectHero {
  if (!candidate) {
    throw new ResponsibleHeroNotFoundError();
  }

  if (candidate.status !== RecordStatus.ACTIVE || !candidate.holdsHeroRole) {
    throw new IneligibleResponsibleHeroError();
  }

  return {
    id: candidate.id,
    uuid: candidate.uuid,
    name: candidate.name,
    character: candidate.character,
  };
}
