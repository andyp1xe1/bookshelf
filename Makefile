oapi:
	openapi bundle \
		-o ./api/_bundle.yaml ./api/openapi.yaml && \
	go tool oapi-codegen \
		--config ./api/oapi-codegen.yaml \
		./api/_bundle.yaml

sqlc:
	sqlc generate 

gen: oapi sqlc

migrate:
	. ./loadenv && \
	atlas migrate diff --env local && \
	atlas migrate apply --env local

migrate-remote:
	. ./loadenv && \
	atlas migrate apply --env render
