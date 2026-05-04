import mongoose from 'mongoose';

const bannerImageSchema = new mongoose.Schema(
    {
        url: {
            type: String,
            default: '',
            trim: true,
        },
        publicId: {
            type: String,
            default: '',
            trim: true,
        },
    },
    { _id: false }
);

const bannerSettingSchema = new mongoose.Schema(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            default: 'home-hero',
            trim: true,
        },
        desktopBanners: {
            type: [bannerImageSchema],
            default: () => [],
        },
        mobileBanners: {
            type: [bannerImageSchema],
            default: () => [],
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            default: null,
        },
        lotteryNewsMessage: {
            type: String,
            default: 'Welcome Diamond',
            trim: true,
            maxlength: 500,
        },
    },
    { timestamps: true }
);

const BannerSetting = mongoose.model('BannerSetting', bannerSettingSchema);

export default BannerSetting;
