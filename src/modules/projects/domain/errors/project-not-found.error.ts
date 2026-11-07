import { NotFoundError } from '@shared/domain/errors';

export class ProjectNotFoundError extends NotFoundError {
  constructor() {
    super('projects.errors.not_found');
  }
}
