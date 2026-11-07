import { Module } from '@nestjs/common';
import { ListCharactersUseCase } from './application/use-cases/list-characters.use-case';
import { CharactersController } from './presentation/controllers/characters.controller';

@Module({
  controllers: [CharactersController],
  providers: [ListCharactersUseCase],
})
export class CharactersModule {}
