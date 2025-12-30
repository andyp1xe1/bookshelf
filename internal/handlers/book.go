// Package handlers implements HTTP handlers for book-related operations.
package handlers

import (
	"context"

	"github.com/andyp1xe1/bookshelf/internal/api"
)

type BookService interface {
	Create(ctx context.Context, in api.BookCreate) (api.Book, error)
	Get(ctx context.Context, id int64) (api.Book, bool, error)
	Update(ctx context.Context, id int64, in api.BookUpdate) (api.Book, bool, error)
	Delete(ctx context.Context, id int64) (bool, error)
	List(ctx context.Context, limit, offset int32) (api.BookList, error)
	Search(ctx context.Context, query string, limit, offset int32) (api.BookList, error)
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
	return api.ListBooks200JSONResponse(books), nil
}

func (h *BookHandler) CreateBook(ctx context.Context, in api.CreateBookRequestObject) (api.CreateBookResponseObject, error) {
	if in.Body == nil {
		detail := "body is required"
		return api.CreateBook422JSONResponse{
			Title:  "Validation error",
			Detail: &detail,
		}, nil
	}
	book, err := h.service.Create(ctx, *in.Body)
	if err != nil {
		detail := err.Error()
		return api.CreateBook422JSONResponse{
			Title:  "Validation error",
			Detail: &detail,
		}, nil
	}
	return api.CreateBook201JSONResponse(book), nil
}

func (h *BookHandler) SearchBooks(ctx context.Context, in api.SearchBooksRequestObject) (api.SearchBooksResponseObject, error) {
	limit, offset := normalizeLimitOffset(in.Params.Limit, in.Params.Offset)
	books, err := h.service.Search(ctx, in.Params.Q, limit, offset)
	if err != nil {
		return nil, err
	}
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
	return api.GetBookByID200JSONResponse(book), nil
}

func (h *BookHandler) UpdateBook(ctx context.Context, in api.UpdateBookRequestObject) (api.UpdateBookResponseObject, error) {
	if in.Body == nil {
		detail := "body is required"
		return api.UpdateBook422JSONResponse{
			Title:  "Validation error",
			Detail: &detail,
		}, nil
	}
	book, found, err := h.service.Update(ctx, in.BookID, *in.Body)
	if err != nil {
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
	return api.UpdateBook200JSONResponse(book), nil
}

func (h *BookHandler) DeleteBookByID(ctx context.Context, in api.DeleteBookByIDRequestObject) (api.DeleteBookByIDResponseObject, error) {
	deleted, err := h.service.Delete(ctx, in.BookID)
	if err != nil {
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
