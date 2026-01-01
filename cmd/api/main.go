package main

import (
	"context"

	"github.com/andyp1xe1/bookshelf/internal/api"
	"github.com/andyp1xe1/bookshelf/internal/auth"
	"github.com/andyp1xe1/bookshelf/internal/handlers"
	"github.com/andyp1xe1/bookshelf/internal/services"
	"github.com/andyp1xe1/bookshelf/internal/store"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

type HandlerWrapper struct {
	*handlers.BookHandler
	*handlers.DocumentHandler
}

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
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})
	store := store.New(pool)
	bookService := services.NewBookService(store)
	docsService, err := services.NewDocumentService(store)
	if err != nil {
		log.Fatalf("failed to create document service: %v", err)
	}
	bookHandler := handlers.NewBookHandler(bookService)
	documentHandler := handlers.NewDocumentHandler(docsService)
	si := api.NewStrictHandler(&HandlerWrapper{
		BookHandler:     bookHandler,
		DocumentHandler: documentHandler,
	}, []api.StrictMiddlewareFunc{auth.AuthMiddleware})

	api.RegisterHandlers(app, si)

	var port string
	if port = os.Getenv("PORT"); strings.Compare(port, "") == 0 {
		port = "8080"
	}

	selfPingURL := "http://127.0.0.1:" + port + "/health"
	// Self-ping to keep the service warm.
	go func() {
		rng := rand.New(rand.NewSource(time.Now().UnixNano()))
		for {
			wait := time.Duration(5+rng.Intn(6)) * time.Minute
			time.Sleep(wait)
			resp, err := http.Get(selfPingURL)
			if err != nil {
				log.Printf("self-ping failed: %v", err)
				continue
			}
			resp.Body.Close()
			if resp.StatusCode != http.StatusOK {
				log.Printf("self-ping status: %s", resp.Status)
			}
		}
	}()

	url := "0.0.0.0:" + port
	log.Fatal(app.Listen(url))
}
