## SecureStore — desktop / fallback implementation (issue #1095).
##
## Pure-GDScript authenticated-encryption envelope for session/refresh tokens.
## On Android the runtime autoload (autoloads/SecureStore.gd) routes through
## the SecureStoreAndroid Java plugin instead; this class is the
## everywhere-else fallback (Windows, macOS, Linux, headless test runs,
## any platform where the native plugin singleton is absent).
##
## Cryptography: AES-256-CBC + HMAC-SHA256 in an Encrypt-then-MAC envelope,
## the standard construction for AE without AES-GCM in Godot 4.6. Godot's
## AESContext class only exposes CBC; the HMAC tag gives equivalent
## integrity/authenticity guarantees to GCM for our threat model
## (other apps with file-system access to user://).
##
## On-disk layout under user://secure_store/ :
##   .key                   — 32-byte per-installation data-encryption key
##   <name>.enc             — IV (16) || ciphertext || HMAC-SHA256 (32)
##
## Threat-model caveat: on desktop the data-encryption key sits next to
## the ciphertext, so a same-user attacker with file-system access can
## still recover the plaintext. This matches the issue's "fall back to
## file-based encrypted storage under user://" guidance. Hardware-backed
## protection requires the OS-managed credential store — Android uses
## EncryptedSharedPreferences (key material in Android Keystore); iOS is
## tracked as future work because the iOS export is not wired into this
## scope. Production biometric protection is also future work; the issue
## explicitly scopes this PR to encryption-at-rest.
class_name SecureStoreCore
extends RefCounted

const STORE_DIR: String = "user://secure_store"
const KEY_FILE: String = "user://secure_store/.key"
const KEY_LEN: int = 32
const IV_LEN: int = 16
const HMAC_LEN: int = 32

var _key: PackedByteArray = PackedByteArray()

## Loads (or generates) the per-installation data-encryption key.
## Must be called once before save_blob / load_blob.
func initialize() -> Error:
	var dir_err: Error = _ensure_store_dir()
	if dir_err != OK:
		return dir_err
	if FileAccess.file_exists(KEY_FILE):
		var f: FileAccess = FileAccess.open(KEY_FILE, FileAccess.READ)
		if f == null:
			push_error("SecureStore: cannot open key file (error %d)" % FileAccess.get_open_error())
			return ERR_FILE_CANT_OPEN
		_key = f.get_buffer(KEY_LEN)
		f.close()
		if _key.size() != KEY_LEN:
			push_error("SecureStore: key file corrupt (got %d bytes, expected %d)" % [_key.size(), KEY_LEN])
			_key = PackedByteArray()
			return ERR_FILE_CORRUPT
		return OK
	var crypto: Crypto = Crypto.new()
	var new_key: PackedByteArray = crypto.generate_random_bytes(KEY_LEN)
	var f2: FileAccess = FileAccess.open(KEY_FILE, FileAccess.WRITE)
	if f2 == null:
		push_error("SecureStore: cannot create key file (error %d)" % FileAccess.get_open_error())
		return ERR_FILE_CANT_WRITE
	f2.store_buffer(new_key)
	f2.close()
	_key = new_key
	return OK

## Encrypts and persists `plaintext` under `name`.
## Returns OK on success, an Error code on failure.
func save_blob(name: String, plaintext: PackedByteArray) -> Error:
	if _key.is_empty():
		var init_err: Error = initialize()
		if init_err != OK:
			return init_err
	var safe_name: String = _sanitize_name(name)
	var path: String = "%s/%s.enc" % [STORE_DIR, safe_name]
	var blob: PackedByteArray = _encrypt(plaintext)
	if blob.is_empty():
		return ERR_FILE_CANT_WRITE
	var f: FileAccess = FileAccess.open(path, FileAccess.WRITE)
	if f == null:
		push_error("SecureStore: cannot write %s (error %d)" % [path, FileAccess.get_open_error()])
		return ERR_FILE_CANT_WRITE
	f.store_buffer(blob)
	f.close()
	return OK

## Loads and decrypts the blob stored under `name`.
## Returns an empty PackedByteArray when the entry does not exist or
## the HMAC tag fails (treat empty == missing for caller simplicity).
func load_blob(name: String) -> PackedByteArray:
	if _key.is_empty():
		var init_err: Error = initialize()
		if init_err != OK:
			return PackedByteArray()
	var safe_name: String = _sanitize_name(name)
	var path: String = "%s/%s.enc" % [STORE_DIR, safe_name]
	if not FileAccess.file_exists(path):
		return PackedByteArray()
	var f: FileAccess = FileAccess.open(path, FileAccess.READ)
	if f == null:
		push_error("SecureStore: cannot read %s (error %d)" % [path, FileAccess.get_open_error()])
		return PackedByteArray()
	var blob: PackedByteArray = f.get_buffer(f.get_length())
	f.close()
	return _decrypt(blob)

## Deletes the stored blob. Missing entries are not an error.
func erase_blob(name: String) -> Error:
	var safe_name: String = _sanitize_name(name)
	var path: String = "%s/%s.enc" % [STORE_DIR, safe_name]
	if not FileAccess.file_exists(path):
		return OK
	var err: Error = DirAccess.remove_absolute(path)
	if err != OK:
		push_error("SecureStore: cannot remove %s (error %d)" % [path, err])
	return err

## Returns true when `name` exists in the store.
func has_blob(name: String) -> bool:
	var safe_name: String = _sanitize_name(name)
	var path: String = "%s/%s.enc" % [STORE_DIR, safe_name]
	return FileAccess.file_exists(path)

# --- Internal: authenticated encryption (AES-256-CBC + HMAC-SHA256) ---

func _encrypt(plaintext: PackedByteArray) -> PackedByteArray:
	if _key.is_empty():
		return PackedByteArray()
	var crypto: Crypto = Crypto.new()
	var iv: PackedByteArray = crypto.generate_random_bytes(IV_LEN)
	var padded: PackedByteArray = _pkcs7_pad(plaintext, 16)
	var aes: AESContext = AESContext.new()
	var start_err: Error = aes.start(AESContext.MODE_CBC_ENCRYPT, _key, iv)
	if start_err != OK:
		push_error("SecureStore: AESContext start failed (error %d)" % start_err)
		return PackedByteArray()
	var ciphertext: PackedByteArray = aes.update(padded)
	aes.finish()
	var body: PackedByteArray = iv
	body.append_array(ciphertext)
	var tag: PackedByteArray = _hmac_sha256(body)
	body.append_array(tag)
	return body

func _decrypt(blob: PackedByteArray) -> PackedByteArray:
	if _key.is_empty():
		return PackedByteArray()
	if blob.size() < IV_LEN + HMAC_LEN:
		return PackedByteArray()
	var body_size: int = blob.size() - HMAC_LEN
	var body: PackedByteArray = blob.slice(0, body_size)
	var stored_tag: PackedByteArray = blob.slice(body_size, blob.size())
	var expected_tag: PackedByteArray = _hmac_sha256(body)
	if not _constant_time_equals(stored_tag, expected_tag):
		push_error("SecureStore: HMAC verification failed; refusing to decrypt")
		return PackedByteArray()
	var iv: PackedByteArray = body.slice(0, IV_LEN)
	var ciphertext: PackedByteArray = body.slice(IV_LEN, body.size())
	if ciphertext.size() % 16 != 0:
		return PackedByteArray()
	var aes: AESContext = AESContext.new()
	var start_err: Error = aes.start(AESContext.MODE_CBC_DECRYPT, _key, iv)
	if start_err != OK:
		push_error("SecureStore: AESContext decrypt start failed (error %d)" % start_err)
		return PackedByteArray()
	var padded: PackedByteArray = aes.update(ciphertext)
	aes.finish()
	return _pkcs7_unpad(padded)

func _hmac_sha256(message: PackedByteArray) -> PackedByteArray:
	var hmac: HMACContext = HMACContext.new()
	var start_err: Error = hmac.start(HashingContext.HASH_SHA256, _key)
	if start_err != OK:
		push_error("SecureStore: HMAC start failed (error %d)" % start_err)
		return PackedByteArray()
	hmac.update(message)
	return hmac.finish()

func _pkcs7_pad(data: PackedByteArray, block_size: int) -> PackedByteArray:
	var pad_len: int = block_size - (data.size() % block_size)
	if pad_len == 0:
		pad_len = block_size
	var pad_byte: int = pad_len
	var padded: PackedByteArray = data.duplicate()
	for i in pad_len:
		padded.append(pad_byte)
	return padded

func _pkcs7_unpad(data: PackedByteArray) -> PackedByteArray:
	if data.is_empty():
		return PackedByteArray()
	var pad_len: int = data[data.size() - 1]
	if pad_len <= 0 or pad_len > 16 or pad_len > data.size():
		push_error("SecureStore: invalid PKCS7 padding (%d)" % pad_len)
		return PackedByteArray()
	for i in pad_len:
		if data[data.size() - 1 - i] != pad_len:
			push_error("SecureStore: inconsistent PKCS7 padding")
			return PackedByteArray()
	return data.slice(0, data.size() - pad_len)

func _constant_time_equals(a: PackedByteArray, b: PackedByteArray) -> bool:
	if a.size() != b.size():
		return false
	var diff: int = 0
	for i in a.size():
		diff |= a[i] ^ b[i]
	return diff == 0

func _sanitize_name(name: String) -> String:
	var out: PackedByteArray = PackedByteArray()
	for i in name.length():
		var code: int = name.unicode_at(i)
		var is_safe: bool = (
			(code >= 48 and code <= 57)
			or (code >= 65 and code <= 90)
			or (code >= 97 and code <= 122)
			or code == 45
			or code == 95
		)
		if is_safe:
			out.append(code)
		else:
			out.append(95)
	return out.get_string_from_utf8()

func _ensure_store_dir() -> Error:
	if DirAccess.dir_exists_absolute(STORE_DIR):
		return OK
	var err: Error = DirAccess.make_dir_recursive_absolute(STORE_DIR)
	if err != OK:
		push_error("SecureStore: cannot create %s (error %d)" % [STORE_DIR, err])
	return err
