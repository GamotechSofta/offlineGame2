import mongoose from 'mongoose';

const helpDeskSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    subject: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    screenshots: [{
        type: String,
        trim: true,
    }],
    status: {
        type: String,
        enum: ['open', 'in-progress', 'resolved', 'closed'],
        default: 'open',
    },
    adminResponse: {
        type: String,
        trim: true,
    },
}, {
    timestamps: true,
});

helpDeskSchema.index({ userId: 1, createdAt: -1 });
helpDeskSchema.index({ status: 1, createdAt: -1 });
helpDeskSchema.index({ userId: 1, status: 1, createdAt: -1 });

const HelpDesk = mongoose.model('HelpDesk', helpDeskSchema);
export default HelpDesk;
