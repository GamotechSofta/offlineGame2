# Mock Wallet API Reference

Detailed API contract for the local mock wallet server used to test partner balance, debit, and credit flows with Aviator and the central control plane.

## Base URL

```text
http://localhost:4300
```

## Required Headers

```http
Content-Type: application/json
Authorization: Bearer partner-token
```

## Bearer Auth Example

```bash
curl -X POST http://localhost:4300/wallet/balance \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer partner-token" \
  -d '{"playerId":"player-123"}'
```

## Wallet Endpoints

### `POST /wallet/balance`

Purpose: fetch the current wallet balance for a player.

Request:

```json
{
  "playerId": "player-123"
}
```

#### `200 OK`

```json
{
  "success": true,
  "data": {
    "playerId": "player-123",
    "balance": 10000,
    "currency": "INR"
  }
}
```

#### `400 Bad Request`

```json
{
  "success": false,
  "error": "playerId is required"
}
```

#### `401 Unauthorized`

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

#### `404 Not Found`


```json
{
  "success": false,
  "error": "User not found"
}
```

### `POST /wallet/debit`

Purpose: deduct stake from the player wallet when a real bet is placed.

Request:

```json
{
  "playerId": "player-123",
  "amount": 50,
  "transactionId": "txn-001",
  "roundId": "round-001",
  "game": "aviator"
}
```

#### `200 OK`

```json
{
  "success": true,
  "data": {
    "playerId": "player-123",
    "balance": 9950,
    "transactionId": "txn-001"
  }
}
```

#### `200 OK` Duplicate

Returned when the same `transactionId` was already processed.

```json
{
  "success": true,
  "duplicate": true,
  "data": {
    "playerId": "player-123",
    "balance": 9950,
    "transactionId": "txn-001"
  }
}
```

#### `400 Bad Request`

Validation failure:

```json
{
  "success": false,
  "error": "playerId, transactionId, and valid amount are required"
}
```

Insufficient balance:

```json
{
  "success": false,
  "error": "Insufficient balance",
  "data": {
    "playerId": "player-123",
    "balance": 20
  }
}
```

#### `401 Unauthorized`

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

#### `404 Not Found`

Returned when `AUTO_CREATE_USERS=false` and the player does not exist.

```json
{
  "success": false,
  "error": "User not found"
}
```

### `POST /wallet/credit`

Purpose: credit winnings or returned value back to the player wallet.

Request:

```json
{
  "playerId": "player-123",
  "amount": 70.81,
  "transactionId": "txn-002",
  "roundId": "round-001"
}
```

#### `200 OK`

```json
{
  "success": true,
  "data": {
    "playerId": "player-123",
    "balance": 10020.81,
    "transactionId": "txn-002"
  }
}
```

#### `200 OK` Duplicate

Returned when the same `transactionId` was already processed.

```json
{
  "success": true,
  "duplicate": true,
  "data": {
    "playerId": "player-123",
    "balance": 10020.81,
    "transactionId": "txn-002"
  }
}
```

#### `400 Bad Request`

```json
{
  "success": false,
  "error": "playerId, transactionId, and valid amount are required"
}
```

#### `401 Unauthorized`

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

#### `404 Not Found`

Returned when `AUTO_CREATE_USERS=false` and the player does not exist.

```json
{
  "success": false,
  "error": "User not found"
}
```

## Proxy Usage (Production)

Base URL via proxy:

```text
https://api.singlepana.in/api/v1/generics
```

Sample player id used below:

```text
6999af7f6bcfdab90afbe5bc
```

### Common Headers

```http
Content-Type: application/json
Authorization: Bearer partner-token
```

### Balance

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

### Debit

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

### Credit

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