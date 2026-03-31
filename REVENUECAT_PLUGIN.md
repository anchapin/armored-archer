# RevenueCat Native Plugin Guide

This guide explains how to create a native plugin interface for RevenueCat in Godot.

## Overview

Godot doesn't have built-in RevenueCat support, so we need to create a native plugin that bridges Godot GDScript with the RevenueCat SDKs on iOS and Android.

## iOS Plugin Implementation

### 1. Create Plugin Directory Structure

```
res://addons/revenuecat/
├── plugin.cfg
├── revenuecat.gd
└── ios/
    └── RevenueCatPlugin.swift
```

### 2. Create plugin.cfg

```ini
[plugin]

name="RevenueCat"
description="In-app purchases via RevenueCat"
author="Your Company"
version="1.0.0"
script="revenuecat.gd"
```

### 3. Create Swift Plugin (RevenueCatPlugin.swift)

```swift
import Foundation
import Godot
import RevenueCat

@GodotNativeClass
class RevenueCatPlugin: GodotObject {
    
    @Export var revenueCatInitialized: Bool = false
    
    // Initialize RevenueCat with API key
    @Callable
    func configure(apiKey: String) {
        Purchases.logLevel = .debug
        Purchases.configure(withAPIKey: apiKey)
        revenueCatInitialized = true
    }
    
    // Purchase a product
    @Callable
    func purchaseProduct(productId: String) -> Dictionary {
        var result: [String: Any] = [:]
        
        Purchases.shared.getProducts([productId]) { products in
            guard let product = products.first else {
                result["success"] = false
                result["error"] = "Product not found"
                return
            }
            
            Purchases.shared.purchase(product: product) { transaction, info, error in
                if let error = error {
                    result["success"] = false
                    result["error"] = error.localizedDescription
                } else if let transaction = transaction {
                    result["success"] = true
                    result["productIdentifier"] = transaction.productIdentifier
                    result["transactionReceipt"] = transaction.originalTransactionIdentifier ?? ""
                }
            }
        }
        
        return result
    }
    
    // Get available products
    @Callable
    func getProducts(productIds: Array) -> Array {
        var products: [Dictionary] = []
        
        let ids = productIds.compactMap { $0 as? String }
        Purchases.shared.getProducts(ids) { productArray in
            for product in productArray {
                let productInfo: [String: Any] = [
                    "productIdentifier": product.productIdentifier,
                    "localizedTitle": product.localizedTitle,
                    "localizedDescription": product.localizedDescription,
                    "price": product.price.doubleValue,
                    "currencyCode": product.priceLocale.currencyCode ?? "USD"
                ]
                products.append(productInfo)
            }
        }
        
        return products
    }
    
    // Restore purchases
    @Callable
    func restorePurchases() -> Dictionary {
        var result: [String: Any] = [:]
        
        Purchases.shared.restorePurchases { info, error in
            if let error = error {
                result["success"] = false
                result["error"] = error.localizedDescription
            } else {
                result["success"] = true
                var restoredProducts: [String] = []
                for entry in info.entitlements.all.values {
                    for product in entry {
                        restoredProducts.append(product.productIdentifier)
                    }
                }
                result["restoredProducts"] = restoredProducts
            }
        }
        
        return result
    }
}

static func _register() {
    GodotRuntime.registerClass(class: RevenueCatPlugin.self)
}
```

### 4. Update Podfile for iOS Export

After exporting to iOS, add to `Podfile`:

```ruby
target 'YourGame' do
  pod 'RevenueCat', '~> 5.0'
end
```

Then run:
```bash
pod install
```

## Android Plugin Implementation

### 1. Create Plugin Directory Structure

```
res://addons/revenuecat/
├── plugin.cfg
├── revenuecat.gd
└── android/
    └── src/
        └── com/
            └── example/
                └── RevenueCatPlugin.kt
```

### 2. Create Kotlin Plugin (RevenueCatPlugin.kt)

```kotlin
package com.example

import android.app.Activity
import org.godotengine.godot.Godot
import org.godotengine.godot.plugin.GodotPlugin
import org.godotengine.godot.plugin.SignalInfo
import org.godotengine.godot.plugin.UsedByGodot
import com.revenuecat.purchases.*
import com.revenuecat.purchases.amazon.AmazonConfiguration
import kotlinx.coroutines.*
import org.json.JSONObject

class RevenueCatPlugin(godot: Godot) : GodotPlugin(godot) {
    
    companion object {
        private const val SIGNAL_PURCHASE_COMPLETE = "purchase_complete"
        private const val SIGNAL_PRODUCTS_LOADED = "products_loaded"
    }
    
    private var purchases: Purchases? = null
    private var initialized = false
    private val coroutineScope = CoroutineScope(Dispatchers.Main)
    
    override fun getPluginName(): String {
        return "RevenueCatPlugin"
    }
    
    override fun getPluginSignals(): MutableSet<SignalInfo> {
        return mutableSetOf(
            SignalInfo(SIGNAL_PURCHASE_COMPLETE, Dictionary::class.java),
            SignalInfo(SIGNAL_PRODUCTS_LOADED, Array::class.java)
        )
    }
    
    // Initialize RevenueCat
    @UsedByGodot
    fun configure(apiKey: String, amazonApiKey: String = "") {
        if (initialized) return
        
        val configuration = if (amazonApiKey.isNotEmpty()) {
            AmazonConfiguration.Builder(context)
                .apiKey(apiKey)
                .amazonApiKey(amazonApiKey)
                .build()
        } else {
            PurchasesConfiguration.Builder(context, apiKey)
                .build()
        }
        
        purchases = Purchases.configure(configuration)
        initialized = true
    }
    
    // Purchase a product
    @UsedByGodot
    fun purchaseProduct(productId: String) {
        if (!initialized) return
        
        coroutineScope.launch {
            try {
                purchases?.purchaseWith(
                    ProductIdentifier(productId),
                    null,
                    null
                ) { storeTransaction, customerInfo ->
                    val result = Dictionary()
                    
                    if (storeTransaction != null) {
                        result["success"] = true
                        result["productIdentifier"] = storeTransaction.productIdentifier
                        result["transactionReceipt"] = storeTransaction.receipt ?: ""
                        result["purchaseToken"] = storeTransaction.purchaseToken ?: ""
                    } else {
                        result["success"] = false
                        result["error"] = "Purchase cancelled or failed"
                    }
                    
                    emitSignal(SIGNAL_PURCHASE_COMPLETE, result)
                }
            } catch (e: Exception) {
                val result = Dictionary()
                result["success"] = false
                result["error"] = e.message ?: "Unknown error"
                emitSignal(SIGNAL_PURCHASE_COMPLETE, result)
            }
        }
    }
    
    // Get available products
    @UsedByGodot
    fun getProducts(productIds: Array<String>): Array<Dictionary> {
        if (!initialized) return arrayOf()
        
        var products = arrayOf<Dictionary>()
        val completable = CompletableFuture<Array<Dictionary>>()
        
        purchases?.getProducts(productIds.toList()) { storeProducts ->
            products = storeProducts.map { product ->
                val productInfo = Dictionary()
                productInfo["productIdentifier"] = product.identifier
                productInfo["localizedTitle"] = product.title
                productInfo["localizedDescription"] = product.description
                productInfo["price"] = product.price.amountMicros / 1000000.0
                productInfo["currencyCode"] = product.price.currencyCode
                productInfo
            }.toTypedArray()
            completable.complete(products)
        }
        
        return completable.get()
    }
    
    // Restore purchases
    @UsedByGodot
    fun restorePurchases(): Dictionary {
        if (!initialized) return Dictionary().apply {
            put("success", false)
            put("error", "Not initialized")
        }
        
        var result = Dictionary()
        val completable = CompletableFuture<Unit>()
        
        purchases?.restorePurchases { customerInfo, error ->
            if (error != null) {
                result["success"] = false
                result["error"] = error.message
            } else {
                result["success"] = true
                result["customerInfo"] = JSONObject().apply {
                    // Parse customerInfo if needed
                }.toString()
            }
            completable.complete(Unit)
        }
        
        completable.get()
        return result
    }
    
    override fun onMainDestroy() {
        super.onMainDestroy()
        coroutineScope.cancel()
    }
}
```

### 3. Update build.gradle

Add RevenueCat dependency in `android/build.gradle`:

```groovy
dependencies {
    implementation 'com.revenuecat.purchases:purchases:7.4.0'
    // If supporting Amazon
    implementation 'com.revenuecat.purchases:purchases-amazon:7.4.0'
}
```

## GDScript Interface

Create `res://addons/revenuecat/revenuecat.gd`:

```gdscript
extends Node

# --- Singleton Reference ---
var _plugin: RefCounted = null

# --- Signals ---
signal purchase_complete(result: Dictionary)
signal products_loaded(products: Array)

func _ready() -> void:
	_load_plugin()

func _load_plugin() -> void:
	if Engine.has_singleton("RevenueCatPlugin"):
		_plugin = Engine.get_singleton("RevenueCatPlugin")
		print("RevenueCat plugin loaded successfully")
	else:
		push_error("RevenueCat plugin not found")

func configure(api_key: String, amazon_api_key: String = "") -> void:
	if _plugin:
		_plugin.configure(api_key, amazon_api_key)
		print("RevenueCat configured")

func purchase_product(product_id: String) -> void:
	if _plugin:
		_plugin.purchaseProduct(product_id)
	else:
		_simulate_purchase(product_id)

func get_products(product_ids: Array) -> Array:
	if _plugin:
		return _plugin.getProducts(product_ids)
	return []

func restore_purchases() -> Dictionary:
	if _plugin:
		return _plugin.restorePurchases()
	return {"success": false, "error": "Plugin not loaded"}

func _simulate_purchase(product_id: String) -> void:
	# For testing on non-mobile platforms
	var result = {
		"success": true,
		"productIdentifier": product_id,
		"transactionReceipt": "mock_receipt"
	}
	purchase_complete.emit(result)
```

## Integration with StoreManager

Update `autoloads/StoreManager.gd` to use the plugin:

```gdscript
# Add to top of file
@onready var revenuecat_plugin = preload("res://addons/revenuecat/revenuecat.gd").new()

# Add to _ready()
func _ready() -> void:
	_detect_platform()
	_initialize_revenuecat()
	if network_manager:
		network_manager.connected.connect(_on_connected)

func _initialize_revenuecat() -> void:
	if Engine.has_singleton("RevenueCatPlugin"):
		revenuecat_plugin = Engine.get_singleton("RevenueCatPlugin")
		revenuecat_plugin.configure("YOUR_PUBLIC_API_KEY")
		revenuecat_plugin.purchase_complete.connect(_on_revenuecat_purchase_complete)

func _on_revenuecat_purchase_complete(result: Dictionary) -> void:
	# Handle the result from plugin
	# Same as existing implementation
```

## Build and Export

1. **iOS Export**:
   - Export from Godot to iOS project
   - Open Xcode project
   - Add RevenueCat via CocoaPods
   - Build and run

2. **Android Export**:
   - Export from Godot to Android project
   - Open in Android Studio
   - Add RevenueCat dependency
   - Build and run

## Testing

### On Device
1. Install the plugin in Godot project settings
2. Build and run on iOS/Android device
3. Test purchases in sandbox environment

### On Desktop
The plugin automatically simulates purchases for testing purposes when running on non-mobile platforms.

## Additional Resources

- RevenueCat iOS SDK: https://github.com/RevenueCat/purchases-ios
- RevenueCat Android SDK: https://github.com/RevenueCat/purchases-android
- Godot Android Plugins: https://docs.godotengine.org/en/stable/tutorials/platform/android/android_plugin.html
- Godot iOS Plugins: https://docs.godotengine.org/en/stable/tutorials/platform/ios/ios_plugin.html
