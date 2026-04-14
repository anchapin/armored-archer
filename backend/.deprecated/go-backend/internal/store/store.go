// Package store provides in-app purchase and currency management for the Armored Archer backend.
package store

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

// Currency types
const (
	CurrencyCoins = "coins"
	CurrencyGems  = "gems"
)

// Platform constants
const (
	PlatformAndroid = "android"
	PlatformIOS     = "ios"
)

// Maximum gem balance to prevent overflow exploits
const MaxGemBalance = 10000000 // 10 million gems

// Maximum single purchase amount to prevent large exploits
const MaxPurchaseAmount = 10000 // 10k gems per transaction

// Valid platforms for IAP purchases
var ValidPlatforms = []string{"ios", "android"}

// RefundReason represents the reason for a refund.
type RefundReason string

const (
	RefundReasonCustomerSupport RefundReason = "customer_support"
	RefundReasonChargeback      RefundReason = "chargeback"
	RefundReasonDuplicate       RefundReason = "duplicate"
	RefundReasonFraud           RefundReason = "fraud"
	RefundReasonOther           RefundReason = "other"
)

// PurchaseReceipt represents an IAP receipt.
type PurchaseReceipt struct {
	TransactionID string `json:"transaction_id"`
	ProductID     string `json:"product_id"`
	Platform      string `json:"platform"`
	PurchaseDate  int64  `json:"purchase_date"`
	Amount        int    `json:"amount"`
	Currency      string `json:"currency"`
	UserID        string `json:"user_id"`
	Signature     string `json:"signature"`
}

// ValidatePurchaseRequest represents a request to validate a purchase.
type ValidatePurchaseRequest struct {
	TransactionID string `json:"transaction_id"`
	ProductID     string `json:"product_id"`
	Platform      string `json:"platform"`
	Receipt       string `json:"receipt"`
	Signature     string `json:"signature"`
}

// SpendGemsRequest represents a request to spend gems.
type SpendGemsRequest struct {
	Amount    int    `json:"amount"`
	Purpose   string `json:"purpose"`
	ProductID string `json:"product_id,omitempty"`
}

// RefundRequest represents a refund request.
type RefundRequest struct {
	TransactionID string       `json:"transaction_id"`
	Reason        RefundReason `json:"reason"`
	Notes         string       `json:"notes,omitempty"`
}

// CurrencyBalance represents a player's currency balance.
type CurrencyBalance struct {
	UserID  string `json:"user_id"`
	Coins   int    `json:"coins"`
	Gems    int    `json:"gems"`
	Updated int64  `json:"updated"`
}

// PurchaseResult represents the result of a purchase validation.
type PurchaseResult struct {
	Success      bool   `json:"success"`
	TransactionID string `json:"transaction_id"`
	Amount       int    `json:"amount"`
	Currency     string `json:"currency"`
	AlreadyClaimed bool `json:"already_claimed,omitempty"`
}

// SpendResult represents the result of spending currency.
type SpendResult struct {
	Success       bool `json:"success"`
	PreviousBalance int `json:"previous_balance"`
	NewBalance    int `json:"new_balance"`
	AmountSpent   int `json:"amount_spent"`
}

// RefundResult represents the result of a refund.
type RefundResult struct {
	Success       bool   `json:"success"`
	TransactionID string `json:"transaction_id"`
	RefundedAmount int   `json:"refunded_amount"`
	Reason        string `json:"reason"`
}

// SubscriptionStatus represents a player's subscription status.
type SubscriptionStatus struct {
	UserID           string `json:"user_id"`
	IsActive         bool   `json:"is_active"`
	SubscriptionType string `json:"subscription_type,omitempty"`
	ExpiresAt        int64  `json:"expires_at,omitempty"`
	AutoRenew        bool   `json:"auto_renew"`
}

// NewCurrencyBalance creates a new currency balance.
func NewCurrencyBalance(userID string) *CurrencyBalance {
	return &CurrencyBalance{
		UserID:  userID,
		Coins:   0,
		Gems:    0,
		Updated: time.Now().UnixMilli(),
	}
}

// AddCurrency adds currency to the balance.
func (c *CurrencyBalance) AddCurrency(currencyType string, amount int) error {
	if amount <= 0 {
		return errors.New("amount must be positive")
	}

	switch currencyType {
	case CurrencyGems:
		// Check max balance
		if c.Gems+amount > MaxGemBalance {
			return fmt.Errorf("would exceed maximum gem balance of %d", MaxGemBalance)
		}
		c.Gems += amount
	case CurrencyCoins:
		c.Coins += amount
	default:
		return fmt.Errorf("unknown currency type: %s", currencyType)
	}

	c.Updated = time.Now().UnixMilli()
	return nil
}

// SpendCurrency spends currency from the balance.
func (c *CurrencyBalance) SpendCurrency(currencyType string, amount int) error {
	if amount <= 0 {
		return errors.New("amount must be positive")
	}

	switch currencyType {
	case CurrencyGems:
		if c.Gems < amount {
			return fmt.Errorf("insufficient gems: have %d, need %d", c.Gems, amount)
		}
		c.Gems -= amount
	case CurrencyCoins:
		if c.Coins < amount {
			return fmt.Errorf("insufficient coins: have %d, need %d", c.Coins, amount)
		}
		c.Coins -= amount
	default:
		return fmt.Errorf("unknown currency type: %s", currencyType)
	}

	c.Updated = time.Now().UnixMilli()
	return nil
}

// GetBalance returns the balance for a currency type.
func (c *CurrencyBalance) GetBalance(currencyType string) (int, error) {
	switch currencyType {
	case CurrencyGems:
		return c.Gems, nil
	case CurrencyCoins:
		return c.Coins, nil
	default:
		return 0, fmt.Errorf("unknown currency type: %s", currencyType)
	}
}

// Validate validates a purchase request.
func (r *ValidatePurchaseRequest) Validate() error {
	if r.TransactionID == "" {
		return errors.New("transaction_id is required")
	}
	if r.ProductID == "" {
		return errors.New("product_id is required")
	}
	if r.Platform == "" {
		return errors.New("platform is required")
	}
	
	// Validate platform
	valid := false
	for _, p := range ValidPlatforms {
		if p == r.Platform {
			valid = true
			break
		}
	}
	if !valid {
		return fmt.Errorf("invalid platform: %s (must be one of: %v)", r.Platform, ValidPlatforms)
	}
	
	if r.Receipt == "" {
		return errors.New("receipt is required")
	}
	
	return nil
}

// Validate validates a spend gems request.
func (r *SpendGemsRequest) Validate() error {
	if r.Amount <= 0 {
		return errors.New("amount must be positive")
	}
	if r.Amount > MaxPurchaseAmount {
		return fmt.Errorf("amount exceeds maximum purchase of %d", MaxPurchaseAmount)
	}
	if r.Purpose == "" {
		return errors.New("purpose is required")
	}
	return nil
}

// Validate validates a refund request.
func (r *RefundRequest) Validate() error {
	if r.TransactionID == "" {
		return errors.New("transaction_id is required")
	}
	return nil
}

// HashReceipt generates a cryptographic hash for a receipt.
func HashReceipt(receipt string) string {
	salt := "armored_archer_secure_iap_salt_2024"
	h := sha256.New()
	h.Write([]byte(receipt + salt))
	return hex.EncodeToString(h.Sum(nil))
}

// ValidateReceiptSignature validates a receipt signature.
func ValidateReceiptSignature(receipt, signature, publicKey string) error {
	// In production, this would verify the cryptographic signature
	// For now, just check that signature is non-empty
	if signature == "" {
		return errors.New("signature is required")
	}
	return nil
}

// GetRefundReason maps a string to a RefundReason.
func GetRefundReason(reason string) RefundReason {
	switch reason {
	case "customer_support":
		return RefundReasonCustomerSupport
	case "chargeback":
		return RefundReasonChargeback
	case "duplicate":
		return RefundReasonDuplicate
	case "fraud":
		return RefundReasonFraud
	default:
		return RefundReasonOther
	}
}

// ToJSON converts a currency balance to JSON string.
func (c *CurrencyBalance) ToJSON() (string, error) {
	jsonBytes, err := json.Marshal(c)
	if err != nil {
		return "", fmt.Errorf("failed to marshal currency balance: %w", err)
	}
	return string(jsonBytes), nil
}

// FromJSON creates a currency balance from JSON.
func CurrencyBalanceFromJSON(jsonStr string) (*CurrencyBalance, error) {
	var balance CurrencyBalance
	if err := json.Unmarshal([]byte(jsonStr), &balance); err != nil {
		return nil, fmt.Errorf("failed to parse currency balance JSON: %w", err)
	}
	return &balance, nil
}

// PurchaseResultToJSON converts a purchase result to JSON.
func PurchaseResultToJSON(result *PurchaseResult) (string, error) {
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to marshal purchase result: %w", err)
	}
	return string(jsonBytes), nil
}

// SpendResultToJSON converts a spend result to JSON.
func SpendResultToJSON(result *SpendResult) (string, error) {
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to marshal spend result: %w", err)
	}
	return string(jsonBytes), nil
}

// RefundResultToJSON converts a refund result to JSON.
func RefundResultToJSON(result *RefundResult) (string, error) {
	jsonBytes, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("failed to marshal refund result: %w", err)
	}
	return string(jsonBytes), nil
}

// SubscriptionStatusToJSON converts a subscription status to JSON.
func SubscriptionStatusToJSON(status *SubscriptionStatus) (string, error) {
	jsonBytes, err := json.Marshal(status)
	if err != nil {
		return "", fmt.Errorf("failed to marshal subscription status: %w", err)
	}
	return string(jsonBytes), nil
}

// CurrencyBalancesToJSON converts a slice of currency balances to JSON.
func CurrencyBalancesToJSON(balances []*CurrencyBalance) (string, error) {
	jsonBytes, err := json.Marshal(balances)
	if err != nil {
		return "", fmt.Errorf("failed to marshal currency balances: %w", err)
	}
	return string(jsonBytes), nil
}

// GetProductAmount returns the amount for a product ID.
func GetProductAmount(productID string) (int, string, error) {
	// Product catalog - in production this would be in a database
	products := map[string]struct {
		Amount   int
		Currency string
	}{
		"gem_pack_small":   {100, CurrencyGems},
		"gem_pack_medium":  {500, CurrencyGems},
		"gem_pack_large":   {1200, CurrencyGems},
		"gem_pack_xl":      {2500, CurrencyGems},
		"coin_pack_small":  {1000, CurrencyCoins},
		"coin_pack_medium": {5000, CurrencyCoins},
		"coin_pack_large":  {12000, CurrencyCoins},
		"starter_pack":     {200, CurrencyGems},
		"monthly_pass":     {50, CurrencyGems},
	}
	
	product, ok := products[productID]
	if !ok {
		return 0, "", fmt.Errorf("unknown product: %s", productID)
	}
	
	return product.Amount, product.Currency, nil
}

// IsValidProduct checks if a product ID is valid.
func IsValidProduct(productID string) bool {
	_, _, err := GetProductAmount(productID)
	return err == nil
}

// GetProductCatalog returns the list of valid product IDs.
func GetProductCatalog() []string {
	return []string{
		"gem_pack_small",
		"gem_pack_medium",
		"gem_pack_large",
		"gem_pack_xl",
		"coin_pack_small",
		"coin_pack_medium",
		"coin_pack_large",
		"starter_pack",
		"monthly_pass",
	}
}

// CanAfford checks if a balance can afford a purchase.
func (c *CurrencyBalance) CanAfford(currencyType string, amount int) bool {
	balance, err := c.GetBalance(currencyType)
	if err != nil {
		return false
	}
	return balance >= amount
}

// Transaction represents a currency transaction.
type Transaction struct {
	ID            string `json:"id"`
	UserID        string `json:"user_id"`
	Type          string `json:"type"` // "purchase", "spend", "refund"
	CurrencyType  string `json:"currency_type"`
	Amount        int    `json:"amount"`
	BalanceBefore int    `json:"balance_before"`
	BalanceAfter  int    `json:"balance_after"`
	Timestamp     int64  `json:"timestamp"`
	Metadata      string `json:"metadata,omitempty"`
}

// NewTransaction creates a new transaction record.
func NewTransaction(userID, txType, currencyType string, amount, balanceBefore, balanceAfter int, metadata string) *Transaction {
	return &Transaction{
		ID:            fmt.Sprintf("tx_%d", time.Now().UnixNano()),
		UserID:        userID,
		Type:          txType,
		CurrencyType:  currencyType,
		Amount:        amount,
		BalanceBefore: balanceBefore,
		BalanceAfter:  balanceAfter,
		Timestamp:     time.Now().UnixMilli(),
		Metadata:      metadata,
	}
}

// TransactionsToJSON converts a slice of transactions to JSON.
func TransactionsToJSON(transactions []*Transaction) (string, error) {
	jsonBytes, err := json.Marshal(transactions)
	if err != nil {
		return "", fmt.Errorf("failed to marshal transactions: %w", err)
	}
	return string(jsonBytes), nil
}

// GetSubscriptionTiers returns available subscription tiers.
func GetSubscriptionTiers() map[string]struct {
	Price    int
	Duration int // days
	Benefits []string
} {
	return map[string]struct {
		Price    int
		Duration int
		Benefits []string
	}{
		"monthly_basic": {
			Price:    499, // cents
			Duration: 30,
			Benefits: []string{"100 gems/month", "5% shop discount"},
		},
		"monthly_premium": {
			Price:    999,
			Duration: 30,
			Benefits: []string{"300 gems/month", "10% shop discount", "Exclusive cosmetics"},
		},
	}
}

// CheckSubscription checks if a user has an active subscription.
func CheckSubscription(userID, subscriptionType string) (*SubscriptionStatus, error) {
	// In production, this would check RevenueCat or similar service
	// For now, return a placeholder
	return &SubscriptionStatus{
		UserID:           userID,
		IsActive:         false,
		SubscriptionType: subscriptionType,
	}, nil
}

// GetActiveSubscription returns the active subscription for a user.
func GetActiveSubscription(userID string) (*SubscriptionStatus, error) {
	// Check all subscription tiers
	tiers := GetSubscriptionTiers()
	for tierID := range tiers {
		status, err := CheckSubscription(userID, tierID)
		if err != nil {
			return nil, err
		}
		if status.IsActive {
			return status, nil
		}
	}
	
	return &SubscriptionStatus{
		UserID:   userID,
		IsActive: false,
	}, nil
}
