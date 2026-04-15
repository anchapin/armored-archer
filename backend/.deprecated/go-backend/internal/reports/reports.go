// Package reports provides player reporting functionality for the Armored Archer backend.
package reports

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// ReportType represents the type of report.
type ReportType string

const (
	ReportTypeCheating  ReportType = "cheating"
	ReportTypeToxicity  ReportType = "toxicity"
	ReportTypeAFK       ReportType = "afk"
	ReportTypeOther     ReportType = "other"
)

// ReportStatus represents the status of a report.
type ReportStatus string

const (
	ReportStatusPending   ReportStatus = "pending"
	ReportStatusReviewed  ReportStatus = "reviewed"
	ReportStatusActioned  ReportStatus = "actioned"
	ReportStatusDismissed ReportStatus = "dismissed"
)

// PlayerReport represents a player report.
type PlayerReport struct {
	ID           string     `json:"id"`
	ReporterID   string     `json:"reporter_id"`
	ReportedID   string     `json:"reported_id"`
	ReportType   ReportType `json:"report_type"`
	Reason       string     `json:"reason"`
	MatchID      string     `json:"match_id,omitempty"`
	Timestamp    int64      `json:"timestamp"`
	Status       ReportStatus `json:"status"`
	ReviewedBy   string     `json:"reviewed_by,omitempty"`
	ReviewNotes  string     `json:"review_notes,omitempty"`
}

// SubmitReportRequest represents a request to submit a player report.
type SubmitReportRequest struct {
	ReportedID string     `json:"reported_id"`
	ReportType ReportType `json:"report_type"`
	Reason     string     `json:"reason"`
	MatchID    string     `json:"match_id,omitempty"`
}

// Validate validates a submit report request.
func (r *SubmitReportRequest) Validate() error {
	if r.ReportedID == "" {
		return errors.New("reported_id is required")
	}

	if r.ReportType == "" {
		return errors.New("report_type is required")
	}

	switch r.ReportType {
	case ReportTypeCheating, ReportTypeToxicity, ReportTypeAFK, ReportTypeOther:
		// Valid
	default:
		return errors.New("invalid report_type: must be cheating, toxicity, afk, or other")
	}

	if r.Reason == "" {
		return errors.New("reason is required")
	}

	if len(r.Reason) < 10 {
		return errors.New("reason must be at least 10 characters")
	}

	if len(r.Reason) > 1000 {
		return errors.New("reason must be less than 1000 characters")
	}

	return nil
}

// NewReport creates a new player report.
func NewReport(reporterID string, request *SubmitReportRequest) (*PlayerReport, error) {
	if err := request.Validate(); err != nil {
		return nil, err
	}

	if reporterID == request.ReportedID {
		return nil, errors.New("cannot report yourself")
	}

	return &PlayerReport{
		ID:         generateReportID(),
		ReporterID: reporterID,
		ReportedID: request.ReportedID,
		ReportType: request.ReportType,
		Reason:     request.Reason,
		MatchID:    request.MatchID,
		Timestamp:  time.Now().UnixMilli(),
		Status:     ReportStatusPending,
	}, nil
}

// ToJSON converts a report to JSON string.
func (r *PlayerReport) ToJSON() (string, error) {
	jsonBytes, err := json.Marshal(r)
	if err != nil {
		return "", fmt.Errorf("failed to marshal report: %w", err)
	}
	return string(jsonBytes), nil
}

// FromJSON creates a report from JSON.
func FromJSON(jsonStr string) (*PlayerReport, error) {
	var report PlayerReport
	if err := json.Unmarshal([]byte(jsonStr), &report); err != nil {
		return nil, fmt.Errorf("failed to parse report JSON: %w", err)
	}
	return &report, nil
}

// UpdateStatus updates the report status.
func (r *PlayerReport) UpdateStatus(status ReportStatus, reviewedBy, notes string) {
	r.Status = status
	r.ReviewedBy = reviewedBy
	r.ReviewNotes = notes
}

// IsPending returns true if the report is pending review.
func (r *PlayerReport) IsPending() bool {
	return r.Status == ReportStatusPending
}

// ToMap converts a report to a map.
func (r *PlayerReport) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"id":             r.ID,
		"reporter_id":    r.ReporterID,
		"reported_id":    r.ReportedID,
		"report_type":    r.ReportType,
		"reason":         r.Reason,
		"match_id":       r.MatchID,
		"timestamp":      r.Timestamp,
		"status":         r.Status,
		"reviewed_by":    r.ReviewedBy,
		"review_notes":   r.ReviewNotes,
	}
}

func generateReportID() string {
	return fmt.Sprintf("rpt_%d", time.Now().UnixNano())
}

// ReportsToJSON converts a slice of reports to JSON.
func ReportsToJSON(reports []*PlayerReport) (string, error) {
	jsonBytes, err := json.Marshal(reports)
	if err != nil {
		return "", fmt.Errorf("failed to marshal reports: %w", err)
	}
	return string(jsonBytes), nil
}

// FilterReportsByStatus filters reports by status.
func FilterReportsByStatus(reports []*PlayerReport, status ReportStatus) []*PlayerReport {
	filtered := make([]*PlayerReport, 0)
	for _, r := range reports {
		if r.Status == status {
			filtered = append(filtered, r)
		}
	}
	return filtered
}

// GetReportCountByStatus returns the count of reports with a specific status.
func GetReportCountByStatus(reports []*PlayerReport, status ReportStatus) int {
	count := 0
	for _, r := range reports {
		if r.Status == status {
			count++
		}
	}
	return count
}
