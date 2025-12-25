package book

import (
	"context"
	"fmt"
	"strconv"

	"go-openapi/internal/book/api"
	"go-openapi/internal/book/store"
)

type BookService struct {
	books *store.Queries
}

func NewBookService(repo *store.Queries) *BookService {
	return &BookService{
		books: repo,
	}
}

func (s *BookService) Create(ctx context.Context, in api.BookCreate) (api.Book, error) {
	year, err := parsePublishedYear(in.PublishedYear)
	if err != nil {
		return api.Book{}, err
	}

	record, err := s.books.CreateBook(ctx, store.CreateBookParams{
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
		return api.Book{}, false, err
	}
	return recordToAPI(record), true, nil
}

func (s *BookService) Update(ctx context.Context, id int64, in api.BookUpdate) (api.Book, bool, error) {
	_, err := s.books.GetBook(ctx, id)

	if err != nil {
		return api.Book{}, false, err
	}

	year, err := parsePublishedYear(in.PublishedYear)
	if err != nil {
		return api.Book{}, false, err
	}

	record, err := s.books.UpdateBook(ctx, store.UpdateBookParams{
		ID:            id,
		Title:         in.Title,
		Author:        in.Author,
		PublishedYear: year,
		Isbn:          in.Isbn,
		Genre:         in.Genre,
	})
	if err != nil {
		return api.Book{}, false, err
	}

	return recordToAPI(record), true, nil
}

func (s *BookService) Delete(ctx context.Context, id int64) (bool, error) {
	deleted, err := s.books.DeleteBook(ctx, id)
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
