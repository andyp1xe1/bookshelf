package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type OpenLibraryService struct {
	client  *http.Client
	baseURL string
}

type OpenLibraryISBNResponse struct {
	Title       string              `json:"title"`
	Authors     []OpenLibraryAuthor `json:"authors,omitempty"` // Often not present in ISBN endpoint
	Works       []OpenLibraryWork   `json:"works,omitempty"`
	PublishDate string              `json:"publish_date"`
	Publishers  []string            `json:"publishers"`
	Subjects    []string            `json:"subjects,omitempty"`
	Covers      []int64             `json:"covers"` // Array of cover IDs
}

type OpenLibraryAuthor struct {
	Key  string `json:"key"`
	Name string `json:"name,omitempty"`
}

type OpenLibraryWork struct {
	Key string `json:"key"`
}

type OpenLibraryWorkResponse struct {
	Title   string `json:"title"`
	Authors []struct {
		Author struct {
			Key string `json:"key"`
		} `json:"author"`
		Type struct {
			Key string `json:"key"`
		} `json:"type"`
	} `json:"authors"`
	Subjects []string `json:"subjects"`
}

type OpenLibraryAuthorResponse struct {
	Name string `json:"name"`
}

type BookMetadata struct {
	Title         string
	Author        string
	PublishedYear string
	Genre         string
	CoverURL      string
}

func NewOpenLibraryService() *OpenLibraryService {
	return &OpenLibraryService{
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		baseURL: "https://openlibrary.org",
	}
}

// LookupISBN fetches book metadata from OpenLibrary by ISBN with retry logic
func (s *OpenLibraryService) LookupISBN(ctx context.Context, isbn string) (*BookMetadata, error) {
	const maxRetries = 3
	const retryDelay = time.Second

	var lastErr error
	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(retryDelay * time.Duration(attempt)):
			}
		}

		metadata, err := s.lookupISBNOnce(ctx, isbn)
		if err == nil {
			return metadata, nil
		}
		lastErr = err
	}

	return nil, fmt.Errorf("failed to lookup ISBN after %d attempts: %w", maxRetries, lastErr)
}

func (s *OpenLibraryService) lookupISBNOnce(ctx context.Context, isbn string) (*BookMetadata, error) {
	// Clean ISBN (remove dashes/spaces)
	cleanISBN := strings.ReplaceAll(strings.ReplaceAll(isbn, "-", ""), " ", "")

	url := fmt.Sprintf("%s/isbn/%s.json", s.baseURL, cleanISBN)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from OpenLibrary: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("ISBN not found in OpenLibrary")
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var data OpenLibraryISBNResponse
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	metadata := &BookMetadata{
		Title: data.Title,
	}

	// Extract author (first one) - try direct authors first
	if len(data.Authors) > 0 && data.Authors[0].Name != "" {
		metadata.Author = data.Authors[0].Name
	} else if len(data.Works) > 0 {
		// If no direct author, try to fetch from works endpoint
		if author, err := s.fetchAuthorFromWork(ctx, data.Works[0].Key); err == nil {
			metadata.Author = author
		}
	}

	// Parse year from publish_date
	if data.PublishDate != "" {
		metadata.PublishedYear = parseYear(data.PublishDate)
	}

	// Extract genre (first subject) - if not in ISBN response, try works
	if len(data.Subjects) > 0 {
		metadata.Genre = data.Subjects[0]
	} else if len(data.Works) > 0 {
		if subjects, err := s.fetchSubjectsFromWork(ctx, data.Works[0].Key); err == nil && len(subjects) > 0 {
			metadata.Genre = subjects[0]
		}
	}

	// Get cover URL - use cover ID if available, otherwise try ISBN
	if len(data.Covers) > 0 && data.Covers[0] > 0 {
		metadata.CoverURL = fmt.Sprintf("https://covers.openlibrary.org/b/id/%d-L.jpg", data.Covers[0])
	} else {
		// Fallback to ISBN-based URL
		metadata.CoverURL = fmt.Sprintf("https://covers.openlibrary.org/b/isbn/%s-L.jpg", cleanISBN)
	}

	return metadata, nil
}

// fetchAuthorFromWork fetches author name from a work endpoint
func (s *OpenLibraryService) fetchAuthorFromWork(ctx context.Context, workKey string) (string, error) {
	url := fmt.Sprintf("%s%s.json", s.baseURL, workKey)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var work OpenLibraryWorkResponse
	if err := json.Unmarshal(body, &work); err != nil {
		return "", err
	}

	if len(work.Authors) > 0 {
		// Fetch author name from author endpoint
		authorKey := work.Authors[0].Author.Key
		return s.fetchAuthorName(ctx, authorKey)
	}

	return "", fmt.Errorf("no authors found")
}

// fetchAuthorName fetches author name from author endpoint
func (s *OpenLibraryService) fetchAuthorName(ctx context.Context, authorKey string) (string, error) {
	url := fmt.Sprintf("%s%s.json", s.baseURL, authorKey)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var author OpenLibraryAuthorResponse
	if err := json.Unmarshal(body, &author); err != nil {
		return "", err
	}

	return author.Name, nil
}

// fetchSubjectsFromWork fetches subjects from a work endpoint
func (s *OpenLibraryService) fetchSubjectsFromWork(ctx context.Context, workKey string) ([]string, error) {
	url := fmt.Sprintf("%s%s.json", s.baseURL, workKey)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var work OpenLibraryWorkResponse
	if err := json.Unmarshal(body, &work); err != nil {
		return nil, err
	}

	return work.Subjects, nil
}

// parseYear extracts the year from various date formats
func parseYear(dateStr string) string {
	// Try common formats
	formats := []string{
		"2006",            // Just year
		"January 2, 2006", // Full date
		"Jan 2, 2006",
		"2006-01-02",
	}

	for _, format := range formats {
		if t, err := time.Parse(format, dateStr); err == nil {
			return fmt.Sprintf("%d", t.Year())
		}
	}

	// Fallback: extract first 4 digits
	for i := 0; i <= len(dateStr)-4; i++ {
		if year := dateStr[i : i+4]; isNumeric(year) {
			return year
		}
	}

	return ""
}

func isNumeric(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return len(s) > 0
}

// DownloadCover downloads the cover image from OpenLibrary
func (s *OpenLibraryService) DownloadCover(ctx context.Context, coverURL string) ([]byte, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, coverURL, nil)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create request: %w", err)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("failed to download cover: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("failed to read cover data: %w", err)
	}

	// Get content type from response header
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "image/jpeg" // Default for OpenLibrary covers
	}

	return data, contentType, nil
}
