# Generic Wallet Proxy API Reference

Standalone reference for generic wallet APIs exposed via proxy.

## Base URL

```text
https://api.singlepana.in/api/v1/generics
```

## Sample Player ID

```text
6999af7f6bcfdab90afbe5bc
```

## Required Headers

```http
Content-Type: application/json
Authorization: Bearer partner-token
```

## Endpoints

### `POST /wallet/balance/:playerId`

Route:

```text
POST https://api.singlepana.in/api/v1/generics/wallet/balance/6999af7f6bcfdab90afbe5bc
```

cURL:

```bash
curl -X POST "https://api.singlepana.in/api/v1/generics/wallet/balance/6999af7f6bcfdab90afbe5bc" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer partner-token"
```

Success response:

```json
{
  "success": true,
  "data": {
    "playerId": "6999af7f6bcfdab90afbe5bc",
    "balance": 10000,
    "currency": "INR"
  }
}
```

### `POST /wallet/debit/:playerId`

Route:

```text
POST https://api.singlepana.in/api/v1/generics/wallet/debit/6999af7f6bcfdab90afbe5bc
```

cURL:

```bash
curl -X POST "https://api.singlepana.in/api/v1/generics/wallet/debit/6999af7f6bcfdab90afbe5bc" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer partner-token" \
  -d '{
    "amount": 50,
    "transactionId": "txn-001",
    "roundId": "round-001",
    "game": "aviator"
  }'
```

Success response:

```json
{
  "success": true,
  "data": {
    "playerId": "6999af7f6bcfdab90afbe5bc",
    "balance": 9950,
    "transactionId": "txn-001"
  }
}
```

Duplicate response:

```json
{
  "success": true,
  "duplicate": true,
  "data": {
    "playerId": "6999af7f6bcfdab90afbe5bc",
    "balance": 9950,
    "transactionId": "txn-001"
  }
}
```

### `POST /wallet/credit/:playerId`

Route:

```text
POST https://api.singlepana.in/api/v1/generics/wallet/credit/6999af7f6bcfdab90afbe5bc
```

cURL:

```bash
curl -X POST "https://api.singlepana.in/api/v1/generics/wallet/credit/6999af7f6bcfdab90afbe5bc" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer partner-token" \
  -d '{
    "amount": 70.81,
    "transactionId": "txn-002",
    "roundId": "round-001"
  }'
```

Success response:

```json
{
  "success": true,
  "data": {
    "playerId": "6999af7f6bcfdab90afbe5bc",
    "balance": 10020.81,
    "transactionId": "txn-002"
  }
}
```

Duplicate response:

```json
{
  "success": true,
  "duplicate": true,
  "data": {
    "playerId": "6999af7f6bcfdab90afbe5bc",
    "balance": 10020.81,
    "transactionId": "txn-002"
  }
}
```
