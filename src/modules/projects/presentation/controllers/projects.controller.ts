import { Body, Controller, HttpStatus, Param, Query } from '@nestjs/common';
import { PaginatedResult } from '@shared/application/dto';
import { Subject } from '@shared/domain/authorization/subject';
import { Action } from '@shared/domain/enums/action.enum';
import { endpoint } from '@shared/presentation/builders';
import {
  CurrentActor,
  Translator,
  type Translate,
} from '@shared/presentation/decorators';
import type { AuthenticatedUser } from '@shared/presentation/http';
import { ParseUuidParamPipe } from '@shared/presentation/pipes';
import { CreateProjectUseCase } from '../../application/use-cases/create-project.use-case';
import { DeleteProjectUseCase } from '../../application/use-cases/delete-project.use-case';
import { GetProjectUseCase } from '../../application/use-cases/get-project.use-case';
import { ListProjectsUseCase } from '../../application/use-cases/list-projects.use-case';
import { UpdateProjectGoalsUseCase } from '../../application/use-cases/update-project-goals.use-case';
import { UpdateProjectUseCase } from '../../application/use-cases/update-project.use-case';
import { CreateProjectDto } from '../dto/input/create-project.dto';
import { ListProjectsQueryDto } from '../dto/input/list-projects-query.dto';
import { UpdateProjectGoalsDto } from '../dto/input/update-project-goals.dto';
import { UpdateProjectDto } from '../dto/input/update-project.dto';
import { ProjectDetailResponseDto } from '../dto/output/project-detail.response';
import { ProjectListResponseDto } from '../dto/output/project-list.response';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly listProjects: ListProjectsUseCase,
    private readonly getProject: GetProjectUseCase,
    private readonly createProject: CreateProjectUseCase,
    private readonly updateProject: UpdateProjectUseCase,
    private readonly updateProjectGoals: UpdateProjectGoalsUseCase,
    private readonly deleteProject: DeleteProjectUseCase,
  ) {}

  @(endpoint()
    .get()
    .ability({ action: Action.READ, subject: Subject.PROJECT })
    .audit('Project.list')
    .successMessage('success.ok')
    .tags('projects')
    .summary('List projects')
    .description(
      'Administrators see every project; other users only the projects they are responsible for.',
    )
    .paginatedResponse(ProjectListResponseDto)
    .build())
  async findAll(
    @Query() query: ListProjectsQueryDto,
    @CurrentActor() actor: AuthenticatedUser,
    @Translator() translate: Translate,
  ): Promise<PaginatedResult<ProjectListResponseDto>> {
    const result = await this.listProjects.execute({
      page: query.page,
      limit: query.limit,
      name: query.name,
      status: query.status,
      responsibleUuid: query.responsible,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      viewer: actor,
    });

    return result.map((project) =>
      ProjectListResponseDto.fromDomain(project, translate),
    );
  }

  @(endpoint()
    .get(':uuid')
    .ability({ action: Action.READ, subject: Subject.PROJECT })
    .audit('Project.read')
    .successMessage('success.ok')
    .tags('projects')
    .summary('Get a project by uuid')
    .description('A project the caller may not view is reported as not found.')
    .errorResponse(HttpStatus.NOT_FOUND, 'Project not found.')
    .errorResponse(HttpStatus.CONFLICT, 'Project is inactive.')
    .response(ProjectDetailResponseDto)
    .build())
  async findOne(
    @Param('uuid', ParseUuidParamPipe) uuid: string,
    @CurrentActor() actor: AuthenticatedUser,
    @Translator() translate: Translate,
  ): Promise<ProjectDetailResponseDto> {
    const project = await this.getProject.execute({ uuid, viewer: actor });

    return ProjectDetailResponseDto.fromDomain(project, translate);
  }

  @(endpoint()
    .post()
    .httpCode(HttpStatus.CREATED)
    .ability({ action: Action.CREATE, subject: Subject.PROJECT })
    .audit('Project.create')
    .successMessage('success.created')
    .tags('projects')
    .summary('Create a project')
    .description(
      'The project starts with the six fixed goals at 0%, so its status is PENDING.',
    )
    .errorResponse(HttpStatus.NOT_FOUND, 'Responsible hero not found.')
    .errorResponse(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'Responsible hero is inactive or does not hold the USER role.',
    )
    .body(CreateProjectDto)
    .response(ProjectDetailResponseDto, HttpStatus.CREATED)
    .build())
  async create(
    @Body() dto: CreateProjectDto,
    @CurrentActor() actor: AuthenticatedUser,
    @Translator() translate: Translate,
  ): Promise<ProjectDetailResponseDto> {
    const project = await this.createProject.execute({
      name: dto.name,
      description: dto.description,
      responsibleUuid: dto.responsibleUuid,
      actorId: actor.id,
    });

    return ProjectDetailResponseDto.fromDomain(project, translate);
  }

  @(endpoint()
    .patch(':uuid')
    .ability({ action: Action.UPDATE, subject: Subject.PROJECT })
    .ability({ action: Action.READ, subject: Subject.PROJECT })
    .audit('Project.update')
    .successMessage('success.updated')
    .tags('projects')
    .summary('Update a project')
    .description(
      'Partial update of name, description, and responsible hero. Status and progress are derived from the goals and cannot be set.',
    )
    .errorResponse(
      HttpStatus.NOT_FOUND,
      'Project or responsible hero not found.',
    )
    .errorResponse(HttpStatus.CONFLICT, 'Project is inactive.')
    .errorResponse(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'Responsible hero is inactive or does not hold the USER role.',
    )
    .body(UpdateProjectDto)
    .response(ProjectDetailResponseDto)
    .build())
  async update(
    @Param('uuid', ParseUuidParamPipe) uuid: string,
    @Body() dto: UpdateProjectDto,
    @CurrentActor() actor: AuthenticatedUser,
    @Translator() translate: Translate,
  ): Promise<ProjectDetailResponseDto> {
    const project = await this.updateProject.execute({
      uuid,
      name: dto.name,
      description: dto.description,
      responsibleUuid: dto.responsibleUuid,
      viewer: actor,
    });

    return ProjectDetailResponseDto.fromDomain(project, translate);
  }

  @(endpoint()
    .patch(':uuid/goals')
    .ability({ action: Action.UPDATE, subject: Subject.PROJECT })
    .ability({ action: Action.READ, subject: Subject.PROJECT })
    .audit('Project.update_goals')
    .successMessage('success.updated')
    .tags('projects')
    .summary('Update project goals')
    .description(
      'Changes the description and progress of the listed goals. Overall progress (the average rounded down) and status are recalculated.',
    )
    .errorResponse(HttpStatus.NOT_FOUND, 'Project not found.')
    .errorResponse(HttpStatus.CONFLICT, 'Project is inactive.')
    .body(UpdateProjectGoalsDto)
    .response(ProjectDetailResponseDto)
    .build())
  async updateGoals(
    @Param('uuid', ParseUuidParamPipe) uuid: string,
    @Body() dto: UpdateProjectGoalsDto,
    @CurrentActor() actor: AuthenticatedUser,
    @Translator() translate: Translate,
  ): Promise<ProjectDetailResponseDto> {
    const project = await this.updateProjectGoals.execute({
      uuid,
      goals: dto.goals.map((goal) => ({
        goal: goal.goal,
        description: goal.description,
        progress: goal.progress,
      })),
      viewer: actor,
    });

    return ProjectDetailResponseDto.fromDomain(project, translate);
  }

  @(endpoint()
    .delete(':uuid')
    .ability({ action: Action.DELETE, subject: Subject.PROJECT })
    .ability({ action: Action.READ, subject: Subject.PROJECT })
    .audit('Project.delete')
    .successMessage('success.deleted')
    .tags('projects')
    .summary('Soft-delete a project')
    .errorResponse(HttpStatus.NOT_FOUND, 'Project not found.')
    .build())
  async remove(
    @Param('uuid', ParseUuidParamPipe) uuid: string,
    @CurrentActor() actor: AuthenticatedUser,
  ): Promise<void> {
    await this.deleteProject.execute({ uuid, viewer: actor });
  }
}
