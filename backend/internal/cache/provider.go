// Package cache provides cache management for the Armored Archer backend.
package cache

import (
	"sync"

	"github.com/anchapin/armored-archer/backend/internal/utils"
	"github.com/heroiclabs/nakama-common/runtime"
)

var (
	globalCache     *utils.CacheManager
	globalCacheLock sync.RWMutex
)

// InitGlobalCache initializes the global cache manager.
func InitGlobalCache(logger runtime.Logger) {
	globalCacheLock.Lock()
	defer globalCacheLock.Unlock()

	if globalCache != nil {
		return
	}

	globalCache = utils.NewCacheManager(logger)
}

// GetGlobalCache returns the global cache manager.
func GetGlobalCache() *utils.CacheManager {
	globalCacheLock.RLock()
	defer globalCacheLock.RUnlock()
	return globalCache
}

// SetTestCache sets the global cache for testing purposes.
// This function should only be used in tests.
func SetTestCache(cache *utils.CacheManager) {
	globalCacheLock.Lock()
	defer globalCacheLock.Unlock()
	globalCache = cache
}

// ResetTestCache clears the global cache (for testing).
func ResetTestCache() {
	globalCacheLock.Lock()
	defer globalCacheLock.Unlock()
	globalCache = nil
}
