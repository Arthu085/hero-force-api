import { Controller, Query } from '@nestjs/common';
import { PaginatedResult } from '@shared/application/dto';
import { Subject } from '@shared/domain/authorization/subject';
import { Action } from '@shared/domain/enums/action.enum';
import { endpoint } from '@shared/presentation/builders';
import { Translator, type Translate } from '@shared/presentation/decorators';
import { ListProjectHeroesUseCase } from '../../application/use-cases/list-project-heroes.use-case';
import { ListProjectHeroesQueryDto } from '../dto/input/list-project-heroes-query.dto';
import { ProjectHeroResponseDto } from '../dto/output/project-hero.response';

@Controller('projects/heroes')
export class ProjectHeroesController {
  constructor(private readonly listProjectHeroes: ListProjectHeroesUseCase) {}

  @(endpoint()
    .get()
    .ability({ action: Action.UPDATE, subject: Subject.PROJECT })
    .ability({ action: Action.READ, subject: Subject.PROJECT })
    .audit('Project.list_heroes')
    .successMessage('success.ok')
    .tags('projects')
    .summary('List heroes that can be responsible for a project')
    .description(
      'Active users holding an active USER role, ordered by name. Exposes only the uuid, real name, and character, never the user directory.',
    )
    .paginatedResponse(ProjectHeroResponseDto)
    .build())
  async findAll(
    @Query() query: ListProjectHeroesQueryDto,
    @Translator() translate: Translate,
  ): Promise<PaginatedResult<ProjectHeroResponseDto>> {
    const result = await this.listProjectHeroes.execute({
      page: query.page,
      limit: query.limit,
      name: query.name,
    });

    return result.map((hero) =>
      ProjectHeroResponseDto.fromDomain(hero, translate),
    );
  }
}
