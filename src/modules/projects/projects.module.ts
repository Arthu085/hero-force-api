import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserOrmEntity } from '@modules/users/persistence';
import { CreateProjectUseCase } from './application/use-cases/create-project.use-case';
import { DeleteProjectUseCase } from './application/use-cases/delete-project.use-case';
import { GetProjectGoalProgressUseCase } from './application/use-cases/get-project-goal-progress.use-case';
import { GetProjectStatisticsUseCase } from './application/use-cases/get-project-statistics.use-case';
import { GetProjectUseCase } from './application/use-cases/get-project.use-case';
import { ListProjectHeroesUseCase } from './application/use-cases/list-project-heroes.use-case';
import { ListProjectHistoryUseCase } from './application/use-cases/list-project-history.use-case';
import { ListProjectsUseCase } from './application/use-cases/list-projects.use-case';
import { UpdateProjectGoalsUseCase } from './application/use-cases/update-project-goals.use-case';
import { UpdateProjectUseCase } from './application/use-cases/update-project.use-case';
import { PROJECT_HERO_REPOSITORY } from './domain/repositories/project-hero.repository';
import { PROJECT_HISTORY_REPOSITORY } from './domain/repositories/project-history.repository';
import { PROJECT_REPOSITORY } from './domain/repositories/project.repository';
import { ProjectGoalOrmEntity } from './infrastructure/persistence/entities/project-goal.orm-entity';
import { ProjectHistoryOrmEntity } from './infrastructure/persistence/entities/project-history.orm-entity';
import { ProjectOrmEntity } from './infrastructure/persistence/entities/project.orm-entity';
import { TypeOrmProjectHeroRepository } from './infrastructure/persistence/repositories/typeorm-project-hero.repository';
import { TypeOrmProjectHistoryRepository } from './infrastructure/persistence/repositories/typeorm-project-history.repository';
import { TypeOrmProjectRepository } from './infrastructure/persistence/repositories/typeorm-project.repository';
import { ProjectHeroesController } from './presentation/controllers/project-heroes.controller';
import { ProjectStatisticsController } from './presentation/controllers/project-statistics.controller';
import { ProjectHistoryController } from './presentation/controllers/project-history.controller';
import { ProjectsController } from './presentation/controllers/projects.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectOrmEntity,
      ProjectHistoryOrmEntity,
      ProjectGoalOrmEntity,
      UserOrmEntity,
    ]),
  ],
  controllers: [
    ProjectHeroesController,
    ProjectStatisticsController,
    ProjectsController,
    ProjectHistoryController,
  ],
  providers: [
    { provide: PROJECT_REPOSITORY, useClass: TypeOrmProjectRepository },
    {
      provide: PROJECT_HERO_REPOSITORY,
      useClass: TypeOrmProjectHeroRepository,
    },
    {
      provide: PROJECT_HISTORY_REPOSITORY,
      useClass: TypeOrmProjectHistoryRepository,
    },
    ListProjectHistoryUseCase,
    GetProjectGoalProgressUseCase,
    ListProjectsUseCase,
    GetProjectUseCase,
    GetProjectStatisticsUseCase,
    ListProjectHeroesUseCase,
    CreateProjectUseCase,
    UpdateProjectUseCase,
    UpdateProjectGoalsUseCase,
    DeleteProjectUseCase,
  ],
})
export class ProjectsModule {}
