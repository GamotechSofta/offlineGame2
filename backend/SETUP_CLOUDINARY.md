# Cloudinary Setup - Quick Fix Guide

## 🚨 Error: "Cloudinary credentials not set"

If you're seeing this error, it means the backend `.env` file is missing or doesn't have Cloudinary credentials.

---

## ✅ Quick Fix (3 Steps)

### Step 1: Create .env File

Create a file named `.env` in the `Games/backend/` directory.

**File location:** `Games/backend/.env`

### Step 2: Add Cloudinary Credentials

Copy and paste this into your `.env` file:

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/offlineBookie

# Server Port
PORT=3010

# Cloudinary Configuration (REQUIRED for payment screenshots)
CLOUDINARY_CLOUD_NAME=dzd47mpdo
CLOUDINARY_API_KEY=524934744573422
CLOUDINARY_API_SECRET=BNFxqN-XXuwmmVXCAFGjJZuZtbA

# Environment
NODE_ENV=development
```

### Step 3: Restart Backend Server

**IMPORTANT:** After creating/updating the `.env` file, you MUST restart the backend server:

```bash
# Stop the backend server (Ctrl+C in the terminal)
# Then start it again:
cd Games/backend
npm start
```

---

## 🔍 Verify Setup

### Option 1: Use the Check Script

Run this command to verify your environment variables:

```bash
cd Games/backend
npm run check-env
```

This will show you which variables are set and which are missing.

### Option 2: Manual Check

1. Make sure `.env` file exists in `Games/backend/` directory
2. Open the file and verify all three Cloudinary variables are present:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET`
3. Make sure there are no extra spaces or quotes around the values
4. Restart the backend server

---

## 📝 Complete .env File Example

Here's a complete `.env` file for local development:

```env
# Database Connection
MONGODB_URI=mongodb://localhost:27017/offlineBookie

# Server Configuration
PORT=3010
NODE_ENV=development

# Cloudinary Configuration (REQUIRED)
CLOUDINARY_CLOUD_NAME=dzd47mpdo
CLOUDINARY_API_KEY=524934744573422
CLOUDINARY_API_SECRET=BNFxqN-XXuwmmVXCAFGjJZuZtbA

# Payment Configuration (Optional - has defaults)
UPI_ID=your-upi-id@paytm
UPI_NAME=Your Business Name
MIN_DEPOSIT=100
MAX_DEPOSIT=50000
MIN_WITHDRAWAL=500
MAX_WITHDRAWAL=25000
```

---

## ⚠️ Common Mistakes

### Mistake 1: File in Wrong Location
❌ **Wrong:** `.env` in project root  
✅ **Correct:** `.env` in `Games/backend/` directory

### Mistake 2: Wrong File Name
❌ **Wrong:** `env.txt`, `.env.example`, `env`  
✅ **Correct:** `.env` (with the dot at the beginning)

### Mistake 3: Not Restarting Server
❌ **Wrong:** Creating `.env` but not restarting  
✅ **Correct:** Always restart backend after creating/updating `.env`

### Mistake 4: Extra Spaces or Quotes
❌ **Wrong:** 
```env
CLOUDINARY_CLOUD_NAME = "dzd47mpdo"
CLOUDINARY_API_KEY = 524934744573422
```

✅ **Correct:**
```env
CLOUDINARY_CLOUD_NAME=dzd47mpdo
CLOUDINARY_API_KEY=524934744573422
```

---

## 🧪 Test Cloudinary Connection

After setting up, test if it works:

1. Try to create a deposit request with a screenshot
2. Check backend console for any errors
3. If successful, you should see the image URL in the response

---

## 🚀 For Production Deployment

If deploying to Render, Vercel, or other platforms:

1. **Don't use `.env` file** - use the platform's environment variable settings
2. Go to your deployment platform dashboard
3. Add these environment variables:
   - `CLOUDINARY_CLOUD_NAME=dzd47mpdo`
   - `CLOUDINARY_API_KEY=524934744573422`
   - `CLOUDINARY_API_SECRET=BNFxqN-XXuwmmVXCAFGjJZuZtbA`
4. Redeploy your service

---

## ❓ Still Not Working?

1. **Check backend console logs** - Look for error messages
2. **Run check script:** `npm run check-env`
3. **Verify file location:** Make sure `.env` is in `Games/backend/`
4. **Check file format:** No quotes, no spaces around `=`
5. **Restart backend:** Always restart after changing `.env`

---

## 📞 Quick Checklist

- [ ] `.env` file exists in `Games/backend/` directory
- [ ] File contains `CLOUDINARY_CLOUD_NAME=dzd47mpdo`
- [ ] File contains `CLOUDINARY_API_KEY=524934744573422`
- [ ] File contains `CLOUDINARY_API_SECRET=BNFxqN-XXuwmmVXCAFGjJZuZtbA`
- [ ] No extra spaces or quotes in values
- [ ] Backend server has been restarted after creating `.env`
- [ ] Backend console shows no Cloudinary errors

If all checked, it should work! ✅
