# Complete Project Workflow Documentation
## Offline Bookie Platform - RATAN 365

**Version:** 1.0.0  
**Last Updated:** Generated on Analysis  
**Project Type:** Matka Gaming Platform

---

## 📋 TABLE OF CONTENTS

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Complete User Flows](#complete-user-flows)
5. [Technical Stack](#technical-stack)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [Key Features Workflows](#key-features-workflows)
9. [Deployment Process](#deployment-process)
10. [Development Workflow](#development-workflow)

---

## 🎯 PROJECT OVERVIEW

### Project Name
**RATAN 365** - Offline Matka Gaming Platform

### Description
A comprehensive Matka gaming platform with three main panels:
- **User Panel** - For players to place bets, manage wallet, view results
- **Bookie Panel** - For bookies to manage players, place bets, view reports
- **Super Admin Panel** - For system administration, market management, result declaration

### Production URLs
- **Backend:** https://offlinegame2-backend.onrender.com
- **Bookie Panel:** https://offlinegame2.onrender.com/
- **Admin Panel:** https://offlinegame2-admin.onrender.com/
- **User Panel:** (Frontend URL)

---

## 🏗️ SYSTEM ARCHITECTURE

### Project Structure

```
Games/
├── backend/              # Node.js/Express Backend
│   ├── config/          # Database & Cloudinary config
│   ├── controllers/     # Business logic
│   ├── middleware/      # Authentication middleware
│   ├── models/          # MongoDB schemas
│   ├── routes/          # API routes
│   ├── utils/           # Utility functions
│   └── scripts/         # Admin scripts
│
├── frontend/            # User Panel (React + Vite)
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components
│   │   ├── routes/      # Routing configuration
│   │   ├── api/         # API calls
│   │   └── hooks/       # Custom hooks
│
├── bookie/              # Bookie Panel (React + Vite)
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components
│   │   ├── context/     # React Context (Auth, Language)
│   │   └── utils/       # Utility functions
│
├── admin/               # Super Admin Panel (React + Vite)
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components
│   │   └── utils/       # Utility functions
│
└── docs/                # Documentation
```

### Architecture Flow

```
┌─────────────┐
│   User      │
│   Panel     │─────────┐
└─────────────┘         │
                        │
┌─────────────┐         │      ┌──────────────┐
│   Bookie    │─────────┼──────│   Backend    │
│   Panel     │         │      │   (Express)  │
└─────────────┘         │      └──────┬───────┘
                        │             │
┌─────────────┐         │             │
│   Admin     │─────────┘             │
│   Panel     │                       │
└─────────────┘                  ┌─────▼─────┐
                                 │  MongoDB  │
                                 │  Database │
                                 └───────────┘
```

---

## 👥 USER ROLES & PERMISSIONS

### 1. Super Admin
**Role:** `super_admin`  
**Access:** Full system access

**Permissions:**
- ✅ Create/Edit/Delete Markets
- ✅ Declare Opening/Closing Results
- ✅ Manage All Bookies
- ✅ Manage All Users
- ✅ Approve/Reject Payments
- ✅ View All Reports
- ✅ Update Rates
- ✅ View Activity Logs
- ✅ Calculate Daily Commission
- ✅ Market Analytics & Suggestions

### 2. Bookie
**Role:** `bookie`  
**Access:** Limited to own players

**Permissions:**
- ✅ Create/Manage Own Players
- ✅ Place Bets for Own Players
- ✅ View Own Players' Bets
- ✅ View Own Reports & Revenue
- ✅ Manage Player Wallets
- ✅ Edit To Give/To Take
- ✅ Generate Receipts
- ✅ View Own Daily Commission
- ❌ Cannot Declare Results
- ❌ Cannot Manage Other Bookies' Players

### 3. User/Player
**Role:** `user`  
**Access:** Public user panel

**Permissions:**
- ✅ Place Own Bets
- ✅ View Own Bet History
- ✅ Manage Own Wallet
- ✅ Deposit/Withdraw Funds
- ✅ View Market Results
- ✅ View Top Winners
- ❌ Cannot Access Admin/Bookie Panels

---

## 🔄 COMPLETE USER FLOWS

### FLOW 1: User Registration & Login

#### 1.1 User Registration (via Bookie)
```
Bookie Panel → Add User
├── Fill Form (username, email, phone, password)
├── Set Initial Balance (optional)
├── Submit
└── User Created → Linked to Bookie (referredBy)
```

#### 1.2 User Login (User Panel)
```
User Panel → Login Page
├── Enter Phone Number (10 digits)
├── Enter Password
├── Check "Above 18" checkbox
├── Click "Sign In"
└── Authenticated → Redirected to Home
```

**Backend Flow:**
1. Validate phone & password
2. Check user exists & is active
3. Compare password hash
4. Update `lastActiveAt`, `lastLoginIp`, `lastLoginDeviceId`
5. Return user data + balance
6. Frontend stores in localStorage

---

### FLOW 2: Bet Placement (User Panel)

#### 2.1 User Places Bet
```
User Panel → Game Selection
├── Select Market
├── Select Game Type (Single/Jodi/Panna/Sangam)
├── Enter Bet Number
├── Enter Amount
├── Add to Cart (optional)
├── Review Bet
├── Click "Place Bet"
└── Bet Placed → Balance Deducted
```

**Backend Flow:**
1. Validate userId, marketId, bets array
2. Check user is active
3. Check market exists & betting allowed
4. **Atomic Operation:** Check & deduct balance
   ```javascript
   Wallet.findOneAndUpdate(
     { userId, balance: { $gte: totalAmount } },
     { $inc: { balance: -totalAmount } }
   )
   ```
5. Create Bet records
6. Create WalletTransaction records
7. Return new balance

**Race Condition Protection:**
- Uses atomic MongoDB operations
- Balance check & deduction in single operation
- Automatic rollback on failure

---

### FLOW 3: Bet Placement (Bookie for Player)

#### 3.1 Bookie Places Bet for Player
```
Bookie Panel → Player Detail / Game Bid
├── Select Player (from own players)
├── Select Market
├── Select Game Type
├── Enter Bet Details
├── Add to Cart
├── Review
├── Click "Place Bet"
└── Bet Placed → Player's Balance Deducted
```

**Backend Flow:**
1. Verify bookie authentication
2. Verify player belongs to bookie (`referredBy === bookie._id`)
3. Check player is active
4. **Atomic Operation:** Deduct from player's wallet
5. Create Bet with `placedByBookieId` = bookie._id
6. Create WalletTransaction
7. Return success + new balance

---

### FLOW 4: Market Result Declaration

#### 4.1 Declare Opening Result
```
Admin Panel → Markets → View Market
├── Click "Declare Opening"
├── Enter Opening Number (3 digits)
├── Preview Declaration
│   ├── Shows: Total Bets, Total Win Amount, No. of Players
│   ├── Shows: Profit/Loss Calculation
│   └── Shows: Which bets will win
├── Enter Secret Password (if set)
├── Confirm Declaration
└── Opening Declared → Single & Panna Bets Settled
```

**Backend Flow:**
1. Validate opening number (3 digits)
2. Check market not already closed
3. Update market `openingNumber`
4. Find all pending bets for this market (OPEN session)
5. For each bet:
   - Single Digit: Check if matches last digit of opening
   - Panna: Check if matches opening number
   - If won: Update status to 'won', calculate payout, credit wallet
   - If lost: Update status to 'lost'
6. Jodi & Full Sangam remain pending (wait for closing)

#### 4.2 Declare Closing Result
```
Admin Panel → Markets → View Market
├── Click "Declare Closing"
├── Enter Closing Number (3 digits)
├── Preview Declaration
│   ├── Shows: Total Bets, Total Win Amount
│   ├── Shows: Profit/Loss
│   └── Shows: Which bets will win
├── Enter Secret Password (if set)
├── Confirm Declaration
└── Closing Declared → All Remaining Bets Settled
```

**Backend Flow:**
1. Validate closing number (3 digits)
2. Check opening is already declared
3. Update market `closingNumber`
4. Calculate Jodi (last digit of opening + last digit of closing)
5. Find all pending bets
6. For each bet:
   - Jodi: Check if matches calculated jodi
   - Half Sangam: Check format (Open Pana - Open Ank / Open Ank - Close Pana)
   - Full Sangam: Check if matches "opening-closing"
   - If won: Update status, calculate payout, credit wallet
   - If lost: Update status to 'lost'
7. Market marked as closed

---

### FLOW 5: Wallet Deposit

#### 5.1 User Requests Deposit
```
User Panel → Funds → Add Fund
├── Enter Amount (₹100 - ₹50,000)
├── Enter UTR/Transaction ID (12 digits)
├── Upload Payment Screenshot
├── Submit Request
└── Request Created → Status: 'pending'
```

**Backend Flow:**
1. Validate amount (min/max limits)
2. Validate UTR format (12 digits)
3. Upload screenshot to Cloudinary
4. Create Payment record:
   - type: 'deposit'
   - status: 'pending'
   - amount, upiTransactionId, screenshotUrl
5. Return success (wallet NOT updated yet)

#### 5.2 Admin Approves Deposit
```
Admin Panel → Payment Management
├── View Pending Deposits
├── Review Request (amount, UTR, screenshot)
├── Click "Approve"
├── Enter Admin Remarks (optional)
├── Enter Secret Password (if required)
└── Deposit Approved → Wallet Credited
```

**Backend Flow:**
1. Verify admin authentication
2. Check payment is pending
3. Update payment status to 'approved'
4. **Atomic Operation:** Credit wallet
   ```javascript
   Wallet.findOneAndUpdate(
     { userId },
     { $inc: { balance: amount } }
   )
   ```
5. Create WalletTransaction (type: 'credit')
6. Log activity

---

### FLOW 6: Wallet Withdrawal

#### 6.1 User Requests Withdrawal
```
User Panel → Funds → Withdraw
├── Select Bank Account
├── Enter Amount (₹500 - ₹25,000)
├── Add Note (optional)
├── Submit Request
└── Request Created → Status: 'pending'
```

**Backend Flow:**
1. Validate amount (min/max limits)
2. Check wallet balance >= amount
3. Check no pending withdrawal exists
4. Validate bank account
5. Create Payment record:
   - type: 'withdrawal'
   - status: 'pending'
   - amount, bankDetailId
6. Return success (wallet NOT debited yet)

#### 6.2 Admin Approves Withdrawal
```
Admin Panel → Payment Management
├── View Pending Withdrawals
├── Review Request
├── Click "Approve"
└── Withdrawal Approved → Wallet Debited
```

**Backend Flow:**
1. Verify admin authentication
2. Check payment is pending
3. Re-check wallet balance (may have changed)
4. Update payment status to 'approved'
5. **Atomic Operation:** Debit wallet
6. Create WalletTransaction (type: 'debit')
7. Log activity

---

### FLOW 7: Daily Commission Calculation

#### 7.1 Automatic Commission (Midnight)
```
Scheduler (Backend) → Daily at 12:00 AM IST
├── For Each Active Bookie:
│   ├── Get All Players (referredBy = bookie._id)
│   ├── Calculate Total Revenue (sum of all bet amounts for the day)
│   ├── Get Bookie's Commission Percentage
│   ├── Calculate Commission = (Total Revenue × Commission %)
│   ├── Create/Update DailyCommission Record
│   └── Store: date, totalRevenue, commissionAmount, totalBets
└── Commission Calculated for All Bookies
```

**Backend Flow:**
1. Get all active bookies
2. For each bookie:
   - Get all users referred by this bookie
   - Aggregate bets for today (IST)
   - Calculate total revenue
   - Calculate commission on total revenue
   - Create/Update DailyCommission record
3. Commission is calculated on **total daily revenue**, not per bet

**Manual Trigger:**
- Admin can manually trigger via API: `POST /api/v1/daily-commission/calculate`

---

### FLOW 8: Receipt Generation

#### 8.1 Automatic Receipt (After Bet Placement)
```
Bookie Places Bet for Player
├── Bet Placed Successfully
├── Backend Groups Bets (same userId, marketId, within 5 seconds)
├── Creates Bet Session
└── Receipt Available in Receipt Tab
```

#### 8.2 Manual Receipt Creation
```
Bookie Panel → Create Receipt
├── Select Player
├── Select Market
├── Enter Bet Details
│   ├── Bet Type
│   ├── Bet Number
│   ├── Amount
│   └── Session (Open/Close)
├── Enter Commission (%)
├── Enter Paid Amount
├── Enter Cutting Amount
├── Generate Receipt
└── Receipt Created → Can Print/Download
```

**Receipt Calculations:**
- Total Bet Amount = Sum of all bet amounts
- Commission = (Total Bet Amount × Commission %)
- Remaining to Pay = Total Bet Amount - Commission
- Final Total = Remaining to Pay - Paid - Cutting

---

### FLOW 9: To Give / To Take Management

#### 9.1 Update To Give/To Take
```
Bookie Panel → Player Detail → Receipt Tab
├── View Current To Give / To Take
├── Click "Edit"
├── Enter New Values
├── Save
└── Updated → Reflected Everywhere
```

**Backend Flow:**
1. Verify bookie owns this player
2. Update user `toGive` and `toTake` fields
3. These are separate from wallet balance
4. Used for tracking money owed between bookie and player

**Where It's Used:**
- Player Profile
- Reports
- Receipt Calculations
- Dashboard Statistics

---

### FLOW 10: Market Reset (Midnight)

#### 10.1 Automatic Market Result Reset
```
Scheduler (Backend) → Daily at 12:00 AM IST
├── For Each Market:
│   ├── Create MarketResult Snapshot
│   │   ├── Store: openingNumber, closingNumber, result
│   │   ├── Store: date (IST date key)
│   │   └── Store: marketId
│   ├── Reset Market
│   │   ├── openingNumber = null
│   │   ├── closingNumber = null
│   │   └── result = null
│   └── Market Ready for New Day
└── All Markets Reset
```

**Purpose:**
- Preserve yesterday's results
- Clear today's results for new betting
- Maintain historical data

---

## 🛠️ TECHNICAL STACK

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js 5.x
- **Database:** MongoDB (Mongoose ODM)
- **Authentication:** Custom JWT-like (Basic Auth)
- **File Upload:** Multer + Cloudinary
- **PDF Generation:** PDFKit
- **Scheduling:** setInterval (midnight tasks)

### Frontend (All Panels)
- **Framework:** React 18+
- **Build Tool:** Vite
- **Routing:** React Router DOM
- **Styling:** Tailwind CSS
- **Icons:** React Icons
- **State Management:** React Context API + useState/useEffect

### Database
- **MongoDB:** Document-based NoSQL database
- **Collections:**
  - Users
  - Admins (Bookies + Super Admin)
  - Bets
  - Markets
  - Wallets
  - WalletTransactions
  - Payments
  - BankDetails
  - MarketResults
  - Rates
  - DailyCommissions
  - HelpDeskTickets
  - ActivityLogs

---

## 🗄️ DATABASE SCHEMA

### User Model
```javascript
{
  username: String (unique, required)
  email: String (unique, required)
  password: String (hashed, required)
  phone: String (10 digits, required for login)
  role: 'user' | 'bookie'
  balance: Number (default: 0)
  isActive: Boolean (default: true)
  source: 'super_admin' | 'bookie'
  referredBy: ObjectId (ref: Admin) // Bookie who referred this user
  toGive: Number (default: 0) // Money bookie owes player
  toTake: Number (default: 0) // Money player owes bookie
  lastActiveAt: Date
  lastLoginIp: String
  lastLoginDeviceId: String
  loginDevices: Array
  createdAt: Date
  updatedAt: Date
}
```

### Bet Model
```javascript
{
  userId: ObjectId (ref: User, required)
  marketId: ObjectId (ref: Market, required)
  betOn: 'open' | 'close' // Session
  betType: 'single' | 'jodi' | 'panna' | 'half-sangam' | 'full-sangam'
  betNumber: String (required) // e.g., "5", "12", "123", "123-456"
  amount: Number (required, min: 0)
  status: 'pending' | 'won' | 'lost' | 'cancelled'
  payout: Number (default: 0)
  scheduledDate: Date (optional)
  isScheduled: Boolean (default: false)
  placedByBookie: Boolean (default: false)
  placedByBookieId: ObjectId (ref: Admin)
  commissionAmount: Number (default: 0) // Now 0, calculated daily
  commissionPercentage: Number (default: 0) // Now 0, calculated daily
  createdAt: Date
  updatedAt: Date
}
```

### Market Model
```javascript
{
  marketType: 'main' | 'startline'
  starlineGroup: String (for startline markets)
  marketName: String (unique, required)
  startingTime: String (HH:MM format)
  closingTime: String (HH:MM format)
  betClosureTime: Number (seconds before closing)
  openingNumber: String (3 digits, e.g., "123")
  closingNumber: String (3 digits, e.g., "456")
  result: String (computed: "123-65-456")
  winNumber: String (optional, admin-declared)
  createdAt: Date
  updatedAt: Date
}
```

### Wallet Model
```javascript
{
  userId: ObjectId (ref: User, unique, required)
  balance: Number (default: 0, min: 0)
  createdAt: Date
  updatedAt: Date
}
```

### WalletTransaction Model
```javascript
{
  userId: ObjectId (ref: User, required)
  type: 'credit' | 'debit'
  amount: Number (required, min: 0)
  description: String
  referenceId: String (bet ID or payment ID)
  createdAt: Date
  updatedAt: Date
}
```

### Payment Model
```javascript
{
  userId: ObjectId (ref: User, required)
  type: 'deposit' | 'withdrawal'
  amount: Number (required, min: 0)
  method: 'upi' | 'bank_transfer' | 'wallet' | 'cash'
  status: 'pending' | 'approved' | 'rejected' | 'completed'
  screenshotUrl: String (for deposits)
  upiTransactionId: String (UTR)
  userNote: String
  adminRemarks: String
  processedBy: ObjectId (ref: Admin)
  processedAt: Date
  bankDetailId: ObjectId (ref: BankDetail, for withdrawals)
  createdAt: Date
  updatedAt: Date
}
```

### DailyCommission Model
```javascript
{
  bookieId: ObjectId (ref: Admin, required)
  date: Date (IST date, start of day)
  totalRevenue: Number (sum of all bet amounts for the day)
  commissionPercentage: Number (bookie's commission %)
  commissionAmount: Number (calculated commission)
  totalBets: Number
  totalPayouts: Number
  status: 'pending' | 'processed' | 'failed'
  processedAt: Date
  createdAt: Date
  updatedAt: Date
}
```

### Admin Model
```javascript
{
  username: String (unique, required)
  email: String (unique, required)
  password: String (hashed, required)
  phone: String (required)
  role: 'super_admin' | 'bookie'
  status: 'active' | 'suspended'
  commissionPercentage: Number (for bookies)
  secretDeclarePassword: String (hashed, optional)
  uiTheme: Object (optional)
  createdAt: Date
  updatedAt: Date
}
```

---

## 🔌 API ENDPOINTS

### Base URL
```
Production: https://offlinegame2-backend.onrender.com/api/v1
Local: http://localhost:3010/api/v1
```

### Authentication
- **Method:** Basic Auth (username:password in Authorization header)
- **Bookie/Admin:** Uses `verifyAdmin` middleware
- **Super Admin Only:** Uses `verifySuperAdmin` middleware

### User Routes (`/api/v1/users`)
```
POST   /login              # User login (phone + password)
POST   /signup             # User signup (public, but signup removed from frontend)
POST   /heartbeat          # Update lastActiveAt
GET    /                   # Get users (admin/bookie - filtered)
GET    /:id                # Get single user
POST   /create             # Create user (admin/bookie)
PATCH  /:id/toggle-status  # Suspend/activate user (super admin only)
DELETE /:id                # Delete user (super admin only)
PATCH  /:id/clear-devices  # Clear login devices
PATCH  /:id/to-give-take   # Update toGive/toTake
```

### Bet Routes (`/api/v1/bets`)
```
POST   /place              # User places bet (public)
POST   /place-for-player   # Bookie places bet for player (auth required)
GET    /public/top-winners # Public top winners
GET    /my-statement       # User's bet statement (public)
GET    /history            # Bet history (admin/bookie)
GET    /by-user            # Bets grouped by user (admin/bookie)
GET    /sessions           # Bet sessions (admin/bookie)
GET    /top-winners        # Top winners (admin/bookie)
GET    /download-statement # Download statement (admin/bookie)
```

### Market Routes (`/api/v1/markets`)
```
GET    /get-markets                    # Get all markets (public)
GET    /get-market/:id                 # Get market by ID (public)
GET    /result-history                 # Market result history (public)
GET    /get-market-stats/:id           # Market statistics (admin)
GET    /get-single-patti-summary/:id   # Single patti summary (admin)
GET    /get-market-bets/:id             # Market bets (admin)
GET    /preview-declare-open/:id        # Preview open declaration (super admin)
GET    /preview-declare-close/:id       # Preview close declaration (super admin)
GET    /winning-bets-preview/:id       # Winning bets preview (super admin)
POST   /declare-open/:id                # Declare opening result (super admin)
POST   /declare-close/:id               # Declare closing result (super admin)
POST   /clear-result/:id                # Clear market result (super admin)
POST   /create-market                   # Create market (super admin only)
PATCH  /update-market/:id                # Update market (super admin only)
PATCH  /set-opening-number/:id           # Set opening number (super admin only)
PATCH  /set-closing-number/:id           # Set closing number (super admin only)
PATCH  /set-win-number/:id               # Set win number (super admin only)
DELETE /delete-market/:id                # Delete market (super admin only)
```

### Payment Routes (`/api/v1/payments`)
```
GET    /config              # Get payment config (public)
POST   /deposit             # Create deposit request (public)
POST   /withdraw            # Create withdrawal request (public)
GET    /my-deposits         # User's deposits (public)
GET    /my-withdrawals      # User's withdrawals (public)
GET    /                    # Get payments (admin)
GET    /pending-count       # Pending payments count (admin)
POST   /:id/approve         # Approve payment (admin)
POST   /:id/reject          # Reject payment (admin)
PATCH  /:id/status          # Update payment status (super admin only)
```

### Wallet Routes (`/api/v1/wallet`)
```
GET    /balance             # Get wallet balance (public with userId)
GET    /transactions         # Get transactions (admin/bookie)
GET    /my-transactions      # User's transactions (public)
POST   /adjust              # Adjust balance (admin/bookie)
PUT    /set-balance          # Set balance (admin/bookie)
```

### Report Routes (`/api/v1/reports`)
```
GET    /                    # Get reports (admin/bookie)
GET    /revenue             # Revenue report (admin/bookie)
GET    /customer-balance    # Customer balance overview (bookie)
GET    /revenue/:bookieId    # Bookie revenue detail (admin)
```

### Daily Commission Routes (`/api/v1/daily-commission`)
```
POST   /calculate           # Calculate daily commission (super admin/scheduler)
GET    /                    # Get daily commissions (bookie - own, admin - all)
GET    /all                 # Get all daily commissions (super admin only)
```

### Rate Routes (`/api/v1/rates`)
```
GET    /current             # Get current rates (public)
GET    /                    # Get rates (admin)
POST   /update              # Update rates (super admin only)
```

### Dashboard Routes (`/api/v1/dashboard`)
```
GET    /stats               # Get dashboard statistics (admin/bookie)
```

---

## 🎮 KEY FEATURES WORKFLOWS

### Feature 1: Bet Types & Validation

#### Single Digit
- **Format:** 0-9 (single digit)
- **Session:** Open or Close
- **Settlement:** On opening (if open session) or closing (if close session)
- **Rate:** Default 10x (configurable)

#### Jodi
- **Format:** 00-99 (two digits)
- **Session:** Always Close (settled on closing)
- **Settlement:** When closing is declared
- **Calculation:** Last digit of opening + Last digit of closing
- **Rate:** Default 100x

#### Panna (Single/Double/Triple Patti)
- **Format:** 000-999 (three digits)
- **Types:**
  - Single Patti: All different (e.g., 123) → 150x
  - Double Patti: Two same (e.g., 112) → 300x
  - Triple Patti: All same (e.g., 111) → 1000x
- **Session:** Open or Close
- **Settlement:** On opening (if open session) or closing (if close session)

#### Half Sangam
- **Format:** "123-5" (Open Pana - Open Ank) or "5-123" (Open Ank - Close Pana)
- **Session:** Open (for Open-Open) or Close (for Open-Close)
- **Settlement:** When both opening and closing are declared
- **Rate:** Default 5000x

#### Full Sangam
- **Format:** "123-456" (Open Pana - Close Pana)
- **Session:** Always Close
- **Settlement:** When closing is declared
- **Rate:** Default 10000x

---

### Feature 2: Scheduled Bets

#### How It Works
```
User/Bookie → Place Bet
├── Select Future Date
├── Enter Bet Details
├── Place Bet
└── Bet Saved with isScheduled = true
```

**Backend Logic:**
- Bet stored with `scheduledDate` and `isScheduled = true`
- Bet NOT settled until `scheduledDate <= today`
- When declaring results, only bets with `scheduledDate <= today` are considered
- Allows placing bets for future dates

---

### Feature 3: Market Analytics & Suggestions

#### Admin Panel → Market Detail → Analytics Tab

**Analytics Provided:**
1. **Most Profitable Number**
   - Calculates profit/loss for each number
   - Shows which number would give maximum profit if declared

2. **Most Risky Number**
   - Shows which number has highest potential payout
   - Indicates risk level

3. **Most Popular Number**
   - Shows which number has most bets
   - Indicates player preference

**Separate Analytics for:**
- Opening Session
- Closing Session

---

### Feature 4: Language Switching

#### Implementation
```
Bookie/Admin Panel → Language Button
├── Click Language Button
├── Select: Hindi / Marathi / English
└── Language Changed → All Pages Translated
```

**Technical:**
- Uses React Context API (`LanguageContext`)
- Translation files: `en.js`, `hi.js`, `mr.js`
- Stored in localStorage
- All pages support language switching

---

### Feature 5: Receipt System

#### Receipt Types

**1. Automatic Receipt (Bet Session)**
- Generated when bookie places bets for player
- Groups bets placed within 5 seconds
- Shows: Player info, Market info, All bets, Totals

**2. Manual Receipt**
- Created via "Create Receipt" page
- Bookie can manually enter all details
- Can edit: Commission %, Paid, Cutting
- Calculations: Total - Commission - Paid - Cutting = Final

**Receipt Fields:**
- Player Name, Phone
- Market Name, Date
- All Bets (Type, Number, Amount, Session)
- Total Bet Amount
- Commission (% and Amount)
- Paid Amount
- Cutting Amount
- Final Total
- To Give / To Take

---

## 🚀 DEPLOYMENT PROCESS

### Backend Deployment (Render)

1. **Connect Repository**
   - Link GitHub repository to Render
   - Select `Games/backend` as root directory

2. **Environment Variables**
   ```env
   MONGODB_URI=mongodb+srv://...
   PORT=10000
   ALLOWED_ORIGINS=https://offlinegame2.onrender.com,https://offlinegame2-admin.onrender.com
   CLOUDINARY_CLOUD_NAME=...
   CLOUDINARY_API_KEY=...
   CLOUDINARY_API_SECRET=...
   NODE_ENV=production
   ```

3. **Build & Start Commands**
   - Build: (not needed for Node.js)
   - Start: `node index.js`

4. **Health Check**
   - Path: `/`
   - Expected: "Hello World!"

### Bookie Panel Deployment (Render)

1. **Connect Repository**
   - Select `Games/bookie` as root directory

2. **Environment Variables**
   ```env
   VITE_API_BASE_URL=https://offlinegame2-backend.onrender.com/api/v1
   VITE_FRONTEND_URL=https://offlinegame2.onrender.com
   ```

3. **Build & Start Commands**
   - Build: `npm run build`
   - Start: `npm run preview` (or serve static files)

### Admin Panel Deployment (Render)

1. **Connect Repository**
   - Select `Games/admin` as root directory

2. **Environment Variables**
   ```env
   VITE_API_BASE_URL=https://offlinegame2-backend.onrender.com/api/v1
   ```

3. **Build & Start Commands**
   - Build: `npm run build`
   - Start: `npm run preview` (or serve static files)

### User Panel Deployment

1. **Connect Repository**
   - Select `Games/frontend` as root directory

2. **Environment Variables**
   ```env
   VITE_API_BASE_URL=https://offlinegame2-backend.onrender.com/api/v1
   ```

3. **Build & Start Commands**
   - Build: `npm run build`
   - Start: Serve static files

---

## 💻 DEVELOPMENT WORKFLOW

### Local Development Setup

#### 1. Backend Setup
```bash
cd Games/backend
npm install
# Create .env file
echo "MONGODB_URI=mongodb://localhost:27017/offlineBookie" > .env
echo "PORT=3010" >> .env
npm run dev
```

#### 2. Frontend Setup (User Panel)
```bash
cd Games/frontend
npm install
# Create .env file
echo "VITE_API_BASE_URL=http://localhost:3010/api/v1" > .env
npm run dev
```

#### 3. Bookie Panel Setup
```bash
cd Games/bookie
npm install
# Create .env file
echo "VITE_API_BASE_URL=http://localhost:3010/api/v1" > .env
npm run dev
```

#### 4. Admin Panel Setup
```bash
cd Games/admin
npm install
# Create .env file
echo "VITE_API_BASE_URL=http://localhost:3010/api/v1" > .env
npm run dev
```

### Creating Initial Admin/Bookie

#### Create Super Admin
```bash
cd Games/backend
npm run create-admin
# Follow prompts: username, email, phone, password
```

#### Create Bookie
```bash
cd Games/backend
npm run create-bookie
# Follow prompts: username, email, phone, password, commission %
```

### Development Best Practices

1. **Code Organization**
   - Controllers: Business logic
   - Models: Database schemas
   - Routes: API endpoints
   - Utils: Reusable functions

2. **Error Handling**
   - Always use try-catch
   - Return proper HTTP status codes
   - Provide meaningful error messages

3. **Security**
   - Never expose passwords
   - Validate all inputs
   - Use atomic operations for financial transactions
   - Implement proper authentication

4. **Testing**
   - Test bet placement with concurrent requests
   - Test wallet operations
   - Test result declaration
   - Test payment flows

---

## 📊 DATA FLOW DIAGRAMS

### Bet Placement Flow
```
User/Bookie
    │
    ├─→ Frontend Validation
    │   ├─ Amount > 0
    │   ├─ Amount <= Max
    │   └─ Bet Number Valid
    │
    ├─→ API Call: POST /bets/place
    │   │
    │   ├─→ Backend Validation
    │   │   ├─ User exists & active
    │   │   ├─ Market exists
    │   │   └─ Betting allowed
    │   │
    │   ├─→ Atomic Balance Check & Deduct
    │   │   └─ Wallet.findOneAndUpdate(
    │   │       { userId, balance: { $gte: amount } },
    │   │       { $inc: { balance: -amount } }
    │   │     )
    │   │
    │   ├─→ Create Bet Record(s)
    │   │
    │   ├─→ Create WalletTransaction(s)
    │   │
    │   └─→ Return Success + New Balance
    │
    └─→ Frontend Updates Balance
        └─ Dispatch 'balanceUpdated' Event
```

### Result Declaration Flow
```
Admin
    │
    ├─→ Select Market
    │
    ├─→ Declare Opening
    │   ├─ Enter Opening Number (3 digits)
    │   ├─ Preview Declaration
    │   │   ├─ Calculate: Total Bets, Win Amount, Profit
    │   │   └─ Show: Which bets will win
    │   ├─ Enter Secret Password (if required)
    │   └─ Confirm
    │       │
    │       ├─→ Update Market.openingNumber
    │       │
    │       ├─→ Find Pending Bets (OPEN session)
    │       │
    │       ├─→ For Each Bet:
    │       │   ├─ Single Digit: Check last digit
    │       │   ├─ Panna: Check full number
    │       │   ├─ If Won:
    │       │   │   ├─ Update status = 'won'
    │       │   │   ├─ Calculate payout
    │       │   │   └─ Credit wallet
    │       │   └─ If Lost:
    │       │       └─ Update status = 'lost'
    │       │
    │       └─ Jodi & Full Sangam remain pending
    │
    └─→ Declare Closing
        ├─ Enter Closing Number (3 digits)
        ├─ Preview Declaration
        ├─ Enter Secret Password (if required)
        └─ Confirm
            │
            ├─→ Update Market.closingNumber
            │
            ├─→ Calculate Jodi (last digit open + last digit close)
            │
            ├─→ Find All Pending Bets
            │
            ├─→ For Each Bet:
            │   ├─ Jodi: Check calculated jodi
            │   ├─ Half Sangam: Check format
            │   ├─ Full Sangam: Check "open-close"
            │   ├─ If Won: Update, calculate payout, credit
            │   └─ If Lost: Update status
            │
            └─ Market marked as closed
```

### Payment Flow
```
User
    │
    ├─→ Deposit Request
    │   ├─ Enter Amount
    │   ├─ Enter UTR
    │   ├─ Upload Screenshot
    │   └─ Submit
    │       │
    │       └─→ Create Payment (status: 'pending')
    │           └─ Wallet NOT updated
    │
    └─→ Withdrawal Request
        ├─ Select Bank Account
        ├─ Enter Amount
        └─ Submit
            │
            └─→ Create Payment (status: 'pending')
                └─ Wallet NOT updated

Admin
    │
    ├─→ View Pending Payments
    │
    ├─→ Approve Deposit
    │   └─→ Atomic Operation:
    │       ├─ Update Payment (status: 'approved')
    │       └─ Credit Wallet
    │
    └─→ Approve Withdrawal
        └─→ Atomic Operation:
            ├─ Update Payment (status: 'approved')
            └─ Debit Wallet
```

---

## 🔐 SECURITY FEATURES

### Authentication
- **Method:** Basic Auth (username:password)
- **Storage:** localStorage (frontend)
- **Middleware:** `verifyAdmin` for protected routes
- **Session:** No expiration (stored in localStorage)

### Data Protection
- **Password Hashing:** bcryptjs (salt rounds: 10)
- **Atomic Operations:** MongoDB atomic updates for financial transactions
- **Input Validation:** Client-side + Server-side
- **CORS:** Configurable allowed origins

### Financial Security
- **Race Condition Protection:** Atomic balance operations
- **Transaction Rollback:** Automatic on errors
- **Balance Validation:** Always check before operations
- **Commission Calculation:** Daily, not per-bet

---

## 📱 RESPONSIVE DESIGN

### Breakpoints
- **Mobile:** < 640px
- **Tablet:** 640px - 1024px
- **Desktop:** > 1024px

### Mobile Optimizations
- Touch-friendly buttons (min 44x44px)
- Bottom navigation bar
- Hamburger menu
- Scrollable content areas
- Safe area insets for iOS

---

## 🎨 THEME & STYLING

### Color Scheme
- **Primary:** Orange (#f97316, orange-500)
- **Background:** White (#ffffff)
- **Text:** Gray-800 (primary), Gray-600 (secondary)
- **Accents:** Orange-600, Orange-50
- **Borders:** Orange-200, Orange-300

### UI Components
- Cards: White background, orange borders
- Buttons: Orange gradient, white text
- Status Badges: Color-coded (orange/green/red)
- Forms: White background, gray borders, orange focus

---

## 🔄 SCHEDULED TASKS

### 1. Midnight Market Reset
- **Time:** 12:00 AM IST (daily)
- **Function:** `startMidnightResetScheduler()`
- **Location:** `Games/backend/utils/midnightReset.js`
- **Action:**
  - Create MarketResult snapshots
  - Reset all markets (openingNumber, closingNumber, result = null)

### 2. Daily Commission Calculation
- **Time:** End of day (can be triggered manually)
- **Function:** `calculateDailyCommission()`
- **Location:** `Games/backend/controllers/dailyCommissionController.js`
- **Action:**
  - Calculate commission for all bookies
  - Store in DailyCommission collection

---

## 📈 ANALYTICS & REPORTING

### Dashboard Statistics (Bookie)
- Total Bet Amount
- To Received
- To Give
- Total Profit
- Pending
- Total Players
- Total Bets

### Dashboard Statistics (Admin)
- Total Revenue
- Net Profit
- Total Players
- Total Bets
- Total Bookies
- Active Markets

### Reports
- Customer Balance Overview
- Revenue Reports
- Bet History Reports
- Payment Reports

---

## 🐛 ERROR HANDLING

### Client-Side
- Try-catch blocks
- Error state management
- User-friendly error messages
- Loading states

### Server-Side
- Try-catch in all controllers
- Proper HTTP status codes
- Detailed error logging
- Graceful error responses

### Common Errors
- **400:** Bad Request (validation errors)
- **401:** Unauthorized (authentication failed)
- **403:** Forbidden (insufficient permissions)
- **404:** Not Found (resource doesn't exist)
- **409:** Conflict (duplicate entry)
- **500:** Internal Server Error

---

## 📝 LOGGING & ACTIVITY TRACKING

### Activity Log Model
- **Actions Logged:**
  - User signup/login
  - Bet placement
  - Result declaration
  - Payment approval/rejection
  - User creation/deletion
  - Market creation/update

### Log Fields
- action: String (e.g., 'bet_placed')
- performedBy: String (username)
- performedByType: String ('user' | 'bookie' | 'admin')
- targetType: String
- targetId: String
- details: String
- meta: Object
- ip: String

---

## 🧪 TESTING CHECKLIST

### Functional Testing
- [x] User registration/login
- [x] Bet placement (all types)
- [x] Result declaration
- [x] Payment approval
- [x] Wallet operations
- [x] Receipt generation
- [x] Reports generation
- [x] Language switching

### Security Testing
- [x] Race condition protection
- [x] Atomic operations
- [x] Input validation
- [x] Authentication checks

### Performance Testing
- [ ] Load testing (concurrent bets)
- [ ] Database query optimization
- [ ] API response times

---

## 📚 ADDITIONAL RESOURCES

### Documentation Files
- `FUNCTIONAL_TEST_REPORT.md` - Complete test results
- `BUG_FIXES_SUMMARY.md` - All bugs fixed
- `THEME_UPDATE_COMPLETE.md` - Theme changes
- `DEPLOYMENT_CONFIG.md` - Deployment guide
- `DEPLOYMENT_ENV_VARIABLES.md` - Environment variables

### Scripts
- `createAdmin.js` - Create super admin
- `createBookie.js` - Create bookie
- `fixReferredBy.js` - Fix referral relationships
- `migrateUserSource.js` - Migrate user sources

---

## ✅ QUICK REFERENCE

### Common Tasks

**Create Super Admin:**
```bash
cd Games/backend
npm run create-admin
```

**Create Bookie:**
```bash
cd Games/backend
npm run create-bookie
```

**Start Development:**
```bash
# Backend
cd Games/backend && npm run dev

# User Panel
cd Games/frontend && npm run dev

# Bookie Panel
cd Games/bookie && npm run dev

# Admin Panel
cd Games/admin && npm run dev
```

**Calculate Daily Commission:**
```bash
POST /api/v1/daily-commission/calculate
Body: { date: "2024-01-15" } // Optional, defaults to yesterday
```

---

## 🎯 FUTURE ENHANCEMENTS

### Recommended Improvements
1. **Real-time Updates**
   - WebSocket for balance updates
   - Live bet count
   - Real-time market status

2. **Notification System**
   - Email/SMS notifications
   - In-app notifications
   - Payment status updates

3. **Advanced Analytics**
   - Player behavior analysis
   - Market trends
   - Profit/loss forecasting

4. **Security Enhancements**
   - JWT tokens with expiration
   - Refresh token mechanism
   - Rate limiting
   - 2FA for admins

5. **Performance**
   - Database indexing optimization
   - Caching layer (Redis)
   - CDN for static assets

---

**End of Complete Project Workflow Documentation**

*This document provides a comprehensive overview of the entire project workflow, from user interactions to technical implementation. Use this as a reference for development, deployment, and maintenance.*
