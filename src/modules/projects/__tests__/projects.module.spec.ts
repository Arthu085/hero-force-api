import {
  registeredRoutesOf,
  shadowedRoutes,
} from '@test/support/http/registered-routes';
import { ProjectsModule } from '../projects.module';

describe('ProjectsModule routes', () => {
  const routes = registeredRoutesOf(ProjectsModule);

  it('registers every projects route on its controller as authenticated', () => {
    expect(
      routes.map(({ controller, route, isPublic }) => [
        controller,
        route,
        isPublic,
      ]),
    ).toEqual([
      ['ProjectHeroesController', 'GET /projects/heroes', false],
      ['ProjectStatisticsController', 'GET /projects/statistics', false],
      ['ProjectsController', 'GET /projects', false],
      ['ProjectsController', 'GET /projects/:uuid', false],
      ['ProjectsController', 'POST /projects', false],
      ['ProjectsController', 'PATCH /projects/:uuid', false],
      ['ProjectsController', 'PATCH /projects/:uuid/goals', false],
      ['ProjectsController', 'DELETE /projects/:uuid', false],
      ['ProjectHistoryController', 'GET /projects/:uuid/history', false],
      [
        'ProjectHistoryController',
        'GET /projects/:uuid/history/goal-progress',
        false,
      ],
    ]);
  });

  // ProjectHeroesController and ProjectStatisticsController must stay
  // registered before ProjectsController, or GET /projects/:uuid would
  // capture their static paths.
  it('registers no route behind an earlier route that already matches it', () => {
    expect(shadowedRoutes(routes)).toEqual([]);
  });
});
