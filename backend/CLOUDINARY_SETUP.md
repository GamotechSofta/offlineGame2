# Cloudinary Configuration

## Environment Variables

Get your credentials from the [Cloudinary Dashboard](https://console.cloudinary.com/) and add them to your `.env` file in the `Games/backend/` directory:

```env
# Cloudinary Configuration (get from https://console.cloudinary.com/)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## What Changed

1. **Payment Screenshots**: Payment request screenshots are now uploaded to Cloudinary instead of being stored as Buffer in the database.
2. **Image Storage**: Screenshots are stored in the `payments` folder on Cloudinary.
3. **URL Access**: Screenshots are accessible via Cloudinary URLs and visible to both bookie and superadmin in the payment management pages.

## Backward Compatibility

- Old payments with buffer data will still work via the `/screenshot` endpoint
- New payments will use Cloudinary URLs directly
- The system automatically handles both formats
