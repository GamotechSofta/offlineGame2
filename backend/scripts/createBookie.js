import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import connectDB from '../config/db_Connection.js';

dotenv.config();

const createBookie = async () => {
    try {
        await connectDB();

        const { default: Admin } = await import('../models/admin/admin.js');

        const username = process.argv[2] || 'bookie';
        const password = process.argv[3] || 'bookie123';
        const phone = process.argv[4] || '9876543210';

        // Check if phone is valid (10 digits starting with 6-9)
        const trimmedPhone = phone.replace(/\D/g, '').slice(0, 10);
        if (!/^[6-9]\d{9}$/.test(trimmedPhone)) {
            console.error('❌ Invalid phone number. Must be 10 digits starting with 6-9.');
            console.log('Usage: node createBookie.js [username] [password] [phone]');
            await mongoose.connection.close();
            process.exit(1);
        }

        const existingBookie = await Admin.findOne({ 
            $or: [
                { username, role: 'bookie' },
                { phone: trimmedPhone, role: 'bookie' }
            ]
        });
        if (existingBookie) {
            if (existingBookie.username === username) {
                console.log(`⚠️  Bookie with username "${username}" already exists.`);
            }
            if (existingBookie.phone === trimmedPhone) {
                console.log(`⚠️  Bookie with phone "${trimmedPhone}" already exists.`);
            }
            console.log(`\nTo login, use:`);
            console.log(`Phone: ${existingBookie.phone || 'N/A'}`);
            console.log(`Username: ${existingBookie.username}`);
            process.exit(0);
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await Admin.collection.insertOne({
            username,
            password: hashedPassword,
            role: 'bookie',
            phone: trimmedPhone,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        console.log(`✅ Bookie created successfully!`);
        console.log(`\n📋 Login Credentials:`);
        console.log(`   Phone: ${trimmedPhone}`);
        console.log(`   Username: ${username}`);
        console.log(`   Password: ${password}`);
        console.log(`\n🔐 Login URL: http://localhost:5173 (or your bookie panel URL)`);
        console.log(`\n⚠️  Please change the default password after first login!`);

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Error creating bookie:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
};

createBookie();
