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
each with a stable `code`, a display `name`, a `universe`, and an optional `avatarPath`.

- **Defined in code, not seeded.** Nothing about a character changes at runtime and no row needs an
  id, so there is no table, seeder, or management route. Users store the `code` in a PostgreSQL enum
  column, so adding a character means adding it to `CharacterCode` and the catalog and generating a
  migration that extends the enum types.
- **Names are proper nouns** and are not translated. `universeLabel` is translated from
  `enums.character_universe.*` in `pt-BR` and `en`, following the label companion rule.
- **Avatars ship with the web app.** `avatarPath` is a path relative to the web app's origin
  (`/characters/<slug>.svg`), or `null` when the character has none. The API serves no images and
  accepts no uploads; the client shows the user's initials when there is no avatar.

## Routes

`GET /characters` returns the whole catalog in catalog order. It is public so the registration page
can offer a character before the user has an account, and it uses the default throttle budget.
