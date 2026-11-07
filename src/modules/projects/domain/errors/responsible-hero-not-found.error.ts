import { NotFoundError } from '@shared/domain/errors';

export class ResponsibleHeroNotFoundError extends NotFoundError {
  constructor() {
    super('projects.errors.responsible_not_found');
  }
}
