# Projects module

> Location: `src/modules/projects/` · Rules: [modules](../conventions.md#modules) and
> [security, authentication, and authorization](../conventions.md#security-authentication-and-authorization)
> · Related: [`users.md`](users.md), [`authorization.md`](authorization.md), [`characters.md`](characters.md)

Projects led by one responsible hero, each with six fixed goals whose progress drives the project's
overall progress and status, plus the dashboard statistics built on them. Routes and payloads are
in Swagger; this document covers the rules behind them.

## Public API

None. No other module consumes `projects`; `AppModule` imports `ProjectsModule`.

## Project

- **Fields.** `name` (1–150 characters) and `description` (1–2000 characters) are required and must
  contain a non-whitespace character (`NON_BLANK_PATTERN`); they are stored as sent. The limits live
  in `domain/constraints/project-input.constraints.ts` and are shared by DTOs, Swagger, and the
  `varchar` columns.
- **Partial updates.** On `PATCH /projects/:uuid`, `name`, `description`, and `responsibleUuid` are
  optional; an omitted field keeps its value and an explicit `null` is a `400`.
- **Soft deletion only.** `DELETE /projects/:uuid` sets `deleted_at` and `deleted_by`; deleted
  projects disappear from every route. Goal rows stay attached to the soft-deleted project.
- **Record status is internal.** Projects extend `BaseOrmEntity`, so they carry the usual
  `ACTIVE`/`INACTIVE` `status` column, but there is no route to toggle it and it always stays
  `ACTIVE`. Single-record GET and UPDATE still call `assertRecordActive` with `InactiveProjectError`
  (`409`), per convention. The API's `status` field is the [derived project status](#goals-progress-and-status),
  stored in the `progress_status` column.

## Responsible hero

Every project has exactly one responsible hero (`projects.responsible_id`, an `int` FK to
`users.id` with `ON DELETE RESTRICT`). A hero may be responsible for many projects.

- **Eligibility is checked on assignment only.** On create, and on update when `responsibleUuid`
  differs from the current hero, the user must exist and not be soft-deleted (`ResponsibleHeroNotFoundError`,
  `404`), and must be `ACTIVE` and hold a live, `ACTIVE` `USER` role (`IneligibleResponsibleHeroError`,
  `422`). Sending the current hero's uuid unchanged skips the check.
- **Deactivating or deleting a user keeps their projects.** Neither flow touches projects; the
  project keeps the hero, whose name and character still show (the join uses `withDeleted`). An
  administrator reassigns such projects with `PATCH /projects/:uuid`.
- **Only public fields leave the API.** `responsible` is `{ uuid, name, character }`, where `name` is
  the real name and `character` the [catalog entry](characters.md) or `null`. Email, roles, status,
  and audit fields are never exposed.
- **Picking a hero does not open the user directory.** `GET /projects/heroes` lists the eligible
  heroes (active users with an active `USER` role, by name, with an optional `name` filter) in the
  same public shape. Like every `GET`, it needs `(READ, PROJECT)`; on top of that,
  `ListProjectHeroesUseCase` lets only callers holding the `ADMIN` role list heroes
  (`ProjectHeroesForbiddenError`, `403`), so regular users never see the full list of heroes,
  whatever grants their role has. It needs no `(UPDATE, PROJECT)`, so creating a project needs
  only `(CREATE, PROJECT)` and `(READ, PROJECT)`, and no `(READ, USER)`. An administrator who also
  holds `USER` is eligible.

## Goals, progress, and status

`ProjectEntity.create` gives every project the six goals `AGILITY`, `DELIGHT`, `EFFICIENCY`,
`EXCELLENCE`, `TRANSPARENCY`, and `AMBITION` (`ProjectGoalType`, in that catalog order) with a `null`
description and progress `0`. They are rows in `project_goals`, unique per `(project_id, goal)`, and
are never added or removed afterwards.

- **Editing.** `PATCH /projects/:uuid/goals` takes a non-empty array of `{ goal, description?,
  progress? }`, each goal at most once (`validation.ARRAY_UNIQUE`). Goals left out keep their values;
  an omitted `description` or `progress` keeps the current one, and `description: null` clears it.
  `progress` is an integer from 0 to 100; `description` is at most 500 characters.
- **Derived values.** Goals have equal weight. Overall `progress` is their average rounded down;
  `status` is `PENDING` when every goal is at 0, `COMPLETED` when every goal is at 100, and
  `IN_PROGRESS` otherwise (`domain/policies/project-progress.policy.ts`). Both are computed by the
  domain entity and stored on `projects` (`progress`, `progress_status`) on every write, so listing
  can filter and sort on them and statistics aggregate them in SQL. No DTO accepts them: the
  validation whitelist strips `status` and `progress` from any body.
- **Concurrency.** Update, goal update, and delete lock the project row (`FOR NO KEY UPDATE`) inside
  a transaction and write goals with an upsert on `(project_id, goal)`, so concurrent goal edits
  serialize and the stored progress always matches the goals.

## Access

| Route | Abilities |
| --- | --- |
| `GET /projects`, `GET /projects/:uuid`, `GET /projects/statistics`, `GET /projects/:uuid/history` | `(READ, PROJECT)` |
| `POST /projects` | `(CREATE, PROJECT)` + the `ADMIN` role |
| `PATCH /projects/:uuid`, `PATCH /projects/:uuid/goals` | `(UPDATE, PROJECT)` + `(READ, PROJECT)` + the `ADMIN` role |
| `DELETE /projects/:uuid` | `(DELETE, PROJECT)` + `(READ, PROJECT)` + the `ADMIN` role |
| `GET /projects/heroes` | `(READ, PROJECT)` + the `ADMIN` role |

`ADMIN` holds every pair; `USER` holds only `(READ, PROJECT)`
([seeds](authorization.md#seeds)). Grants are editable at runtime, so the abilities alone do not
keep management with administrators: after the `AbilitiesGuard` checks the pairs, the create,
update, goal update, and delete use-cases call `assertProjectAdministrator`, which rejects a caller
without the `ADMIN` role with `ProjectManagementForbiddenError` (`403`) before the project is looked
up. A `USER` granted `(CREATE, PROJECT)`, `(UPDATE, PROJECT)`, or `(DELETE, PROJECT)` therefore stays
read-only, and only callers holding the `ADMIN` role create, edit, reassign, delete, or update goals,
or list the assignable heroes.

**Visibility.** A caller holding the `ADMIN` role sees every project. Anyone else is scoped to the
projects they are responsible for (`projectScopeFor`): the listing and statistics only count them,
and `GET /projects/:uuid` on another hero's project is `ProjectNotFoundError` (`404`), so a project's
existence does not leak. The `responsible` filter is accepted from everyone but can only narrow a
regular user's own scope.

## Listing and statistics

`GET /projects` is paginated and accepts `name` (case-insensitive partial match), `status`
(`PENDING`, `IN_PROGRESS`, `COMPLETED`), `responsible` (hero uuid), `sortBy` (`name`, `status`,
`progress`, `responsible`, `createdAt`, `updatedAt`), and `sortOrder`. Without `sortBy`, the newest
project comes first; explicit sorting defaults to ascending and breaks ties by internal id descending.
`status` sorts by the Postgres enum declaration order, not alphabetically: ascending is `PENDING`,
`IN_PROGRESS`, `COMPLETED`. `responsible` sorts by the hero's real name. List items carry `uuid`,
`name`, `status`, `statusLabel`, `progress`, `responsible`, `createdAt`, and `updatedAt`; the detail
adds `description` and the six `goals` with `goalLabel`.

`GET /projects/statistics` returns `total`, `pending`, `inProgress`, `completed`, and
`averageProgress` (the average overall progress rounded down, `0` without projects) over the
caller's visible projects.

Labels come from `enums.project_status.*` and `enums.project_goal.*` in `pt-BR` and `en`.

## Persistence notes

- `projects` holds `responsible_id` (indexed), the derived `progress` (`smallint`, checked 0–100)
  and `progress_status`, and the `created_by`/`updated_by`/`deleted_by` actor columns
  (`ON DELETE SET NULL`).
- `project_goals` rows cascade with their project and have no uuid: they are always addressed as
  `(project, goal)`.
- `TypeOrmProjectHeroRepository` reads `UserOrmEntity` through `@modules/users/persistence` and
  checks the `USER` role with an `IN (SELECT ...)` subquery on `user_roles`, so a user with several
  roles is not duplicated.

## Configuration

None.

## Project change history

`GET /projects/:uuid/history` returns paginated, read-only business events with the same visibility,
active-record check, and not-found behavior as project details. `page` defaults to 1 and `limit` to
20 (maximum 50). Entries are ordered by `created_at DESC, id DESC`, including deterministic ordering
when one transaction records several changes. Timestamps use database statement time after the
project lock, so a transaction started earlier cannot place a later change below its predecessor.
This history is separate from technical audit logs.

Each entry exposes `uuid`, `type`, `createdAt`, `actor` (`{ uuid, name }` or `null`), `goal` (a goal
code for goal events, otherwise `null`), `previousValues`, and `newValues`. Values contain only the
relevant `name`, `description`, `responsible` (`{ uuid, name }`), or `progress` fields. Event types
are `PROJECT_CREATED`, `PROJECT_NAME_CHANGED`, `PROJECT_DESCRIPTION_CHANGED`,
`RESPONSIBLE_HERO_CHANGED`, `GOAL_DESCRIPTION_CHANGED`, `GOAL_PROGRESS_CHANGED`, and
`PROJECT_DELETED`. Creation stores the initial name, description, and hero in `newValues`;
deletion stores those final values in `previousValues`. Field changes store both values; goal
progress includes both integer percentages, and clearing a goal description records `null`.

Events are appended inside the existing project transaction. Updates compare the locked project
with its saved state and record one event for each actual value change. Omitted or unchanged fields
create no events. A history write failure rolls back the project write, including its goals or
soft deletion. Existing projects receive no invented backfill; history begins with changes made
after this feature is deployed.

`project_history` is append-only and extends `BaseTechnicalOrmEntity`. Its project FK uses
`ON DELETE RESTRICT`; project soft deletion retains all events, while the public endpoint continues
to hide the deleted project. The nullable actor FK uses `ON DELETE SET NULL`: inactive and
soft-deleted actors still resolve by name, and hard-deleted actors appear as `null` without losing
events. Responsible hero values are public name/uuid snapshots. Email, credentials, roles, internal
IDs, and unrelated audit context are never exposed. There are no history mutation endpoints.
