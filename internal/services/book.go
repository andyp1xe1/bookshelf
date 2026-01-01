package services

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/andyp1xe1/bookshelf/internal/api"
	"github.com/andyp1xe1/bookshelf/internal/store"
	"github.com/jackc/pgx/v5"
)

type BookStore interface {
	CreateBook(ctx context.Context, arg store.CreateBookParams) (store.Book, error)
	GetBook(ctx context.Context, id int64) (store.Book, error)
	UpdateBook(ctx context.Context, arg store.UpdateBookParams) (store.Book, error)
	DeleteBook(ctx context.Context, arg store.DeleteBookParams) (int64, error)
	ListBooks(ctx context.Context, arg store.ListBooksParams) ([]store.Book, error)
	SearchBooks(ctx context.Context, arg store.SearchBooksParams) ([]store.Book, error)
}

// Create(ctx context.Context, userID string, in api.BookCreate) (api.Book, error)
// Get(ctx context.Context, id int64) (api.Book, bool, error)
// Update(ctx context.Context, userID string, id int64, in api.BookUpdate) (api.Book, bool, error)
// Delete(ctx context.Context, userID string, id int64) (bool, error)
// List(ctx context.Context, limit, offset int32) (api.BookList, error)
// Search(ctx context.Context, query string, limit, offset int32) (api.BookList, error)

type BookService struct {
	books BookStore
}

func NewBookService(store BookStore) *BookService {
	return &BookService{
		books: store,
	}
}

func (s *BookService) Create(ctx context.Context, userID string, in api.BookCreate) (api.Book, error) {
	year, err := parsePublishedYear(in.PublishedYear)
	if err != nil {
		return api.Book{}, err
	}

	record, err := s.books.CreateBook(ctx, store.CreateBookParams{
		UserID:        userID,
		Title:         in.Title,
		Author:        in.Author,
		PublishedYear: year,
		Isbn:          in.Isbn,
		Genre:         in.Genre,
	})
	if err != nil {
		return api.Book{}, err
	}

	return recordToAPI(record), nil
}

func (s *BookService) Get(ctx context.Context, id int64) (api.Book, bool, error) {
	record, err := s.books.GetBook(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.Book{}, false, nil
		}
		return api.Book{}, false, err
	}
	return recordToAPI(record), true, nil
}

func (s *BookService) Update(ctx context.Context, userID string, id int64, in api.BookUpdate) (api.Book, bool, error) {
	existing, err := s.books.GetBook(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.Book{}, false, nil
		}
		return api.Book{}, false, err
	}
	if existing.UserID != userID {
		return api.Book{}, true, ErrForbidden
	}

	year, err := parsePublishedYear(in.PublishedYear)
	if err != nil {
		return api.Book{}, true, err
	}

	record, err := s.books.UpdateBook(ctx, store.UpdateBookParams{
		ID:            id,
		UserID:        userID,
		Title:         in.Title,
		Author:        in.Author,
		PublishedYear: year,
		Isbn:          in.Isbn,
		Genre:         in.Genre,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return api.Book{}, false, nil
		}
		return api.Book{}, true, err
	}

	return recordToAPI(record), true, nil
}

func (s *BookService) Delete(ctx context.Context, userID string, id int64) (bool, error) {
	existing, err := s.books.GetBook(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, err
	}
	if existing.UserID != userID {
		return false, ErrForbidden
	}

	deleted, err := s.books.DeleteBook(ctx, store.DeleteBookParams{
		ID:     id,
		UserID: userID,
	})
	if err != nil {
		return false, err
	}
	if deleted == 0 {
		return false, nil
	}
	return true, nil
}

func (s *BookService) List(ctx context.Context, limit, offset int32) (api.BookList, error) {
	records, err := s.books.ListBooks(ctx, store.ListBooksParams{
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return api.BookList{}, err
	}

	return recordsToBookList(records), nil
}

func (s *BookService) Search(ctx context.Context, query string, limit, offset int32) (api.BookList, error) {
	column1 := &query
	records, err := s.books.SearchBooks(ctx, store.SearchBooksParams{
		Column1: column1,
		Limit:   limit,
		Offset:  offset,
	})
	if err != nil {
		return api.BookList{}, err
	}

	return recordsToBookList(records), nil
}

func parsePublishedYear(value string) (int32, error) {
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return 0, fmt.Errorf("publishedYear must be numeric")
	}
	return int32(parsed), nil
}

func recordToAPI(record store.Book) api.Book {
	return api.Book{
		Id:            record.ID,
		Title:         record.Title,
		Author:        record.Author,
		PublishedYear: strconv.Itoa(int(record.PublishedYear)),
		Isbn:          record.Isbn,
		Genre:         record.Genre,
	}
}

func recordsToBookList(records []store.Book) api.BookList {
	items := make([]api.Book, 0, len(records))
	for _, record := range records {
		items = append(items, recordToAPI(record))
	}

	return api.BookList{
		Items: items,
		Total: int64(len(items)),
	}
}
