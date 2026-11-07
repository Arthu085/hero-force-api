import {
  registeredRoutesOf,
  shadowedRoutes,
} from '@test/support/http/registered-routes';
import { CharactersModule } from '../characters.module';

describe('CharactersModule routes', () => {
  const routes = registeredRoutesOf(CharactersModule);

  it('registers only the public catalog route', () => {
    expect(
      routes.map(({ controller, route, isPublic }) => [
        controller,
        route,
        isPublic,
      ]),
    ).toEqual([['CharactersController', 'GET /characters', true]]);
  });

  it('registers no shadowed route', () => {
    expect(shadowedRoutes(routes)).toEqual([]);
  });
});
