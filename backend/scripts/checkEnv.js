import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env file from backend directory
const envPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: envPath });

console.log('🔍 Checking Environment Variables...\n');
console.log('Environment file path:', envPath);
console.log('File exists:', existsSync(envPath) ? '✅ Yes' : '❌ No');
console.log('\n--- Required Variables ---\n');

const requiredVars = {
    'MONGODB_URI': process.env.MONGODB_URI,
    'PORT': process.env.PORT || '3010 (default)',
    'CLOUDINARY_CLOUD_NAME': process.env.CLOUDINARY_CLOUD_NAME,
    'CLOUDINARY_API_KEY': process.env.CLOUDINARY_API_KEY,
    'CLOUDINARY_API_SECRET': process.env.CLOUDINARY_API_SECRET,
};

let allSet = true;

for (const [key, value] of Object.entries(requiredVars)) {
    const isSet = value && value !== '3010 (default)';
    const status = isSet ? '✅' : '❌';
    const displayValue = isSet 
        ? (key.includes('SECRET') || key.includes('PASSWORD') 
            ? '*'.repeat(20) 
            : value)
        : 'NOT SET';
    
    console.log(`${status} ${key}: ${displayValue}`);
    
    if (!isSet && key !== 'PORT') {
        allSet = false;
    }
}

console.log('\n--- Summary ---\n');

if (allSet) {
    console.log('✅ All required environment variables are set!');
    console.log('✅ Your backend should work correctly.');
} else {
    console.log('❌ Some environment variables are missing!');
    console.log('\n📝 To fix this:');
    console.log('1. Create a .env file in Games/backend/ directory');
    console.log('2. Add the following variables:');
    console.log('\n   MONGODB_URI=mongodb://localhost:27017/offlineBookie');
    console.log('   PORT=3010');
    console.log('   CLOUDINARY_CLOUD_NAME=your_cloud_name  (get from Cloudinary Dashboard)');
    console.log('   CLOUDINARY_API_KEY=your_api_key');
    console.log('   CLOUDINARY_API_SECRET=your_api_secret');
    console.log('   NODE_ENV=development');
    console.log('\n3. Restart your backend server');
}

console.log('\n');
