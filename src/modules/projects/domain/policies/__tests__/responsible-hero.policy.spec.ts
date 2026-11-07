import { RecordStatus } from '@shared/domain/enums/record-status.enum';
import { IneligibleResponsibleHeroError } from '../../errors/ineligible-responsible-hero.error';
import { ResponsibleHeroNotFoundError } from '../../errors/responsible-hero-not-found.error';
import type { ProjectHeroCandidate } from '../../repositories/project-hero.repository';
import { assertEligibleResponsibleHero } from '../responsible-hero.policy';

const candidate = (
  overrides: Partial<ProjectHeroCandidate> = {},
): ProjectHeroCandidate => ({
  id: 3,
  uuid: 'hero-uuid',
  name: 'Peter Parker',
  character: null,
  status: RecordStatus.ACTIVE,
  holdsHeroRole: true,
  ...overrides,
});

describe('assertEligibleResponsibleHero', () => {
  it('returns only the public hero fields of an active USER', () => {
    expect(assertEligibleResponsibleHero(candidate())).toEqual({
      id: 3,
      uuid: 'hero-uuid',
      name: 'Peter Parker',
      character: null,
    });
  });

  it('rejects a missing user as not found', () => {
    expect(() => assertEligibleResponsibleHero(null)).toThrow(
      ResponsibleHeroNotFoundError,
    );
  });

  it('rejects an inactive user', () => {
    expect(() =>
      assertEligibleResponsibleHero(
        candidate({ status: RecordStatus.INACTIVE }),
      ),
    ).toThrow(IneligibleResponsibleHeroError);
  });

  it('rejects a user without the USER role', () => {
    expect(() =>
      assertEligibleResponsibleHero(candidate({ holdsHeroRole: false })),
    ).toThrow(IneligibleResponsibleHeroError);
  });
});
