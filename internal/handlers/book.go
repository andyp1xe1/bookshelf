// Package handlers implements HTTP handlers for book-related operations.
package handlers

import (
	"context"
	"errors"

	"github.com/andyp1xe1/bookshelf/internal/api"
	"github.com/andyp1xe1/bookshelf/internal/auth"
	"github.com/andyp1xe1/bookshelf/internal/services"
)

type BookService interface {
	Create(ctx context.Context, userID string, in api.BookCreate) (api.Book, error)
	Get(ctx context.Context, id int64) (api.Book, bool, error)
	Update(ctx context.Context, userID string, id int64, in api.BookUpdate) (api.Book, bool, error)
	Delete(ctx context.Context, userID string, id int64) (bool, error)
	List(ctx context.Context, limit, offset int32) (api.BookList, error)
	Search(ctx context.Context, query string, limit, offset int32) (api.BookList, error)
	LookupISBN(ctx context.Context, isbn string, uploadCover bool) (api.BookMetadata, error)
	EnrichBookWithCoverURL(ctx context.Context, book api.Book) api.Book
	EnrichBooksWithCoverURLs(ctx context.Context, books []api.Book) []api.Book
}

type BookHandler struct {
	service BookService
}

func NewBookHandler(service BookService) *BookHandler {
	return &BookHandler{service: service}
}

func (h *BookHandler) ListBooks(ctx context.Context, in api.ListBooksRequestObject) (api.ListBooksResponseObject, error) {
	limit, offset := normalizeLimitOffset(in.Params.Limit, in.Params.Offset)
	books, err := h.service.List(ctx, limit, offset)
	if err != nil {
		return nil, err
	}
	// Enrich with presigned cover URLs
	books.Items = h.service.EnrichBooksWithCoverURLs(ctx, books.Items)
	return api.ListBooks200JSONResponse(books), nil
}

func (h *BookHandler) CreateBook(ctx context.Context, in api.CreateBookRequestObject) (api.CreateBookResponseObject, error) {
	authData, ok := auth.GetAuthData(ctx)
	if !ok {
		return api.CreateBook401JSONResponse(UnauthorizedProblem), nil
	}
	book, err := h.service.Create(ctx, authData.ID, *in.Body)
	if err != nil {
		detail := err.Error()
		return api.CreateBook422JSONResponse{
			Title:  "Validation error",
			Detail: &detail,
		}, nil
	}
	// Enrich with presigned cover URL
	book = h.service.EnrichBookWithCoverURL(ctx, book)
	return api.CreateBook201JSONResponse(book), nil
}

func (h *BookHandler) SearchBooks(ctx context.Context, in api.SearchBooksRequestObject) (api.SearchBooksResponseObject, error) {
	limit, offset := normalizeLimitOffset(in.Params.Limit, in.Params.Offset)
	books, err := h.service.Search(ctx, in.Params.Q, limit, offset)
	if err != nil {
		return nil, err
	}
	// Enrich with presigned cover URLs
	books.Items = h.service.EnrichBooksWithCoverURLs(ctx, books.Items)
	return api.SearchBooks200JSONResponse(books), nil
}

func (h *BookHandler) GetBookByID(ctx context.Context, in api.GetBookByIDRequestObject) (api.GetBookByIDResponseObject, error) {
	book, found, err := h.service.Get(ctx, in.BookID)
	if err != nil {
		return nil, err
	}
	if !found {
		detail := "book not found"
		return api.GetBookByID404JSONResponse{
			Title:  "Not found",
			Detail: &detail,
		}, nil
	}
	// Enrich with presigned cover URL
	book = h.service.EnrichBookWithCoverURL(ctx, book)
	return api.GetBookByID200JSONResponse(book), nil
}

func (h *BookHandler) UpdateBook(ctx context.Context, in api.UpdateBookRequestObject) (api.UpdateBookResponseObject, error) {
	authData, ok := auth.GetAuthData(ctx)
	if !ok {
		return api.UpdateBook401JSONResponse(UnauthorizedProblem), nil
	}
	book, found, err := h.service.Update(ctx, authData.ID, in.BookID, *in.Body)
	if err != nil {
		if errors.Is(err, services.ErrForbidden) {
			return api.UpdateBook403JSONResponse(ForbiddenProblem), nil
		}
		detail := err.Error()
		return api.UpdateBook422JSONResponse{
			Title:  "Validation error",
			Detail: &detail,
		}, nil
	}
	if !found {
		detail := "book not found"
		return api.UpdateBook404JSONResponse{
			Title:  "Not found",
			Detail: &detail,
		}, nil
	}
	// Enrich with presigned cover URL
	book = h.service.EnrichBookWithCoverURL(ctx, book)
	return api.UpdateBook200JSONResponse(book), nil
}

func (h *BookHandler) DeleteBookByID(ctx context.Context, in api.DeleteBookByIDRequestObject) (api.DeleteBookByIDResponseObject, error) {
	authData, ok := auth.GetAuthData(ctx)
	if !ok {
		return api.DeleteBookByID401JSONResponse(UnauthorizedProblem), nil
	}
	deleted, err := h.service.Delete(ctx, authData.ID, in.BookID)
	if err != nil {
		if errors.Is(err, services.ErrForbidden) {
			return api.DeleteBookByID403JSONResponse(ForbiddenProblem), nil
		}
		return nil, err
	}
	if !deleted {
		detail := "book not found"
		return api.DeleteBookByID404JSONResponse{
			Title:  "Not found",
			Detail: &detail,
		}, nil
	}
	return api.DeleteBookByID204Response{}, nil
}

func (h *BookHandler) LookupBookByISBN(ctx context.Context, in api.LookupBookByISBNRequestObject) (api.LookupBookByISBNResponseObject, error) {
	metadata, err := h.service.LookupISBN(ctx, in.Isbn, true) // Upload cover to R2
	if err != nil {
		if err.Error() == "ISBN not found in OpenLibrary" {
			detail := "ISBN not found in OpenLibrary database"
			return api.LookupBookByISBN404JSONResponse{
				Title:  "Not Found",
				Detail: &detail,
			}, nil
		}
		detail := err.Error()
		return api.LookupBookByISBN500JSONResponse{
			Title:  "Failed to lookup ISBN",
			Detail: &detail,
		}, nil
	}
	return api.LookupBookByISBN200JSONResponse(metadata), nil
}

func normalizeLimitOffset(limit, offset *int32) (int32, int32) {
	const defaultLimit int32 = 20
	const defaultOffset int32 = 0

	resolvedLimit := defaultLimit
	if limit != nil {
		resolvedLimit = *limit
	}

	resolvedOffset := defaultOffset
	if offset != nil {
		resolvedOffset = *offset
	}

	return resolvedLimit, resolvedOffset
}
