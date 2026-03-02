import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import Admin from '../models/admin/admin.js';
import connectDB from '../config/db_Connection.js';

dotenv.config();

const createAdmin = async () => {
    try {
        await connectDB();
        
        const username = process.argv[2] || 'admin';
        const password = process.argv[3] || 'admin123';

        // Check if admin already exists
        const existingAdmin = await Admin.findOne({ username });
        if (existingAdmin) {
            console.log(`Admin with username "${username}" already exists.`);
            process.exit(0);
        }

        // Hash password manually
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create admin directly in collection to bypass pre-save hook
        await Admin.collection.insertOne({
            username,
            password: hashedPassword,
            role: 'super_admin',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        console.log(`✅ Admin created successfully!`);
        console.log(`Username: ${username}`);
        console.log(`Password: ${password}`);
        console.log(`\n⚠️  Please change the default password after first login!`);
        
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Error creating admin:', error.message);
        await mongoose.connection.close();
        process.exit(1);
    }
};

createAdmin();
