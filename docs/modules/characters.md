# Characters module

> Location: `src/modules/characters/` · Rules: [modules](../conventions.md#modules)
> · Related: [`users.md`](users.md#characters)

The fixed catalog of superhero characters a user may pick as their identity in the app. Routes and
payloads are in Swagger; this document covers the rules behind them.

## Public API

- `index.ts`: `CharacterCode`, the enum stored on users and change requests.
- `presentation.ts`: `CharacterResponseDto`, embedded in `users` responses.
- `characters.module.ts`: `CharactersModule`.

## Catalog

`domain/catalog/character-catalog.ts` defines 12 characters from Marvel, DC, Dark Horse, and Image,
each with a stable `code`, a display `name`, a `universe`, a selector `group`, and an `avatarPath`.

- **Defined in code, not seeded.** Nothing about a character changes at runtime and no row needs an
  id, so there is no table, seeder, or management route. Users store the `code` in a PostgreSQL enum
  column, so adding a character means adding it to `CharacterCode` and the catalog and generating a
  migration that extends the enum types.
- **Names are proper nouns** and are not translated. `universeLabel` is translated from
  `enums.character_universe.*` and `groupLabel` from `enums.character_group.*` in `pt-BR` and `en`,
  following the label companion rule.
- **Groups organize the selector; universes stay exact.** `group` (`CharacterGroup`) is `MARVEL` or
  `DC` for those universes and `OTHERS` for every other one, so Hellboy (Dark Horse), Spawn, and
  Invincible (Image) are listed under Others while keeping their own `universe`. The group is set
  explicitly on each catalog entry; a new universe needs no new group.
- **Avatars ship with the web app.** `avatarPath` is a path relative to the web app's origin
  (`/characters/<slug>.svg`). Every catalog character has one; the field stays nullable for future
  characters without an avatar. The API serves no images and accepts no uploads; the client shows
  the user's initials when there is no avatar.

Every character object the API returns, in `GET /characters` and in user and change request
responses, has exactly `code`, `name`, `universe`, `universeLabel`, `group`, `groupLabel`, and
`avatarPath`.

## Routes

`GET /characters` returns the whole catalog in catalog order. It is public so the registration page
can offer a character before the user has an account, and it uses the default throttle budget.
