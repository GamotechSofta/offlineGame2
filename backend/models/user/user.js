import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
    },
    phone: {
        type: String,
        trim: true,
    },
    role: {
        type: String,
        enum: ['user', 'bookie'],
        default: 'user',
    },
    balance: {
        type: Number,
        default: 0,
        min: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    /** Super admin's user: direct frontend signup or created by super admin. Bookie's user: created by bookie or came via bookie link. */
    source: {
        type: String,
        enum: ['super_admin', 'bookie'],
        default: 'super_admin',
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        default: null,
    },
    /** Last active timestamp – used to compute online/offline status (online if within 5 min) */
    lastActiveAt: {
        type: Date,
        default: null,
    },
    /** Last login IP address (set on player login) */
    lastLoginIp: {
        type: String,
        default: null,
    },
    /** Device ID from which user last logged in (sent by frontend) */
    lastLoginDeviceId: {
        type: String,
        default: null,
    },
    /** List of devices used to log in: { deviceId, firstLoginAt, lastLoginAt } */
    loginDevices: [{
        deviceId: { type: String, required: true },
        firstLoginAt: { type: Date, required: true },
        lastLoginAt: { type: Date, required: true },
    }],
}, {
    timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
