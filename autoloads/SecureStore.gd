## SecureStore autoload — issue #1095.
##
## Single, well-typed front door for everything that needs to persist
## an authentication secret at rest. Selects the right backend at runtime:
##
##   * Android — routes through the SecureStoreAndroid Java plugin
##     (Android Keystore + EncryptedSharedPreferences). The master key is
##     non-exportable from the Keystore and (on supported hardware)
##     backed by the device's TEE / StrongBox.
##   * Windows / macOS / Linux / headless tests — falls back to the
##     pure-GDScript SecureStoreCore implementation (AES-256-CBC +
##     HMAC-SHA256, per-installation data-encryption key under
##     user://secure_store/).
##
## Threat-model caveats (intentional, scoped to issue #1095):
##   * On desktop the data-encryption key sits next to the ciphertext, so
##     a same-user attacker with file-system access to user:// can still
##     recover plaintext. The Android path is the one that genuinely
##     survives other apps with storage permission; desktop is the
##     best-we-can-do fallback without an OS-bridged credential store
##     and is still vastly better than the prior plaintext JSON.
##   * iOS is not wired into this scope (no Keychain bridge yet).
##   * Production biometric protection is deliberately OUT OF SCOPE and
##     recorded as future work in the commit body.
##
## Only the session/refresh-token path is migrated to this store. Other
## credentials (Firebase custom tokens, RevenueCat receipts, etc.) remain
## where they are — see the issue body for the explicit scope guard.
extends Node

const SESSION_BLOB_NAME: String = "session_blob"

const SecureStoreCore := preload("res://addons/secure_store/secure_store.gd")

var _core: RefCounted = null
var _android_singleton: Object = null
var _android_singleton_name: String = "SecureStoreAndroid"
var _backend_label: String = "uninitialized"
var _initialization_error: Error = OK

func _ready() -> void:
	_initialization_error = _initialize_backend()
	if _initialization_error != OK:
		push_error(
			"SecureStore: backend initialization failed (error %d); credential persistence will be unavailable"
			% _initialization_error
		)

## Public: returns a short, human-readable label for the active backend.
## Useful for telemetry / logs / a debug overlay.
func get_backend_label() -> String:
	return _backend_label

## Public: returns true when the active backend accepted the seed call
## during _ready(). Callers may still get per-call errors (e.g. disk full).
func is_available() -> bool:
	return _initialization_error == OK

## Public: encrypts and persists `plaintext` under the well-known
## session-blob name. The same bytes are loaded by `load_session_blob`.
func save_session_blob(plaintext: PackedByteArray) -> Error:
	return _dispatch_save(SESSION_BLOB_NAME, plaintext)

## Public: returns the previously-stored session blob, or an empty
## PackedByteArray when no entry exists or the backend refuses to decrypt
## (treat both as "no cached session" upstream).
func load_session_blob() -> PackedByteArray:
	return _dispatch_load(SESSION_BLOB_NAME)

## Public: deletes the stored session blob. Missing entries are OK.
func erase_session_blob() -> Error:
	return _dispatch_erase(SESSION_BLOB_NAME)

## Public: returns true when a session blob exists.
func has_session_blob() -> bool:
	return _dispatch_has(SESSION_BLOB_NAME)

# --- Backend routing ---

func _initialize_backend() -> Error:
	if OS.has_feature("android") and Engine.has_singleton(_android_singleton_name):
		_android_singleton = Engine.get_singleton(_android_singleton_name)
		if _android_singleton == null:
			push_warning("SecureStore: Android singleton lookup returned null; falling back to core")
		else:
			_backend_label = "android-keystore"
			return OK
	# Desktop / headless / iOS / anything else → pure-GDScript fallback.
	_core = SecureStoreCore.new()
	var core_err: Error = _core.initialize()
	if core_err != OK:
		return core_err
	if OS.has_feature("android"):
		_backend_label = "core-fallback"
	else:
		_backend_label = "core"
	return OK

func _dispatch_save(name: String, plaintext: PackedByteArray) -> Error:
	if _android_singleton != null and _android_singleton.has_method("saveBlob"):
		var ok: bool = bool(_android_singleton.call("saveBlob", name, plaintext))
		if not ok:
			return ERR_FILE_CANT_WRITE
		return OK
	if _core == null:
		return ERR_UNCONFIGURED
	return _core.save_blob(name, plaintext)

func _dispatch_load(name: String) -> PackedByteArray:
	if _android_singleton != null and _android_singleton.has_method("loadBlob"):
		var bytes: Variant = _android_singleton.call("loadBlob", name)
		if bytes == null:
			return PackedByteArray()
		if bytes is PackedByteArray:
			return bytes
		# Some Android plugin loaders return Java byte[] as a typed
		# Array[byte]; coerce to PackedByteArray for callers.
		return _coerce_to_bytes(bytes)
	if _core == null:
		return PackedByteArray()
	return _core.load_blob(name)

func _dispatch_erase(name: String) -> Error:
	if _android_singleton != null and _android_singleton.has_method("eraseBlob"):
		var ok: bool = bool(_android_singleton.call("eraseBlob", name))
		if not ok:
			return ERR_FILE_CANT_WRITE
		return OK
	if _core == null:
		return ERR_UNCONFIGURED
	return _core.erase_blob(name)

func _dispatch_has(name: String) -> bool:
	if _android_singleton != null and _android_singleton.has_method("hasBlob"):
		return bool(_android_singleton.call("hasBlob", name))
	if _core == null:
		return false
	return _core.has_blob(name)

func _coerce_to_bytes(value: Variant) -> PackedByteArray:
	var out: PackedByteArray = PackedByteArray()
	if value is Array:
		for entry in value:
			out.append(int(entry))
	elif value is PackedByteArray:
		out = value
	return out
