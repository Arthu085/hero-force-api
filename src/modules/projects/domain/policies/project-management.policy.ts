import { ProjectManagementForbiddenError } from '../errors/project-management-forbidden.error';
import {
  isProjectAdministrator,
  type ProjectViewer,
} from './project-visibility.policy';

export function assertProjectAdministrator(viewer: ProjectViewer): void {
  if (!isProjectAdministrator(viewer)) {
    throw new ProjectManagementForbiddenError();
  }
}
