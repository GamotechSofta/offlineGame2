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
<<<<<<< Updated upstream
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
=======
>>>>>>> Stashed changes
    },
}, {
    timestamps: true,
});

// Hash password before saving
adminSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password
adminSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

const Admin = mongoose.model('Admin', adminSchema);
export default Admin;
