import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateProjectDto } from '../create-project.dto';
import { UpdateProjectGoalsDto } from '../update-project-goals.dto';
import { UpdateProjectDto } from '../update-project.dto';

const HERO_UUID = '6f1f6c1e-8a43-4f39-9b0d-4c6c0f8e7d21';

function errorFields(errors: Awaited<ReturnType<typeof validate>>): string[] {
  return errors.map((error) => error.property);
}

describe('CreateProjectDto', () => {
  const valid = {
    name: 'Operation Skyfall',
    description: 'Stop the meteor shower.',
    responsibleUuid: HERO_UUID,
  };

  it('accepts a complete payload', async () => {
    expect(await validate(plainToInstance(CreateProjectDto, valid))).toEqual(
      [],
    );
  });

  it.each([
    [{ name: '   ' }, 'name'],
    [{ name: 'x'.repeat(151) }, 'name'],
    [{ description: '' }, 'description'],
    [{ description: 'x'.repeat(2001) }, 'description'],
    [{ responsibleUuid: 'not-a-uuid' }, 'responsibleUuid'],
    [{ responsibleUuid: undefined }, 'responsibleUuid'],
  ])('rejects %j', async (override, field) => {
    const errors = await validate(
      plainToInstance(CreateProjectDto, { ...valid, ...override }),
    );

    expect(errorFields(errors)).toEqual([field]);
  });
});

describe('UpdateProjectDto', () => {
  it('accepts an empty body', async () => {
    expect(await validate(plainToInstance(UpdateProjectDto, {}))).toEqual([]);
  });

  it('rejects explicit nulls', async () => {
    const errors = await validate(
      plainToInstance(UpdateProjectDto, {
        name: null,
        description: null,
        responsibleUuid: null,
      }),
    );

    expect(errorFields(errors).sort()).toEqual([
      'description',
      'name',
      'responsibleUuid',
    ]);
  });
});

describe('UpdateProjectGoalsDto', () => {
  async function validateGoals(goals: unknown) {
    return validate(plainToInstance(UpdateProjectGoalsDto, { goals }));
  }

  it('accepts partial goal changes, including a null description', async () => {
    expect(
      await validateGoals([
        { goal: 'AGILITY', progress: 0 },
        { goal: 'AMBITION', description: null },
        { goal: 'DELIGHT', description: 'Smiles', progress: 100 },
      ]),
    ).toEqual([]);
  });

  it.each([
    ['omitted', { goal: 'AGILITY' }],
    ['null', { goal: 'AGILITY', description: null }],
    ['valid', { goal: 'AGILITY', description: '  Move fast  ' }],
  ])('accepts a %s goal description', async (_, change) => {
    expect(await validateGoals([change])).toEqual([]);
  });

  it.each([
    [[]],
    [[{ goal: 'AGILITY' }, { goal: 'AGILITY' }]],
    [[{ goal: 'SPEED' }]],
    [[{ goal: 'AGILITY', progress: 101 }]],
    [[{ goal: 'AGILITY', progress: -1 }]],
    [[{ goal: 'AGILITY', progress: 10.5 }]],
    [[{ goal: 'AGILITY', description: 'x'.repeat(501) }]],
    [[{ goal: 'AGILITY', description: '' }]],
    [[{ goal: 'AGILITY', description: '   ' }]],
    [[{ goal: 'AGILITY', description: '\t\n' }]],
    [[null]],
  ])('rejects %j', async (goals) => {
    expect(errorFields(await validateGoals(goals))).toEqual(['goals']);
  });
});
