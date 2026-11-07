import { ForbiddenError } from '@shared/domain/errors';

export class ProjectHeroesForbiddenError extends ForbiddenError {
  constructor() {
    super('projects.errors.heroes_forbidden');
  }
}
