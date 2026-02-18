# Frontend (User Site) Environment Variables Setup

## 📝 Environment Variables

Create a `.env` file in the `Games/frontend/` directory with the following variables:

```env
# Backend API Base URL (Required)
# Replace with your actual backend URL
VITE_API_BASE_URL=https://your-backend-domain.com/api/v1

# Frontend URL (Optional - for referral links)
# Uncomment and update if you need referral links
# VITE_FRONTEND_URL=https://your-frontend-domain.com
```

## 🚀 Deployment Examples

### Render.com
```env
VITE_API_BASE_URL=https://offlinegame2-backend.onrender.com/api/v1
VITE_FRONTEND_URL=https://offlinegame2.onrender.com
```

### Vercel/Netlify
```env
VITE_API_BASE_URL=https://your-backend.vercel.app/api/v1
VITE_FRONTEND_URL=https://your-frontend.vercel.app
```

### Local Development
```env
VITE_API_BASE_URL=http://localhost:3010/api/v1
VITE_FRONTEND_URL=http://localhost:5173
```

## ⚠️ Important Notes

1. **Vite Prefix**: All environment variables must be prefixed with `VITE_` to be accessible in the browser
2. **Rebuild Required**: After adding/changing environment variables, you must rebuild the frontend
3. **HTTPS in Production**: Always use HTTPS URLs in production
4. **Never Commit**: Never commit `.env` files to version control

## ✅ Verification

After setting up environment variables:
1. Rebuild the frontend: `npm run build`
2. Check browser console for any API connection errors
3. Test login functionality to verify backend connection
