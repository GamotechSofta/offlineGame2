/**
 * One-time migration: Set source field for existing users based on referredBy.
 * Run: node scripts/migrateUserSource.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/user/user.js';
import connectDB from '../config/db_Connection.js';

dotenv.config();

async function migrate() {
    try {
        await connectDB();
        const users = await User.find({});
        let updated = 0;
        for (const user of users) {
            const source = user.referredBy ? 'bookie' : 'super_admin';
            if (user.source !== source) {
                await User.updateOne({ _id: user._id }, { $set: { source } });
                updated++;
            }
        }
        console.log(`Migration complete. Updated ${updated} users.`);
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

migrate();
