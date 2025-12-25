package main

import (
	"context"
	"log"
	"os"

	"go-openapi/internal/book"
	"go-openapi/internal/book/api"
	"go-openapi/internal/book/store"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5"
)

func main() {
	// if err := godotenv.Load(); err != nil {
	// 	log.Printf(".env not loaded: %v", err)
	// }

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
	store := store.New(conn)
	service := book.NewBookService(store)
	handler := book.NewBookHandler(service)
	si := api.NewStrictHandler(handler, nil)

	api.RegisterHandlers(app, si)

	log.Fatal(app.Listen("0.0.0.0:8080"))
}
