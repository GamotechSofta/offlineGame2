// Script to create .env file for frontend
import { writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envContent = `# Frontend (User Site) Environment Variables
# Update VITE_API_BASE_URL with your actual backend URL

# Backend API Base URL (Required)
# Local development: http://localhost:3010/api/v1
# Production: https://your-backend-domain.com/api/v1
VITE_API_BASE_URL=http://localhost:3010/api/v1

# Frontend URL (Optional - for referral links)
# Local development: http://localhost:5173
# Production: https://your-frontend-domain.com
# VITE_FRONTEND_URL=http://localhost:5173
`;

const envPath = join(__dirname, '.env');

try {
    writeFileSync(envPath, envContent, 'utf8');
    console.log('✅ .env file created successfully!');
    console.log('📁 Location:', envPath);
    console.log('\n📝 Next steps:');
    console.log('1. Restart your frontend dev server (npm run dev)');
    console.log('2. The frontend will now use: http://localhost:3010/api/v1');
    console.log('\n💡 To change the backend URL, edit Games/frontend/.env');
} catch (error) {
    console.error('❌ Error creating .env file:', error.message);
    console.log('\n📝 Manual creation:');
    console.log('1. Create a file named .env in Games/frontend/ directory');
    console.log('2. Add this content:');
    console.log('\n' + envContent);
}
