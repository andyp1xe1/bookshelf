package main

import (
	"log"

	"go-openapi/internal/pet"
	"go-openapi/internal/pet/api"

	"github.com/gofiber/fiber/v2"
)

func main() {
	app := fiber.New()
	service := pet.NewPetService()
	handler := pet.NewPetHandler(service)
	si := api.NewStrictHandler(handler, nil)

	api.RegisterHandlers(app, si)

	log.Fatal(app.Listen("0.0.0.0:8080"))
}
