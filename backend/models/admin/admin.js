import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const adminSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
    },
    role: {
        type: String,
        default: 'super_admin',
        enum: ['super_admin', 'bookie'],
    },
    status: {
        type: String,
        default: 'active',
        enum: ['active', 'inactive'],
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
    },
    phone: {
        type: String,
        trim: true,
    },
    /** Bookie-only: UI theme for their users' panel (user app). Ignored for super_admin. */
    uiTheme: {
        themeId: { type: String, enum: ['default', 'gold', 'blue', 'green', 'red', 'purple'], default: 'default' },
        primaryColor: { type: String, trim: true },
        accentColor: { type: String, trim: true },
    },
    /** Bookie-only: Commission percentage (0-100). Set by super admin upon approval. */
    commissionPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    /** Super admin only: Secret password required when declaring result (Confirm & Declare). Optional – if not set, no extra check. */
    secretDeclarePassword: {
        type: String,
        default: null,
        select: false,
    },
    /** Bookie-only: Permission to manage payment requests (approve/reject). Set by super admin. */
    canManagePayments: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

// Hash password before saving
adminSchema.pre('save', async function () {
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    if (this.isModified('secretDeclarePassword') && this.secretDeclarePassword) {
        const salt = await bcrypt.genSalt(10);
        this.secretDeclarePassword = await bcrypt.hash(this.secretDeclarePassword, salt);
    }
});

// Method to compare password
adminSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Method to compare secret declare password (super_admin only)
adminSchema.methods.compareSecretDeclarePassword = async function (candidatePassword) {
    if (!this.secretDeclarePassword) return false;
    return bcrypt.compare(candidatePassword, this.secretDeclarePassword);
};

const Admin = mongoose.model('Admin', adminSchema);
export default Admin;
