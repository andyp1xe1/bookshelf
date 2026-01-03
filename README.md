# Bookshelf

The purpose of this project was to:
- learn the usage of Open API client generation from spec
- learn the usage of `sqlc` to generate query methods and models from raw sql
- learn tanstack query and router libs

## Schema first

This project was developed by a schema-first approach.

The supposed benefit behind this is that it forces the developer to have a
clear mental model of the API shape, and of the database schema.

This approach also brings in friction - everytime a new REST resource or
database change needs to happen the developer is forced to declare their
expectations first. But in my opinion it is beneficial since it surfaces at an
early stage ambiguities of design and expectations.

## Backend

`api/` holds openapi schema. Generates api boilerplate to ./internal/api/ using
Open API spec.

### Data Storage

`db/` holds sql code and migrations. Database layer is managed by `sqlc`. Sql
dialect is postgres. Migrations are managed by `atlas`. Object storage uses
Cloudflare R2 with AWS S3 sdk.

## Frontend

Located at `web/`. Components and styles from https://ui.shadcn.com/create.
Uses Open API generated client sdk. Config at `web/openapi-ts.config.ts`.
Authentication uses ready provided Clerk components Frontend is hosted on
Cloudflare Workers as a SPA.
