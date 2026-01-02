package services

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/andyp1xe1/bookshelf/internal/api"
	"github.com/andyp1xe1/bookshelf/internal/store"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
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
		UserID:         userID,
		Title:          in.Title,
		Author:         in.Author,
		PublishedYear:  year,
		Isbn:           in.Isbn,
		Genre:          in.Genre,
		CoverObjectKey: nil, // Will be set via autofill or manual upload
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
		ID:             id,
		UserID:         userID,
		Title:          in.Title,
		Author:         in.Author,
		PublishedYear:  year,
		Isbn:           in.Isbn,
		Genre:          in.Genre,
		CoverObjectKey: nil, // Keep existing cover for now
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
		Id:             record.ID,
		UserId:         record.UserID,
		Title:          record.Title,
		Author:         record.Author,
		PublishedYear:  strconv.Itoa(int(record.PublishedYear)),
		Isbn:           record.Isbn,
		Genre:          record.Genre,
		CoverObjectKey: record.CoverObjectKey,
		CoverUrl:       nil, // Will be populated by handler when needed
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

// LookupISBN fetches book metadata from OpenLibrary and optionally uploads cover to R2
func (s *BookService) LookupISBN(ctx context.Context, isbn string, uploadCover bool) (api.BookMetadata, error) {
	olService := NewOpenLibraryService()

	metadata, err := olService.LookupISBN(ctx, isbn)
	if err != nil {
		return api.BookMetadata{}, err
	}

	result := api.BookMetadata{
		Title:         metadata.Title,
		Author:        metadata.Author,
		PublishedYear: &metadata.PublishedYear,
		Genre:         &metadata.Genre,
		CoverUrl:      &metadata.CoverURL,
	}

	// Optionally download and upload cover to R2
	if uploadCover && metadata.CoverURL != "" {
		coverData, contentType, err := olService.DownloadCover(ctx, metadata.CoverURL)
		if err == nil {
			// Upload to R2
			objectKey, err := s.uploadCoverToR2(ctx, isbn, coverData, contentType)
			if err == nil {
				result.CoverObjectKey = &objectKey
			}
			// Ignore upload errors, just use the external URL
		}
	}

	return result, nil
}

// uploadCoverToR2 uploads a cover image to R2 and returns the object key
func (s *BookService) uploadCoverToR2(ctx context.Context, isbn string, data []byte, contentType string) (string, error) {
	// Create S3 client
	s3c, err := newS3Client()
	if err != nil {
		return "", fmt.Errorf("failed to create S3 client: %w", err)
	}

	bucketName := os.Getenv("CLOUDFLARE_R2_BUCKET_NAME")
	objectKey := fmt.Sprintf("covers/%s.jpg", isbn)

	_, err = s3c.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(bucketName),
		Key:         aws.String(objectKey),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload cover to R2: %w", err)
	}

	return objectKey, nil
}

// GenerateCoverPresignedURL generates a presigned URL for a cover image in R2
func (s *BookService) GenerateCoverPresignedURL(ctx context.Context, coverObjectKey string) (string, error) {
	if coverObjectKey == "" {
		return "", nil
	}

	s3c, err := newS3Client()
	if err != nil {
		return "", fmt.Errorf("failed to create S3 client: %w", err)
	}

	bucketName := os.Getenv("CLOUDFLARE_R2_BUCKET_NAME")

	presignClient := s3.NewPresignClient(s3c.Client)
	presignResult, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(bucketName),
		Key:    aws.String(coverObjectKey),
	}, func(opts *s3.PresignOptions) {
		opts.Expires = time.Hour // 1 hour expiry
	})

	if err != nil {
		return "", fmt.Errorf("failed to presign cover URL: %w", err)
	}

	return presignResult.URL, nil
}

// EnrichBookWithCoverURL adds presigned cover URL to a book
func (s *BookService) EnrichBookWithCoverURL(ctx context.Context, book api.Book) api.Book {
	if book.CoverObjectKey != nil && *book.CoverObjectKey != "" {
		if coverURL, err := s.GenerateCoverPresignedURL(ctx, *book.CoverObjectKey); err == nil && coverURL != "" {
			book.CoverUrl = &coverURL
		}
	}
	return book
}

// EnrichBooksWithCoverURLs adds presigned cover URLs to a list of books
func (s *BookService) EnrichBooksWithCoverURLs(ctx context.Context, books []api.Book) []api.Book {
	enriched := make([]api.Book, len(books))
	for i, book := range books {
		enriched[i] = s.EnrichBookWithCoverURL(ctx, book)
	}
	return enriched
}
