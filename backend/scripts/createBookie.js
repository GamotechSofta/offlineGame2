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

        const existingBookie = await Admin.findOne({ username, role: 'bookie' });
        if (existingBookie) {
            console.log(`Bookie with username "${username}" already exists.`);
            process.exit(0);
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        await Admin.collection.insertOne({
            username,
            password: hashedPassword,
            role: 'bookie',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        console.log(`✅ Bookie created successfully!`);
        console.log(`Username: ${username}`);
        console.log(`Password: ${password}`);
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
