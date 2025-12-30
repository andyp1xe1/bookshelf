package handlers

import (
	"context"
	"errors"

	"github.com/andyp1xe1/bookshelf/internal/api"
	"github.com/andyp1xe1/bookshelf/internal/services"
)

var NotFoundProblem = api.Problem{
	Title: "Not found",
}

type DocumentService interface {
	ListByBook(ctx context.Context, bookID int64, offset, limit int32) (*api.DocumentList, error)
	PresignUpload(ctx context.Context, bookID, sizeBytes int64, checksum, contentType, filename string) (*api.DocumentPresignResponse, error)
	CompleteUpload(ctx context.Context, bookID, documentID int64) (*api.Document, error)
	GetDocMeta(ctx context.Context, bookID, documentID int64) (*api.Document, error)
	DeleteByID(ctx context.Context, bookID, documentID int64) error
	Download(ctx context.Context, bookID, documentID int64) (string, error)
}

type DocumentHandler struct {
	service DocumentService
}

func NewDocumentHandler(service DocumentService) *DocumentHandler {
	return &DocumentHandler{service: service}
}

func (h *DocumentHandler) ListBookDocuments(ctx context.Context, request api.ListBookDocumentsRequestObject) (api.ListBookDocumentsResponseObject, error) {
	limit, offset := normalizeLimitOffset(request.Params.Limit, request.Params.Offset)
	id := request.BookID
	docs, err := h.service.ListByBook(ctx, id, offset, limit)
	if err != nil {
		return nil, err
	}
	if docs == nil {
		return api.ListBookDocuments404JSONResponse(NotFoundProblem), nil
	}
	return api.ListBookDocuments200JSONResponse(*docs), nil
}

func (h *DocumentHandler) CreateBookDocumentPresign(ctx context.Context, request api.CreateBookDocumentPresignRequestObject) (api.CreateBookDocumentPresignResponseObject, error) {
	if request.Body == nil {
		detail := "body is required"
		return api.CreateBookDocumentPresign422JSONResponse{
			Title:  "Validation error",
			Detail: &detail,
		}, nil
	}

	id := request.BookID
	filename := request.Body.Filename
	size := request.Body.SizeBytes
	checksumHex := request.Body.ChecksumSha256Hex
	contentType := string(request.Body.ContentType)

	presignResp, err := h.service.PresignUpload(ctx, id, size, checksumHex, contentType, filename)
	if err != nil {
		detail := err.Error()
		return api.CreateBookDocumentPresign422JSONResponse{
			Title:  "Validation error",
			Detail: &detail,
		}, nil
	}
	if presignResp == nil {
		return api.CreateBookDocumentPresign404JSONResponse(NotFoundProblem), nil
	}
	return api.CreateBookDocumentPresign201JSONResponse(*presignResp), nil
}

func (h *DocumentHandler) DeleteBookDocumentByID(ctx context.Context, request api.DeleteBookDocumentByIDRequestObject) (api.DeleteBookDocumentByIDResponseObject, error) {
	err := h.service.DeleteByID(ctx, request.BookID, request.DocumentID)
	if err != nil {
		return nil, err
	}
	return api.DeleteBookDocumentByID204Response{}, nil
}

func (h *DocumentHandler) GetBookDocumentByID(ctx context.Context, request api.GetBookDocumentByIDRequestObject) (api.GetBookDocumentByIDResponseObject, error) {
	bookID := request.BookID
	docID := request.DocumentID

	doc, err := h.service.GetDocMeta(ctx, bookID, docID)

	if err != nil {
		return nil, err
	}
	if doc == nil {
		return api.GetBookDocumentByID404JSONResponse(NotFoundProblem), nil
	}

	return api.GetBookDocumentByID200JSONResponse(*doc), nil
}

func (h *DocumentHandler) CompleteBookDocumentUpload(ctx context.Context, request api.CompleteBookDocumentUploadRequestObject) (api.CompleteBookDocumentUploadResponseObject, error) {
	doc, err := h.service.CompleteUpload(ctx, request.BookID, request.DocumentID)
	if err != nil {
		detail := err.Error()
		return api.CompleteBookDocumentUpload422JSONResponse{
			Title:  "Validation error",
			Detail: &detail,
		}, nil
	}
	if errors.Is(err, services.ErrDocInvalidation) {
		detail := err.Error()
		return api.CompleteBookDocumentUpload422JSONResponse{
			Title:  "Validation error",
			Detail: &detail,
		}, nil
	}
	if doc == nil {
		return api.CompleteBookDocumentUpload404JSONResponse(NotFoundProblem), nil
	}
	return api.CompleteBookDocumentUpload200JSONResponse(*doc), nil
}

func (h *DocumentHandler) DownloadBookDocument(ctx context.Context, request api.DownloadBookDocumentRequestObject) (api.DownloadBookDocumentResponseObject, error) {
	bookID := request.BookID
	docID := request.DocumentID

	url, err := h.service.Download(ctx, bookID, docID)
	if err != nil {
		return nil, err
	}
	return api.DownloadBookDocument302Response{
		Headers: api.DownloadBookDocument302ResponseHeaders{
			Location: url,
		},
	}, nil
}
