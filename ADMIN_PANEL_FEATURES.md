# Super Admin Panel - Complete Feature List

## Overview
A comprehensive super admin panel with sidebar navigation and full functionality for managing all aspects of the platform.

## Sidebar Navigation

### 1. Markets
- View all markets
- Create new markets
- Edit existing markets
- Delete markets
- Set opening numbers
- Set closing numbers
- Declare win numbers

### 2. Add User
- Create new users with:
  - Username
  - Email
  - Password
  - Phone number
  - Role (User/Bookie)
  - Initial balance
- Automatically creates wallet for new users

### 3. Add New Market
- Quick access to create new markets
- Same functionality as Markets page

### 4. Bet History
- View all bets with filters:
  - By User ID
  - By Market ID
  - By Status (pending/won/lost/cancelled)
  - By Date Range
- Shows bet details:
  - User information
  - Market information
  - Bet type
  - Amount
  - Status
  - Date

### 5. Top Winners
- View top winners with:
  - Total wins
  - Total winnings
  - Win rate percentage
- Filter by time range:
  - All Time
  - Today
  - This Week
  - This Month
- Displays top 50 winners

### 6. Report
- Comprehensive reports with:
  - Total Revenue
  - Total Payouts
  - Net Profit
  - Total Bets
  - Active Users
  - Winning Bets
  - Losing Bets
  - Win Rate
- Filter by date range

### 7. Payment Management
- View all payment requests:
  - Deposits
  - Withdrawals
- Filter by:
  - Status (pending/approved/rejected/completed)
  - Type (deposit/withdrawal)
- Actions:
  - Approve payments
  - Reject payments
  - View payment details

### 8. Wallet
- Two tabs:
  - **User Wallets**: View all user wallets with balances
  - **Transactions**: View all wallet transactions
- Actions:
  - Add balance to user wallet
  - Deduct balance from user wallet
- Shows transaction history

### 9. Help Desk
- View all help desk tickets from users
- Filter by status:
  - Open
  - In Progress
  - Resolved
  - Closed
- Features:
  - View ticket details
  - View screenshots uploaded by users
  - Update ticket status
  - Mark tickets as resolved
  - Close tickets

## Backend APIs

### User Management
- `POST /api/v1/users/create` - Create new user (Admin only)

### Bet Management
- `GET /api/v1/bets/history` - Get bet history with filters (Admin only)
- `GET /api/v1/bets/top-winners` - Get top winners (Admin only)

### Payment Management
- `GET /api/v1/payments` - Get all payments with filters (Admin only)
- `PATCH /api/v1/payments/:id/status` - Update payment status (Admin only)

### Wallet Management
- `GET /api/v1/wallet/all` - Get all user wallets (Admin only)
- `GET /api/v1/wallet/transactions` - Get all transactions (Admin only)
- `POST /api/v1/wallet/adjust` - Adjust user balance (Admin only)

### Reports
- `GET /api/v1/reports` - Get comprehensive reports (Admin only)

### Help Desk
- `POST /api/v1/help-desk/tickets` - Create ticket (Public - for users)
- `GET /api/v1/help-desk/tickets` - Get all tickets (Admin only)
- `PATCH /api/v1/help-desk/tickets/:id/status` - Update ticket status (Admin only)

## Database Models

### User Model
- username, email, password, phone, role, balance, isActive

### Bet Model
- userId, marketId, betType, betNumber, amount, status, payout

### Payment Model
- userId, type, amount, method, status, transactionId, notes

### Wallet Model
- userId, balance

### WalletTransaction Model
- userId, type, amount, description, referenceId

### HelpDesk Model
- userId, subject, description, screenshots[], status, adminResponse

## File Uploads

Help desk tickets support screenshot uploads:
- Maximum 5 images per ticket
- Maximum 5MB per image
- Supported formats: JPEG, JPG, PNG, GIF
- Files stored in `uploads/help-desk/` directory
- Accessible via `/uploads/help-desk/filename`

## Authentication

All admin routes are protected with `verifyAdmin` middleware using Basic Authentication.

## Usage

1. Login to admin panel with credentials:
   - Username: `admin`
   - Password: `admin123`

2. Navigate through sidebar to access different features

3. All changes are saved to database and reflected in real-time

## Notes

- All admin routes require authentication
- File uploads are handled via multer
- Static files are served from `/uploads` directory
- All timestamps are automatically managed by Mongoose
