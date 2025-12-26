package main

import (
	"context"
	"go-openapi/internal/api"
	"go-openapi/internal/handlers"
	"go-openapi/internal/services"
	"go-openapi/internal/store"
	"log"
	"os"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Printf(".env not loaded: %v", err)
	}

	ctx := context.Background()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	conn, err := pgx.Connect(ctx, dbURL)
	if err != nil {
		log.Fatal(err)
	}

	defer conn.Close(ctx)

	app := fiber.New()
	app.Use(cors.New())
	store := store.New(conn)
	service := services.NewBookService(store)
	handler := handlers.NewBookHandler(service)
	si := api.NewStrictHandler(handler, nil)

	api.RegisterHandlers(app, si)

	log.Fatal(app.Listen("0.0.0.0:8080"))
}
