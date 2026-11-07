# Authorization module

> Location: `src/modules/authorization/` · Rules: [security, authentication, and authorization](../conventions.md#security-authentication-and-authorization)
> · Related: [`users.md`](users.md), [`auth.md`](auth.md)

Owns the fixed Role/Ability catalog, the management of which abilities each role is granted, and the
`AbilitiesGuard` that enforces every route's `.ability(...)` requirements. Routes and payloads are in
Swagger; this document covers the rules behind them.

## Public API

- `index.ts`: `RoleEntity`, `RoleEnum`, `ROLE_REPOSITORY`/`RoleRepository`,
  `USER_ABILITY_REPOSITORY`/`UserAbilityRepository` (for `GET /users/me/abilities`),
  `assertRolesResolved`, and `RoleNotFoundError`/`InactiveRoleError` (for registration's default
  role), consumed by `users`.
- `presentation.ts`: `AbilitiesGuard` (bound globally by `auth`) and `RoleListResponseDto` (embedded
  in `users` responses).
- `persistence.ts`: `RoleOrmEntity`, `RoleMapper`, and the roles, abilities, and role-abilities
  seeders. `UserOrmEntity` imports `RoleOrmEntity` directly for `user_roles`.
- `authorization.module.ts`: `AuthorizationModule`.

The `Action` and `Subject` enums, the `AbilityPair` type, and `MissingAbilityError` live in the
shared kernel (`src/shared/domain/`): every module needs them for its `.ability(...)` calls, and the
shared exception filter reads the error, so they cannot belong to a business module.

## Enforcement

`AbilitiesGuard` passes routes without ability metadata. Otherwise it requires an authenticated actor
(`UnauthorizedError` without one) and **all** of the route's `(action, subject)` pairs. A denial is
`MissingAbilityError` (`403`) carrying only the pairs the caller lacks, which the error body exposes
as `requiredAbilities`.

- **Resolved from the database on every request, with no cache**, so revoking a role or grant takes
  effect immediately. A cache would be a deliberate future optimization.
- **Only active records grant anything.** An ability counts only when the user, the granting role,
  and the ability itself are all `ACTIVE` and not soft-deleted. An inactive or soft-deleted ability
  stays linked but authorizes nothing until it is restored, which only a direct database change can
  do.

## The catalog

Roles (`ADMIN`, `USER`) and abilities are fixed in code (`domain/catalog/ability-catalog.ts`) and
seeded. Only listing roles and abilities and replacing a role's grants are exposed; there is no
runtime create, update, or delete for roles or abilities. Role names are `RoleKey` codes, and their
display labels come from i18n at read time. `role_abilities` and `user_roles` are plain many-to-many
relations without attributes of their own, so neither has its own entity.

The ability catalog is the full `Action × Subject` cross-product, but not every pair guards a route:

- **In use:** all four `USER` pairs, `(READ, ROLE)` and `(UPDATE, ROLE)`, `(READ, ABILITY)`, and all
  four `PROJECT` pairs ([`projects.md`](projects.md#access)).
- **Reserved:** `(CREATE, ROLE)`, `(DELETE, ROLE)`, `(CREATE, ABILITY)`, `(UPDATE, ABILITY)`, and
  `(DELETE, ABILITY)`, the operations that are not manageable at runtime.

Reserved pairs are seeded, held by `ADMIN`, and grantable, but **authorize nothing** until a route
requires them. They are kept on purpose: the full cross-product keeps every enum-valid payload
matched to a catalog entry, removing a pair from existing databases needs a hand-written data
migration (seeders never delete), and a future route can use one without catalog or seed changes.
When a route starts or stops requiring a pair, move it between the two lists above.

## Listing order

`GET /roles` accepts optional `sortBy` (`role`, `status`, `createdAt`) and `sortOrder` (`ASC`,
`DESC`). An explicit field defaults to ascending order; a direction without a field leaves the
existing database order unchanged. Explicit sorting uses internal id descending to break ties and
keeps each role's abilities populated. `role` sorts the stored role code and `status` the stored
status, rather than their translated labels. Invalid or repeated sorting parameters receive a
localized validation error (`400`).

## Replacing a role's grants

`PATCH /roles/:uuid/abilities` **replaces** the grant set; it never merges.

- **Check order:** not found → inactive role → `ADMIN` immutable → pair resolution → ability active →
  persist. An inactive `ADMIN` role is therefore `InactiveRoleError`, not
  `AdminRoleAbilitiesImmutableError`; tests assert the order.
- **Unresolvable or inactive abilities.** A pair whose ability is soft-deleted is
  `UnknownAbilityError` (`422`); an inactive one is `InactiveAbilityError` (`409`). Responses do not
  expose ability status, so echoing a role's grants back fails while one of them is inactive; dropping
  that pair succeeds and unlinks it.
- **An empty `abilities: []` is valid** and revokes every grant, so the DTO deliberately has no
  `@ArrayNotEmpty()`.
- **Duplicate pairs are a `400`** (`@ArrayUnique`, `validation.ARRAY_UNIQUE`); the use-case also
  de-duplicates for direct callers.
- **`UnknownAbilityError` is nearly unreachable over HTTP.** `subject` is enum-validated and the
  catalog is the full cross-product, so only a soft-deleted ability triggers it. It stays because it
  becomes reachable as soon as the catalog stops being the full cross-product.

Two `403`s are easily confused: `AdminRoleAbilitiesImmutableError` is a rule about the **target**
(the `ADMIN` grant set is fixed whoever calls), while `MissingAbilityError` is about the **caller**.
Only the latter carries `requiredAbilities`.

## Presentation details

- `actionLabel` comes from the shared `enums.json` (`Action` is shared-kernel vocabulary, like
  `RecordStatus`), while `subjectLabel` and role labels come from this module's locale file.
- `AbilityResponseDto` is the single-DTO exemption from the list/detail pair: abilities expose no
  extra detail fields and have no single-resource route.

## Seeds

`AbilitiesSeeder` → `RolesSeeder` → `RoleAbilitiesSeeder` run in that order inside the single seed
transaction and throw when a prerequisite is missing. They are idempotent and **non-destructive**:
they insert what is missing and never delete or reset a grant, so runtime changes survive every
re-seed, including the Compose `api` start.

Default grants (`ROLE_ABILITY_GRANTS`): `ADMIN` gets the full catalog and `USER` only
`(READ, PROJECT)`, so a self-registered account reaches the self-service routes under `/users/me`,
which need no ability, and the projects assigned to it, but cannot list or read other users.

- **`RolesSeeder` applies a role's defaults only when it creates the role.** Existing roles, including
  ones whose grants were edited or emptied, are left untouched, so a changed default for a non-`ADMIN`
  role reaches only fresh databases; existing ones are updated through the endpoint or a data
  migration. `RevokeReadUserFromUserRole1794068245174` removes the former `USER` default
  `(READ, USER)` from existing databases; it is a no-op when the grant is absent, and reverting it
  grants the pair again. `GrantReadProjectToUserRole1794070369426` creates the `(READ, PROJECT)`
  ability when missing and grants it to an existing `USER` role; it is idempotent, does nothing to
  roles that do not exist yet, and reverting it revokes only that grant.
- **`RoleAbilitiesSeeder` tops up `ADMIN`** with any catalog ability it lacks. Because `ADMIN`'s
  grants cannot change at runtime, this is how a new catalog ability reaches `ADMIN` in an existing
  database.
- Both skip inactive abilities. `ADMIN` receives a reactivated ability on the next seed; other roles
  created while it was inactive need it granted through the endpoint.

## Configuration

None.

## Adding a subject

A new `Subject` value extends the `abilities_subject_enum` PostgreSQL type. Pending migrations share
one transaction, and a value added with `ALTER TYPE ... ADD VALUE` cannot be used until that
transaction commits, so a data migration in the same run could not insert or grant the new pairs.
`AddProjectAbilitySubject1794070345103` therefore recreates the type with the new value (rename,
create, cast the column, drop the old type) in a hand-written migration; its revert deletes the
`PROJECT` abilities and their grants first so the old type can be restored. Follow the same pattern
for the next subject.

