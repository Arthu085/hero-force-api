import { ValidationError } from '@shared/domain/errors';

export class IneligibleResponsibleHeroError extends ValidationError {
  constructor() {
    super('projects.errors.responsible_ineligible');
  }
}
