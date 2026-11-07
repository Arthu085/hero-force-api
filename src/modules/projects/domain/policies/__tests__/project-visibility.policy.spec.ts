import {
  isProjectAdministrator,
  projectScopeFor,
} from '../project-visibility.policy';

describe('isProjectAdministrator', () => {
  it.each([
    { roles: ['ADMIN'], expected: true },
    { roles: ['USER', 'ADMIN'], expected: true },
    { roles: ['USER'], expected: false },
    { roles: [], expected: false },
  ])('is $expected for roles $roles', ({ roles, expected }) => {
    expect(isProjectAdministrator({ id: 1, roles })).toBe(expected);
  });
});

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
