package handlers

import (
	"context"
	"errors"

	"github.com/andyp1xe1/bookshelf/internal/api"
	"github.com/andyp1xe1/bookshelf/internal/auth"
	"github.com/andyp1xe1/bookshelf/internal/services"
)

var NotFoundProblem = api.Problem{
	Title: "Not found",
}

var UnauthorizedProblem = api.Problem{
	Title: "Unauthorized",
}
var ForbiddenProblem = api.Problem{
	Title: "Forbidden",
}

type DocumentService interface {
	PresignUpload(ctx context.Context, userID string, bookID, sizeBytes int64, checksum, contentType, filename string) (*api.DocumentPresignResponse, error)
	CompleteUpload(ctx context.Context, userID string, bookID, documentID int64) (*api.Document, error)
	DeleteByID(ctx context.Context, userID string, bookID, documentID int64) error

	ListByBook(ctx context.Context, bookID int64, offset, limit int32) (*api.DocumentList, error)
	GetDocMeta(ctx context.Context, bookID, documentID int64) (*api.Document, error)
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
	authData, ok := auth.GetAuthData(ctx)
	if !ok {
		return api.CreateBookDocumentPresign401JSONResponse(UnauthorizedProblem), nil
	}
	ctx = context.WithValue(ctx, "userID", authData.ID)

	id := request.BookID
	size := request.Body.SizeBytes
	checksumHex := request.Body.ChecksumSha256Hex
	contentType := string(request.Body.ContentType)
	filename := request.Body.Filename

	presignResp, err := h.service.PresignUpload(ctx, authData.ID, id, size, checksumHex, contentType, filename)
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
	authData, ok := auth.GetAuthData(ctx)
	if !ok {
		return api.DeleteBookDocumentByID401JSONResponse(UnauthorizedProblem), nil
	}
	err := h.service.DeleteByID(ctx, authData.ID, request.BookID, request.DocumentID)
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
	authData, ok := auth.GetAuthData(ctx)
	if !ok {
		return api.CompleteBookDocumentUpload401JSONResponse(UnauthorizedProblem), nil
	}
	doc, err := h.service.CompleteUpload(ctx, authData.ID, request.BookID, request.DocumentID)
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
