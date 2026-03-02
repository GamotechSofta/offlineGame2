/**
 * Migration script to fix referredBy field from string to ObjectId
 * Run: node scripts/fixReferredBy.js
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

async function fixReferredBy() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');

        // Find all users where referredBy is a string (not null and not ObjectId)
        const users = await usersCollection.find({
            referredBy: { $ne: null, $type: 'string' }
        }).toArray();

        console.log(`Found ${users.length} users with string referredBy`);

        let fixed = 0;
        for (const user of users) {
            const refId = user.referredBy;
            if (refId && mongoose.Types.ObjectId.isValid(refId)) {
                await usersCollection.updateOne(
                    { _id: user._id },
                    { $set: { referredBy: new mongoose.Types.ObjectId(refId) } }
                );
                console.log(`Fixed user: ${user.username} (${user._id})`);
                fixed++;
            } else {
                console.log(`Skipped user: ${user.username} - invalid referredBy: ${refId}`);
            }
        }

        console.log(`\nMigration complete! Fixed ${fixed} users.`);
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

fixReferredBy();
