package store_test

import (
	"testing"

	"github.com/anchapin/armored-archer/backend/internal/store"
	"github.com/anchapin/armored-archer/backend/tests/testhelpers"
)

func TestNewCurrencyBalance(t *testing.T) {
	balance := store.NewCurrencyBalance("user123")

	testhelpers.AssertEqual(t, "user123", balance.UserID, "UserID should match")
	testhelpers.AssertEqual(t, 0, balance.Coins, "Initial coins should be 0")
	testhelpers.AssertEqual(t, 0, balance.Gems, "Initial gems should be 0")
	testhelpers.AssertTrue(t, balance.Updated > 0, "Updated timestamp should be set")
}

func TestAddCurrency(t *testing.T) {
	balance := store.NewCurrencyBalance("user123")

	// Test adding gems
	err := balance.AddCurrency(store.CurrencyGems, 100)
	testhelpers.AssertNoError(t, err, "Should add gems")
	testhelpers.AssertEqual(t, 100, balance.Gems, "Gems should be 100")

	// Test adding coins
	err = balance.AddCurrency(store.CurrencyCoins, 500)
	testhelpers.AssertNoError(t, err, "Should add coins")
	testhelpers.AssertEqual(t, 500, balance.Coins, "Coins should be 500")

	// Test adding negative amount
	err = balance.AddCurrency(store.CurrencyGems, -10)
	testhelpers.AssertError(t, err, "Should fail with negative amount")

	// Test exceeding max balance
	balance.Gems = store.MaxGemBalance - 50
	err = balance.AddCurrency(store.CurrencyGems, 100)
	testhelpers.AssertError(t, err, "Should fail when exceeding max balance")

	// Test unknown currency type
	err = balance.AddCurrency("unknown", 100)
	testhelpers.AssertError(t, err, "Should fail with unknown currency type")
}

func TestSpendCurrency(t *testing.T) {
	balance := store.NewCurrencyBalance("user123")
	balance.Gems = 100
	balance.Coins = 500

	// Test spending gems
	err := balance.SpendCurrency(store.CurrencyGems, 50)
	testhelpers.AssertNoError(t, err, "Should spend gems")
	testhelpers.AssertEqual(t, 50, balance.Gems, "Gems should be 50")

	// Test spending coins
	err = balance.SpendCurrency(store.CurrencyCoins, 200)
	testhelpers.AssertNoError(t, err, "Should spend coins")
	testhelpers.AssertEqual(t, 300, balance.Coins, "Coins should be 300")

	// Test spending negative amount
	err = balance.SpendCurrency(store.CurrencyGems, -10)
	testhelpers.AssertError(t, err, "Should fail with negative amount")

	// Test insufficient balance
	err = balance.SpendCurrency(store.CurrencyGems, 100)
	testhelpers.AssertError(t, err, "Should fail with insufficient balance")

	// Test unknown currency type
	err = balance.SpendCurrency("unknown", 100)
	testhelpers.AssertError(t, err, "Should fail with unknown currency type")
}

func TestGetBalance(t *testing.T) {
	balance := store.NewCurrencyBalance("user123")
	balance.Gems = 100
	balance.Coins = 500

	gems, err := balance.GetBalance(store.CurrencyGems)
	testhelpers.AssertNoError(t, err, "Should get gems balance")
	testhelpers.AssertEqual(t, 100, gems, "Gems should be 100")

	coins, err := balance.GetBalance(store.CurrencyCoins)
	testhelpers.AssertNoError(t, err, "Should get coins balance")
	testhelpers.AssertEqual(t, 500, coins, "Coins should be 500")

	_, err = balance.GetBalance("unknown")
	testhelpers.AssertError(t, err, "Should fail with unknown currency type")
}

func TestValidatePurchaseRequest(t *testing.T) {
	// Valid request
	req := &store.ValidatePurchaseRequest{
		TransactionID: "tx123",
		ProductID:     "gem_pack_small",
		Platform:      store.PlatformIOS,
		Receipt:       "receipt_data",
		Signature:     "signature",
	}
	err := req.Validate()
	testhelpers.AssertNoError(t, err, "Valid request should pass validation")

	// Invalid: empty transaction ID
	req.TransactionID = ""
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with empty transaction ID")

	// Invalid: empty product ID
	req.TransactionID = "tx123"
	req.ProductID = ""
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with empty product ID")

	// Invalid: empty platform
	req.ProductID = "gem_pack_small"
	req.Platform = ""
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with empty platform")

	// Invalid: invalid platform
	req.Platform = "invalid"
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with invalid platform")

	// Invalid: empty receipt
	req.Platform = store.PlatformIOS
	req.Receipt = ""
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with empty receipt")
}

func TestValidateSpendGemsRequest(t *testing.T) {
	// Valid request
	req := &store.SpendGemsRequest{
		Amount:  100,
		Purpose: "buy_item",
	}
	err := req.Validate()
	testhelpers.AssertNoError(t, err, "Valid request should pass validation")

	// Invalid: zero amount
	req.Amount = 0
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with zero amount")

	// Invalid: negative amount
	req.Amount = -100
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with negative amount")

	// Invalid: amount exceeds max
	req.Amount = store.MaxPurchaseAmount + 1
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with amount exceeding max")

	// Invalid: empty purpose
	req.Amount = 100
	req.Purpose = ""
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with empty purpose")
}

func TestValidateRefundRequest(t *testing.T) {
	// Valid request
	req := &store.RefundRequest{
		TransactionID: "tx123",
		Reason:        store.RefundReasonCustomerSupport,
	}
	err := req.Validate()
	testhelpers.AssertNoError(t, err, "Valid request should pass validation")

	// Invalid: empty transaction ID
	req.TransactionID = ""
	err = req.Validate()
	testhelpers.AssertError(t, err, "Should fail with empty transaction ID")
}

func TestHashReceipt(t *testing.T) {
	receipt1 := "receipt_data_1"
	receipt2 := "receipt_data_2"

	hash1 := store.HashReceipt(receipt1)
	hash2 := store.HashReceipt(receipt2)

	testhelpers.AssertTrue(t, len(hash1) > 0, "Hash should not be empty")
	testhelpers.AssertTrue(t, len(hash2) > 0, "Hash should not be empty")
	testhelpers.AssertNotEqual(t, hash1, hash2, "Different receipts should have different hashes")

	// Same receipt should have same hash
	hash1Again := store.HashReceipt(receipt1)
	testhelpers.AssertEqual(t, hash1, hash1Again, "Same receipt should have same hash")
}

func TestValidateReceiptSignature(t *testing.T) {
	// Valid signature (non-empty)
	err := store.ValidateReceiptSignature("receipt", "signature", "public_key")
	testhelpers.AssertNoError(t, err, "Should validate with non-empty signature")

	// Invalid: empty signature
	err = store.ValidateReceiptSignature("receipt", "", "public_key")
	testhelpers.AssertError(t, err, "Should fail with empty signature")
}

func TestGetRefundReason(t *testing.T) {
	tests := []struct {
		reason   string
		expected store.RefundReason
	}{
		{"customer_support", store.RefundReasonCustomerSupport},
		{"chargeback", store.RefundReasonChargeback},
		{"duplicate", store.RefundReasonDuplicate},
		{"fraud", store.RefundReasonFraud},
		{"other", store.RefundReasonOther},
		{"unknown", store.RefundReasonOther},
	}

	for _, tt := range tests {
		result := store.GetRefundReason(tt.reason)
		testhelpers.AssertEqual(t, tt.expected, result,
			fmt.Sprintf(""Reason for %s", tt.reason))
	}
}

func TestGetProductAmount(t *testing.T) {
	tests := []struct {
		productID  string
		wantAmount int
		wantCurrency string
		wantError  bool
	}{
		{"gem_pack_small", 100, store.CurrencyGems, false},
		{"gem_pack_medium", 500, store.CurrencyGems, false},
		{"gem_pack_large", 1200, store.CurrencyGems, false},
		{"gem_pack_xl", 2500, store.CurrencyGems, false},
		{"coin_pack_small", 1000, store.CurrencyCoins, false},
		{"coin_pack_medium", 5000, store.CurrencyCoins, false},
		{"coin_pack_large", 12000, store.CurrencyCoins, false},
		{"starter_pack", 200, store.CurrencyGems, false},
		{"monthly_pass", 50, store.CurrencyGems, false},
		{"invalid_product", 0, "", true},
	}

	for _, tt := range tests {
		amount, currency, err := store.GetProductAmount(tt.productID)
		if tt.wantError {
			testhelpers.AssertError(t, err, "Should fail for "+tt.productID)
		} else {
			testhelpers.AssertNoError(t, err, "Should succeed for "+tt.productID)
			testhelpers.AssertEqual(t, tt.wantAmount, amount, "Amount for "+tt.productID)
			testhelpers.AssertEqual(t, tt.wantCurrency, currency, "Currency for "+tt.productID)
		}
	}
}

func TestIsValidProduct(t *testing.T) {
	testhelpers.AssertTrue(t, store.IsValidProduct("gem_pack_small"), "gem_pack_small should be valid")
	testhelpers.AssertTrue(t, store.IsValidProduct("coin_pack_large"), "coin_pack_large should be valid")
	testhelpers.AssertFalse(t, store.IsValidProduct("invalid_product"), "invalid_product should be invalid")
}

func TestGetProductCatalog(t *testing.T) {
	catalog := store.GetProductCatalog()
	testhelpers.AssertTrue(t, len(catalog) > 0, "Catalog should not be empty")

	// Verify some expected products
	hasGemPack := false
	hasCoinPack := false
	for _, product := range catalog {
		if product == "gem_pack_small" {
			hasGemPack = true
		}
		if product == "coin_pack_small" {
			hasCoinPack = true
		}
	}
	testhelpers.AssertTrue(t, hasGemPack, "Catalog should have gem packs")
	testhelpers.AssertTrue(t, hasCoinPack, "Catalog should have coin packs")
}

func TestCanAfford(t *testing.T) {
	balance := store.NewCurrencyBalance("user123")
	balance.Gems = 100
	balance.Coins = 500

	testhelpers.AssertTrue(t, balance.CanAfford(store.CurrencyGems, 50), "Should afford 50 gems")
	testhelpers.AssertFalse(t, balance.CanAfford(store.CurrencyGems, 200), "Should not afford 200 gems")
	testhelpers.AssertTrue(t, balance.CanAfford(store.CurrencyCoins, 500), "Should afford 500 coins")
	testhelpers.AssertFalse(t, balance.CanAfford(store.CurrencyCoins, 501), "Should not afford 501 coins")
	testhelpers.AssertFalse(t, balance.CanAfford("unknown", 100), "Should not afford unknown currency")
}

func TestNewTransaction(t *testing.T) {
	tx := store.NewTransaction("user123", "purchase", store.CurrencyGems, 100, 0, 100, "metadata")

	testhelpers.AssertTrue(t, len(tx.ID) > 0, "Transaction ID should not be empty")
	testhelpers.AssertEqual(t, "user123", tx.UserID, "UserID should match")
	testhelpers.AssertEqual(t, "purchase", tx.Type, "Type should match")
	testhelpers.AssertEqual(t, store.CurrencyGems, tx.CurrencyType, "CurrencyType should match")
	testhelpers.AssertEqual(t, 100, tx.Amount, "Amount should match")
	testhelpers.AssertEqual(t, 0, tx.BalanceBefore, "BalanceBefore should match")
	testhelpers.AssertEqual(t, 100, tx.BalanceAfter, "BalanceAfter should match")
	testhelpers.AssertTrue(t, tx.Timestamp > 0, "Timestamp should be set")
	testhelpers.AssertEqual(t, "metadata", tx.Metadata, "Metadata should match")
}

func TestGetSubscriptionTiers(t *testing.T) {
	tiers := store.GetSubscriptionTiers()

	testhelpers.AssertTrue(t, len(tiers) > 0, "Should have subscription tiers")
	testhelpers.AssertTrue(t, tiers["monthly_basic"].Price > 0, "Basic tier should have price")
	testhelpers.AssertTrue(t, tiers["monthly_basic"].Duration > 0, "Basic tier should have duration")
	testhelpers.AssertTrue(t, len(tiers["monthly_basic"].Benefits) > 0, "Basic tier should have benefits")
}

func TestCheckSubscription(t *testing.T) {
	status, err := store.CheckSubscription("user123", "monthly_basic")
	testhelpers.AssertNoError(t, err, "Should check subscription")
	testhelpers.AssertNotNil(t, status, "Should return status")
	testhelpers.AssertEqual(t, "user123", status.UserID, "UserID should match")
}

func TestGetActiveSubscription(t *testing.T) {
	status, err := store.GetActiveSubscription("user123")
	testhelpers.AssertNoError(t, err, "Should get active subscription")
	testhelpers.AssertNotNil(t, status, "Should return status")
	testhelpers.AssertEqual(t, "user123", status.UserID, "UserID should match")
}

func TestCurrencyBalanceToJSON(t *testing.T) {
	balance := store.NewCurrencyBalance("user123")
	balance.Gems = 100
	balance.Coins = 500

	jsonStr, err := balance.ToJSON()
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")

	// Verify we can parse it back
	restored, err := store.CurrencyBalanceFromJSON(jsonStr)
	testhelpers.AssertNoError(t, err, "Should parse generated JSON")
	testhelpers.AssertEqual(t, balance.UserID, restored.UserID, "UserID should match")
	testhelpers.AssertEqual(t, balance.Gems, restored.Gems, "Gems should match")
}

func TestPurchaseResultToJSON(t *testing.T) {
	result := &store.PurchaseResult{
		Success:      true,
		TransactionID: "tx123",
		Amount:       100,
		Currency:     store.CurrencyGems,
	}

	jsonStr, err := store.PurchaseResultToJSON(result)
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")
}

func TestSpendResultToJSON(t *testing.T) {
	result := &store.SpendResult{
		Success:         true,
		PreviousBalance: 200,
		NewBalance:      100,
		AmountSpent:     100,
	}

	jsonStr, err := store.SpendResultToJSON(result)
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")
}

func TestRefundResultToJSON(t *testing.T) {
	result := &store.RefundResult{
		Success:        true,
		TransactionID:  "tx123",
		RefundedAmount: 100,
		Reason:         "customer_support",
	}

	jsonStr, err := store.RefundResultToJSON(result)
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")
}

func TestSubscriptionStatusToJSON(t *testing.T) {
	status := &store.SubscriptionStatus{
		UserID:           "user123",
		IsActive:         true,
		SubscriptionType: "monthly_basic",
		ExpiresAt:        1234567890,
		AutoRenew:        true,
	}

	jsonStr, err := store.SubscriptionStatusToJSON(status)
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")
}

func TestTransactionsToJSON(t *testing.T) {
	transactions := []*store.Transaction{
		store.NewTransaction("user1", "purchase", store.CurrencyGems, 100, 0, 100, ""),
		store.NewTransaction("user2", "spend", store.CurrencyGems, 50, 100, 50, ""),
	}

	jsonStr, err := store.TransactionsToJSON(transactions)
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")
}

func TestCurrencyBalancesToJSON(t *testing.T) {
	balances := []*store.CurrencyBalance{
		store.NewCurrencyBalance("user1"),
		store.NewCurrencyBalance("user2"),
	}

	jsonStr, err := store.CurrencyBalancesToJSON(balances)
	testhelpers.AssertNoError(t, err, "Should marshal to JSON")
	testhelpers.AssertTrue(t, len(jsonStr) > 0, "JSON should not be empty")
}
