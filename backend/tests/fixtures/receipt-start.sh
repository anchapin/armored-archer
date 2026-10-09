#!/bin/sh
set -eu
# Ephemeral test trust, never a provider certificate or production secret.
openssl req -x509 -newkey rsa:2048 -nodes -days 1 \
  -keyout /fixture-cert/key.pem -out /fixture-cert/cert.pem \
  -subj /CN=receipt-fixture -addext subjectAltName=DNS:receipt-fixture
exec python /fixture/server.py
