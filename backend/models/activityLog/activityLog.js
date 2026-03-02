import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
    /** Action performed, e.g. 'admin_login', 'create_market', 'add_result' */
    action: {
        type: String,
        required: true,
    },
    /** Who performed: admin username or 'System' */
    performedBy: {
        type: String,
        required: true,
    },
    /** admin | super_admin | bookie | user | system */
    performedByType: {
        type: String,
        enum: ['admin', 'super_admin', 'bookie', 'user', 'system'],
        default: 'admin',
    },
    /** Target type: market | user | bookie | wallet | etc. */
    targetType: {
        type: String,
        default: null,
    },
    /** Target ID or identifier */
    targetId: {
        type: String,
        default: null,
    },
    /** Human-readable details */
    details: {
        type: String,
        default: null,
    },
    /** Extra JSON for structured data */
    meta: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    /** IP address if available */
    ip: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
});

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ action: 1 });
activityLogSchema.index({ performedBy: 1 });
activityLogSchema.index({ performedByType: 1 });

const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
export default ActivityLog;
