env "local" {
  src = "file://db/schema.sql"
  url = getenv("DATABASE_URL")
  dev = getenv("DEV_DATABASE_URL")

  migration {
    dir = "file://db/migrations"
  }
}

env "render" {
  src = "file://db/schema.sql"
  url = getenv("RENDER_DATABASE_URL")
  dev = getenv("DEV_DATABASE_URL")

  migration {
    dir = "file://db/migrations"
  }
}
