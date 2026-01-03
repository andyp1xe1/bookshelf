package main

import (
	"context"
	"io"

	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/andyp1xe1/bookshelf/internal/api"
	"github.com/andyp1xe1/bookshelf/internal/auth"
	"github.com/andyp1xe1/bookshelf/internal/handlers"
	"github.com/andyp1xe1/bookshelf/internal/services"
	"github.com/andyp1xe1/bookshelf/internal/store"
	"github.com/clerk/clerk-sdk-go/v2"

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

	clerk.SetKey(os.Getenv("CLERK_SECRET_KEY"))

	app := fiber.New()
	app.Use(cors.New())
	app.Get("/healthz", func(c *fiber.Ctx) error {
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

	selfPingURL := os.Getenv("SELF_PING_URL")
	if selfPingURL == "" {
		selfPingURL = "http://localhost:" + port + "/healthz"
	}
	selfPingInterval := os.Getenv("SELF_PING_INTERVAL")
	if selfPingInterval == "" {
		selfPingInterval = "13m"
	}
	waitDuration, err := time.ParseDuration(selfPingInterval)
	if err != nil {
		log.Printf("invalid SELF_PING_INTERVAL, defaulting to 13m: %v", err)
		waitDuration = 13 * time.Minute
	}
	go func() {
		rng := rand.New(rand.NewSource(time.Now().UnixNano()))
		log.Printf("starting self-ping to %s", selfPingURL)
		for {
			resp, err := http.Get(selfPingURL)
			if err != nil {
				log.Printf("self-ping failed: %v", err)
				continue
			}
			if res, err := io.ReadAll(resp.Body); err != nil {
				log.Printf("self-ping read body failed: %v", err)
			} else {
				log.Printf("self-ping response body: %s", string(res))
			}
			resp.Body.Close()
			if resp.StatusCode != http.StatusOK {
				log.Printf("self-ping status: %s", resp.Status)
			}

			jitter := time.Duration(rng.Intn(60)) * time.Second
			time.Sleep(waitDuration + jitter)
		}
	}()

	url := "0.0.0.0:" + port
	log.Fatal(app.Listen(url))
}
