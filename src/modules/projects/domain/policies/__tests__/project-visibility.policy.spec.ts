import { projectScopeFor } from '../project-visibility.policy';

describe('projectScopeFor', () => {
  it('lets an ADMIN see every project', () => {
    expect(projectScopeFor({ id: 1, roles: ['ADMIN', 'USER'] })).toEqual({});
  });

  it('limits any other user to the projects they are responsible for', () => {
    expect(projectScopeFor({ id: 7, roles: ['USER'] })).toEqual({
      responsibleId: 7,
    });
  });
});
