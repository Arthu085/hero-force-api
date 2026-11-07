import { ProjectManagementForbiddenError } from '../../errors/project-management-forbidden.error';
import { assertProjectAdministrator } from '../project-management.policy';

describe('assertProjectAdministrator', () => {
  it('accepts a caller holding the ADMIN role', () => {
    expect(() =>
      assertProjectAdministrator({ id: 1, roles: ['USER', 'ADMIN'] }),
    ).not.toThrow();
  });

  it('rejects any other caller, whatever abilities their roles grant', () => {
    expect(() =>
      assertProjectAdministrator({ id: 7, roles: ['USER'] }),
    ).toThrow(ProjectManagementForbiddenError);
  });
});
