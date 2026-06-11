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
        enum: ['super_admin', 'specific_admin', 'bookie', 'super_bookie'],
    },
    /** super_bookie only: parent bookie who created this account */
    parentBookieId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        default: null,
    },
    /** specific_admin only: sidebar paths this admin may access */
    allowedTabs: {
        type: [String],
        default: [],
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
    /** SuperBookie (bookie role): % of player bet amount earned as commission. */
    commissionPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
    /** SuperBookie only: % of this account's commission paid to admin (e.g. 10% of ₹400 = ₹40). */
    adminCommissionPercentage: {
        type: Number,
        default: 10,
        min: 0,
        max: 100,
    },
    /** super_admin / specific_admin: Secret password for sensitive actions (declare, delete market, etc.). Optional – if not set, no extra check. */
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
    /** Bookie-only: Wallet balance. Set by super admin. */
    balance: {
        type: Number,
        default: 0,
        min: 0,
    },
    /** super_bookie: how initial balance from parent counts toward commission (advance recovery vs after paid). */
    initialBalancePaymentMode: {
        type: String,
        enum: ['advance_paid', 'after_paid'],
        default: 'advance_paid',
    },
    failedLoginAttempts: {
        type: Number,
        default: 0,
    },
    loginBlockedUntil: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

adminSchema.index({ parentBookieId: 1, role: 1 });
adminSchema.index({ role: 1, phone: 1 });

// Hash password before saving
adminSchema.pre('save', async function () {
    if (this.isModified('password')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    if (this.isModified('secretDeclarePassword')) {
        const secret = this.secretDeclarePassword;
        if (secret === null || secret === undefined || String(secret).trim() === '') {
            this.secretDeclarePassword = null;
        } else if (!String(secret).startsWith('$2')) {
            const salt = await bcrypt.genSalt(10);
            this.secretDeclarePassword = await bcrypt.hash(String(secret), salt);
        }
    }
});

// Method to compare password
adminSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

// Method to compare secret declare password (super_admin / specific_admin)
adminSchema.methods.compareSecretDeclarePassword = async function (candidatePassword) {
    if (!this.secretDeclarePassword) return false;
    return bcrypt.compare(candidatePassword, this.secretDeclarePassword);
};

const Admin = mongoose.model('Admin', adminSchema);
export default Admin;
