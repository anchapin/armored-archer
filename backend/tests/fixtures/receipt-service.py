"""CI-only RevenueCat HTTP contract fixture, not a real receipt verifier."""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

PRODUCTS = {"com.armoredarcher.gems." + size for size in ("small", "medium", "large")}

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
        except (ValueError, TypeError):
            body = {}
        product = body.get("product_id")
        receipt = body.get("receipt", "")
        valid = (
            self.path == "/v1/receipts/validate"
            and self.headers.get("Authorization") == "Bearer ci-test-revenuecat-secret-key-do-not-use-in-production"
            and product in PRODUCTS
            and isinstance(receipt, str)
            and receipt.startswith(("valid_receipt_", "receipt_"))
            and body.get("platform") in ("apple", "google")
        )
        self.send_response(200 if valid else 422)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        result = {"valid": True, "subscriber": {"non_subscriptions": {product: [{}]}}} if valid else {"valid": False}
        self.wfile.write(json.dumps(result).encode())

if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
