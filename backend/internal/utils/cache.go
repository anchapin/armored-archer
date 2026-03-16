// Package utils provides utility functions and helpers for the Armored Archer backend.
package utils

import (
	"sync"
	"time"

	"github.com/heroiclabs/nakama-common/runtime"
)

// CacheManager provides LRU cache instances with metrics tracking.
type CacheManager struct {
	logger runtime.Logger
	caches map[string]*LRUCache
	mu     sync.RWMutex
}

// LRUCache is a simple LRU cache implementation.
type LRUCache struct {
	items     map[string]*cacheItem
	head      *cacheItem
	tail      *cacheItem
	capacity  int
	hits      int64
	misses    int64
	evictions int64
	mu        sync.RWMutex
}

// cacheItem represents a single cache entry.
type cacheItem struct {
	key        string
	value      interface{}
	expiration int64
	prev       *cacheItem
	next       *cacheItem
}

// NewCacheManager creates a new cache manager.
func NewCacheManager(logger runtime.Logger) *CacheManager {
	return &CacheManager{
		logger: logger,
		caches: make(map[string]*LRUCache),
	}
}

// CreateCache creates a new named cache with the specified capacity and default TTL.
func (m *CacheManager) CreateCache(name string, capacity int, defaultTTL time.Duration) *LRUCache {
	m.mu.Lock()
	defer m.mu.Unlock()

	if cache, exists := m.caches[name]; exists {
		return cache
	}

	cache := &LRUCache{
		items:    make(map[string]*cacheItem),
		capacity: capacity,
	}

	m.caches[name] = cache
	m.logger.Debug("Created cache: %s (capacity: %d, ttl: %v)", name, capacity, defaultTTL)
	return cache
}

// GetCache returns a cache by name.
func (m *CacheManager) GetCache(name string) *LRUCache {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.caches[name]
}

// Get retrieves a value from the cache.
func (c *LRUCache) Get(key string) (interface{}, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	item, exists := c.items[key]
	if !exists {
		c.misses++
		return nil, false
	}

	// Check expiration
	if item.expiration > 0 && time.Now().UnixNano() > item.expiration {
		c.remove(item)
		c.misses++
		return nil, false
	}

	// Move to head (most recently used)
	c.moveToHead(item)
	c.hits++
	return item.value, true
}

// Set stores a value in the cache.
func (c *LRUCache) Set(key string, value interface{}, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Check if item exists
	if item, exists := c.items[key]; exists {
		item.value = value
		if ttl > 0 {
			item.expiration = time.Now().Add(ttl).UnixNano()
		}
		c.moveToHead(item)
		return
	}

	// Create new item
	item := &cacheItem{
		key:   key,
		value: value,
	}
	if ttl > 0 {
		item.expiration = time.Now().Add(ttl).UnixNano()
	}

	c.items[key] = item
	c.addToHead(item)

	// Evict if over capacity
	if len(c.items) > c.capacity {
		c.evictTail()
	}
}

// Delete removes a value from the cache.
func (c *LRUCache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if item, exists := c.items[key]; exists {
		c.remove(item)
		delete(c.items, key)
	}
}

// Clear clears all items from the cache.
func (c *LRUCache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.items = make(map[string]*cacheItem)
	c.head = nil
	c.tail = nil
	c.hits = 0
	c.misses = 0
	c.evictions = 0
}

// Stats returns cache statistics.
func (c *LRUCache) Stats() (hits, misses, evictions int64, size int) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.hits, c.misses, c.evictions, len(c.items)
}

// addToHead adds an item to the head of the doubly-linked list.
func (c *LRUCache) addToHead(item *cacheItem) {
	item.next = c.head
	item.prev = nil
	if c.head != nil {
		c.head.prev = item
	}
	c.head = item
	if c.tail == nil {
		c.tail = item
	}
}

// moveToHead moves an existing item to the head.
func (c *LRUCache) moveToHead(item *cacheItem) {
	if item == c.head {
		return
	}
	c.remove(item)
	c.addToHead(item)
}

// remove removes an item from the doubly-linked list.
func (c *LRUCache) remove(item *cacheItem) {
	if item.prev != nil {
		item.prev.next = item.next
	} else {
		c.head = item.next
	}

	if item.next != nil {
		item.next.prev = item.prev
	} else {
		c.tail = item.prev
	}
}

// evictTail evicts the least recently used item.
func (c *LRUCache) evictTail() {
	if c.tail == nil {
		return
	}

	tail := c.tail
	c.remove(tail)
	delete(c.items, tail.key)
	c.evictions++
}
