# Cloudinary Configuration

## Environment Variables

Add the following environment variables to your `.env` file in the `Games/backend/` directory:

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=dzd47mpdo
CLOUDINARY_API_KEY=524934744573422
CLOUDINARY_API_SECRET=BNFxqN-XXuwmmVXCAFGjJZuZtbA
```

## What Changed

1. **Payment Screenshots**: Payment request screenshots are now uploaded to Cloudinary instead of being stored as Buffer in the database.
2. **Image Storage**: Screenshots are stored in the `payments` folder on Cloudinary.
3. **URL Access**: Screenshots are accessible via Cloudinary URLs and visible to both bookie and superadmin in the payment management pages.

## Backward Compatibility

- Old payments with buffer data will still work via the `/screenshot` endpoint
- New payments will use Cloudinary URLs directly
- The system automatically handles both formats
