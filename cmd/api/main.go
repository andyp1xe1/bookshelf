package main

import (
	"context"
	"go-openapi/internal/api"
	"go-openapi/internal/handlers"
	"go-openapi/internal/services"
	"go-openapi/internal/store"
	"log"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/jackc/pgx/v5/pgxpool"
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

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatal(err)
	}

	defer pool.Close()

	app := fiber.New()
	app.Use(cors.New())
	store := store.New(pool)
	service := services.NewBookService(store)
	handler := handlers.NewBookHandler(service)
	si := api.NewStrictHandler(handler, nil)

	api.RegisterHandlers(app, si)

	var port string
	if port = os.Getenv("PORT"); strings.Compare(port, "") == 0 {
		port = "8080"
	}

	url := "0.0.0.0:" + port
	log.Fatal(app.Listen(url))
}
