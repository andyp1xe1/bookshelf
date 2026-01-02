package services

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/andyp1xe1/bookshelf/internal/api"
	"github.com/andyp1xe1/bookshelf/internal/store"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/jackc/pgx/v5"
)

const (
	MaxDocumentSizeBytes = 20 * 1024 * 1024 // 20 MB
	PresignExpiry        = 15 * time.Minute
)

var (
	ErrDocSizeExceeded = errors.New("document size exceeds maximum allowed size")
	ErrDocNotFound     = errors.New("document not found")
	ErrDocUploadFailed = errors.New("document upload failed")
	ErrDocExists       = errors.New("this document already exists")
	ErrDocInvalidation = errors.New("document validation failed")
)

type DocumentStore interface {
	CreateDocument(ctx context.Context, arg store.CreateDocumentParams) (store.Document, error)
	DeleteDocument(ctx context.Context, arg store.DeleteDocumentParams) (int64, error)
	GetBook(ctx context.Context, id int64) (store.Book, error)
	GetDocument(ctx context.Context, id int64) (store.Document, error)
	GetDocumentByObjectKey(ctx context.Context, objectKey string) (store.Document, error)
	InsertOrUpdateDocument(ctx context.Context, arg store.InsertOrUpdateDocumentParams) (store.Document, error)
	ListDocumentsByBook(ctx context.Context, arg store.ListDocumentsByBookParams) ([]store.Document, error)
	UpdateDocumentStatus(ctx context.Context, arg store.UpdateDocumentStatusParams) (store.Document, error)
	UpdateFullDocument(ctx context.Context, arg store.UpdateFullDocumentParams) (store.Document, error)
	CountDocumentsByBook(ctx context.Context, bookID *int64) (int64, error)
}

type s3Client struct {
	*s3.Client
}

func newS3Client() (*s3Client, error) {
	accID := os.Getenv("CLOUDFLARE_R2_ACCOUNT_ID")
	accessKeySecret := os.Getenv("CLOUDFLARE_R2_ACCESS_KEY_SECRET")
	accessKeyID := os.Getenv("CLOUDFLARE_R2_ACCESS_KEY_ID")

	creds := credentials.NewStaticCredentialsProvider(accessKeyID, accessKeySecret, "")
	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion("auto"),
		config.WithCredentialsProvider(creds),
	)
	if err != nil {
		return nil, err
	}
	client := s3.NewFromConfig(cfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(fmt.Sprintf("https://%s.r2.cloudflarestorage.com", accID))
	})
	return &s3Client{client}, nil
}

type DocumentService struct {
	s3Client *s3Client
	docs     DocumentStore
}

func NewDocumentService(store DocumentStore) (service *DocumentService, err error) {
	var s3c *s3Client
	if s3c, err = newS3Client(); err != nil {
		service = nil
		return
	}
	service = &DocumentService{
		s3Client: s3c,
		docs:     store,
	}
	return
}

func (s *DocumentService) getOwnedBook(ctx context.Context, userID string, bookID int64) (store.Book, bool, error) {
	book, err := s.docs.GetBook(ctx, bookID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return store.Book{}, false, nil
		}
		return store.Book{}, false, err
	}
	if book.UserID != userID {
		return store.Book{}, true, ErrForbidden
	}
	return book, true, nil
}

func (s *DocumentService) ListByBook(ctx context.Context, userID string, bookID int64, offset, limit int32) (*api.DocumentList, error) {
	records, err := s.docs.ListDocumentsByBook(ctx, store.ListDocumentsByBookParams{
		BookID: &bookID,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		return nil, err
	}

	if userID != "" {
		var filtered []store.Document
		book, found, err := s.getOwnedBook(ctx, userID, bookID)
		if err != nil {
			return nil, err
		}
		for _, r := range records {
			if (!found || book.UserID != userID) && r.Status == "uploaded" {
				filtered = append(filtered, r)
			}
		}
		records = filtered
	}

	var docs []api.Document
	for _, r := range records {
		docs = append(docs, documentToAPI(r))
	}

	count, err := s.docs.CountDocumentsByBook(ctx, &bookID)
	if err != nil {
		return nil, err
	}

	return &api.DocumentList{
		Items: docs,
		Total: count,
	}, nil
}

func generateObjectKey(bookID int64, checksumHex string) string {
	return fmt.Sprintf("book-%d/%s", bookID, checksumHex)
}

func checksumHexToBase64(checksumHex string) (string, error) {
	if strings.ToLower(checksumHex) != checksumHex {
		return "", fmt.Errorf("checksumSha256Hex must be lowercase hex")
	}
	if len(checksumHex) != 64 {
		return "", fmt.Errorf("checksumSha256Hex must be 64 hex chars")
	}
	checksumBytes, err := hex.DecodeString(checksumHex)
	if err != nil {
		return "", fmt.Errorf("checksumSha256Hex must be valid hex")
	}
	return base64.StdEncoding.EncodeToString(checksumBytes), nil
}

func (s *DocumentService) PresignUpload(ctx context.Context, userID string, bookID, sizeBytes int64, checksumHex string, contentType string, filename string) (*api.DocumentPresignResponse, error) {
	_, found, err := s.getOwnedBook(ctx, userID, bookID)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, nil
	}

	if sizeBytes > MaxDocumentSizeBytes {
		return nil, ErrDocSizeExceeded
	}

	checksumB64, err := checksumHexToBase64(checksumHex)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", ErrDocInvalidation, err)
	}

	objectKey := generateObjectKey(bookID, checksumHex)
	doc, err := s.docs.GetDocumentByObjectKey(ctx, objectKey)
	if err == nil && doc.Status == "uploaded" {
		return nil, ErrDocExists
	}

	bucketName := "bookshelf-cg"
	expiresAt := time.Now().Add(PresignExpiry)
	presignClient := s3.NewPresignClient(s.s3Client.Client, s3.WithPresignExpires(PresignExpiry))

	req, err := presignClient.PresignPutObject(ctx,
		&s3.PutObjectInput{
			Bucket:         aws.String(bucketName),
			Key:            aws.String(objectKey),
			ChecksumSHA256: aws.String(checksumB64),
			ContentType:    aws.String(contentType),
		},
	)
	if err != nil {
		return nil, err
	}

	docRecord, err := s.docs.InsertOrUpdateDocument(ctx, store.InsertOrUpdateDocumentParams{
		BookID:      &bookID,
		UserID:      userID,
		Filename:    filename,
		ObjectKey:   objectKey,
		ContentType: contentType,
		Checksum:    checksumHex,
		SizeBytes:   sizeBytes,
		Status:      "pending",
	})
	if err != nil {
		return nil, err
	}

	return &api.DocumentPresignResponse{
		Document:     documentToAPI(docRecord),
		UploadUrl:    req.URL,
		UploadMethod: api.DocumentPresignResponseUploadMethod(req.Method),
		ExpiresAt:    expiresAt,
	}, nil
}

func (s *DocumentService) CompleteUpload(ctx context.Context, userID string, bookID, documentID int64) (*api.Document, error) {
	_, found, err := s.getOwnedBook(ctx, userID, bookID)
	if err != nil {
		return nil, err
	}
	if !found {
		return nil, nil
	}

	docRecord, err := s.docs.GetDocument(ctx, documentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if docRecord.BookID == nil || *docRecord.BookID != bookID {
		return nil, nil
	}

	s3Obj, err := s.s3Client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String("bookshelf-cg"),
		Key:    aws.String(docRecord.ObjectKey),
	})
	if err != nil {
		return nil, err
	}

	status := "uploaded"
	var checkErr error
	if *s3Obj.ContentLength != int64(docRecord.SizeBytes) || *s3Obj.ContentLength > MaxDocumentSizeBytes || (s3Obj.ContentType != nil && *s3Obj.ContentType != docRecord.ContentType) {
		s.s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
			Bucket: aws.String("bookshelf-cg"),
			Key:    aws.String(docRecord.ObjectKey),
		})
		status = "failed"
		checkErr = ErrDocInvalidation
	}

	updatedRecord, err := s.docs.UpdateDocumentStatus(ctx, store.UpdateDocumentStatusParams{
		ID:     documentID,
		UserID: userID,
		Status: status,
	})
	if err != nil {
		return nil, err
	}
	if checkErr != nil {
		return nil, checkErr
	}
	return documentToAPIPtr(updatedRecord), nil
}

func (s *DocumentService) GetDocMeta(ctx context.Context, bookID, documentID int64) (*api.Document, error) {
	docRecord, err := s.docs.GetDocument(ctx, documentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if docRecord.BookID == nil || *docRecord.BookID != bookID {
		return nil, fmt.Errorf("document %d does not belong to book %d", documentID, bookID)
	}
	return documentToAPIPtr(docRecord), nil
	return documentToAPIPtr(docRecord), nil
}

func (s *DocumentService) DeleteByID(ctx context.Context, userID string, bookID, documentID int64) error {
	_, found, err := s.getOwnedBook(ctx, userID, bookID)
	if err != nil {
		return err
	}
	if !found {
		return ErrDocNotFound
	}

	docRecord, err := s.docs.GetDocument(ctx, documentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrDocNotFound
		}
		return err
	}

	if docRecord.BookID == nil || *docRecord.BookID != bookID {
		return ErrDocNotFound
	}

	_, err = s.s3Client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String("bookshelf-cg"),
		Key:    aws.String(docRecord.ObjectKey),
	})
	if err != nil {
		return err
	}

	_, err = s.docs.DeleteDocument(ctx, store.DeleteDocumentParams{
		ID:     documentID,
		BookID: &bookID,
		UserID: userID,
	})
	if err != nil {
		return err
	}

	return nil
}

func (s *DocumentService) Download(ctx context.Context, bookID, documentID int64) (string, error) {
	docRecord, err := s.docs.GetDocument(ctx, documentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrDocNotFound
		}
		return "", err
	}

	if docRecord.BookID == nil || *docRecord.BookID != bookID {
		return "", fmt.Errorf("document %d does not belong to book %d", documentID, bookID)
	}

	presignClient := s3.NewPresignClient(s.s3Client.Client, s3.WithPresignExpires(15*time.Minute))
	req, err := presignClient.PresignGetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String("bookshelf-cg"),
		Key:    aws.String(docRecord.ObjectKey),
	})

	if err != nil {
		return "", err
	}

	return req.URL, nil
}

func documentToAPIPtr(record store.Document) *api.Document {
	checksum := record.Checksum
	return &api.Document{
		Id:                record.ID,
		BookID:            *record.BookID,
		Filename:          record.Filename,
		ObjectKey:         &record.ObjectKey,
		SizeBytes:         int64(record.SizeBytes),
		ChecksumSha256Hex: &checksum,
		ContentType:       api.ContentType(record.ContentType),
		Status:            api.UploadStatus(record.Status),
		CreatedAt:         record.CreatedAt.Time,
		UpdatedAt:         record.UpdatedAt.Time,
	}
}

func documentToAPI(record store.Document) api.Document {
	checksum := record.Checksum
	return api.Document{
		Id:                record.ID,
		BookID:            *record.BookID,
		Filename:          record.Filename,
		ObjectKey:         &record.ObjectKey,
		SizeBytes:         int64(record.SizeBytes),
		ChecksumSha256Hex: &checksum,
		ContentType:       api.ContentType(record.ContentType),
		Status:            api.UploadStatus(record.Status),
		CreatedAt:         record.CreatedAt.Time,
		UpdatedAt:         record.UpdatedAt.Time,
	}
}
