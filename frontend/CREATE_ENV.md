# Create .env File for Frontend

## 🚀 Quick Method (Recommended)

Run this command in the frontend directory:

```bash
cd Games/frontend
npm run create-env
```

This will automatically create the `.env` file with the correct configuration.

---

## 📝 Manual Method

If the script doesn't work, create the file manually:

### Step 1: Create the File

**Location:** `Games/frontend/.env`

**On Windows:**
1. Open File Explorer
2. Navigate to: `Games\frontend\`
3. Right-click → New → Text Document
4. Name it exactly: `.env` (with the dot at the beginning)
   - If Windows asks about the extension, click "Yes"

**On Mac/Linux:**
```bash
cd Games/frontend
touch .env
```

### Step 2: Add This Content

Open the `.env` file and paste this:

```env
# Backend API Base URL (Required)
VITE_API_BASE_URL=http://localhost:3010/api/v1

# Frontend URL (Optional - for referral links)
# VITE_FRONTEND_URL=http://localhost:5173
```

### Step 3: Save and Restart

1. Save the file
2. **IMPORTANT:** Restart your frontend dev server:
   ```bash
   # Stop the server (Ctrl+C)
   # Then start it again:
   npm run dev
   ```

---

## ✅ Verify It's Working

After creating the `.env` file and restarting:

1. Check browser console - no connection errors
2. Try logging in - should connect to backend
3. Check Network tab - API calls should go to `http://localhost:3010/api/v1`

---

## 🔧 For Production Deployment

When deploying to production (Render, Vercel, etc.):

1. **Don't use `.env` file** - use the platform's environment variable settings
2. Go to your deployment platform dashboard
3. Add environment variable:
   - Name: `VITE_API_BASE_URL`
   - Value: `https://your-backend-domain.com/api/v1`
4. Redeploy your service

---

## 📋 Complete .env File Content

Copy this entire block:

```env
# Frontend (User Site) Environment Variables

# Backend API Base URL (Required)
# Local development: http://localhost:3010/api/v1
# Production: https://your-backend-domain.com/api/v1
VITE_API_BASE_URL=http://localhost:3010/api/v1

# Frontend URL (Optional - for referral links)
# Local development: http://localhost:5173
# Production: https://your-frontend-domain.com
# VITE_FRONTEND_URL=http://localhost:5173
```

---

## ⚠️ Important Notes

1. **File Name:** Must be exactly `.env` (with the dot)
2. **Location:** Must be in `Games/frontend/` directory
3. **Restart Required:** Must restart frontend dev server after creating/updating
4. **Vite Prefix:** All variables must start with `VITE_` to work
5. **No Spaces:** No spaces around the `=` sign

---

## 🆘 Troubleshooting

### File Not Working?

1. **Check file name:** Must be `.env` not `env.txt` or `.env.txt`
2. **Check location:** Must be in `Games/frontend/` not project root
3. **Restart server:** Always restart after creating/updating `.env`
4. **Check format:** No spaces, no quotes around values

### Still Getting Connection Errors?

1. Make sure backend is running on port 3010
2. Verify `VITE_API_BASE_URL` is correct
3. Check browser console for specific errors
4. Ensure backend is accessible at `http://localhost:3010`

---

## ✅ Success Checklist

- [ ] `.env` file exists in `Games/frontend/` directory
- [ ] File contains `VITE_API_BASE_URL=http://localhost:3010/api/v1`
- [ ] Frontend dev server has been restarted
- [ ] No connection errors in browser console
- [ ] Can connect to backend API
