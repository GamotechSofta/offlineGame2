import multer from 'multer';
import path from 'path';
import BannerSetting from '../models/settings/BannerSetting.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';

const storage = multer.memoryStorage();

const isAllowedImageType = (file) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    return Boolean(mimetype && extname);
};

export const uploadBannerImages = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!isAllowedImageType(file)) {
            cb(new Error('Only image files are allowed (jpg, jpeg, png, gif, webp)'));
            return;
        }
        cb(null, true);
    },
}).any();

const ensureBannerSetting = async () => {
    const setting = await BannerSetting.findOneAndUpdate(
        { key: 'home-hero' },
        { $setOnInsert: { key: 'home-hero' } },
        { new: true, upsert: true }
    );
    return setting;
};

const normalizeBannerEntries = (entries) => {
    if (!Array.isArray(entries)) return [];
    return entries
        .map((item) => {
            if (!item) return null;
            if (typeof item === 'string') {
                const url = item.trim();
                return url ? { url, publicId: '' } : null;
            }
            const url = String(item.url || '').trim();
            if (!url) return null;
            return {
                url,
                publicId: String(item.publicId || '').trim(),
            };
        })
        .filter(Boolean);
};

const readLegacyBannerLists = (setting) => {
    const raw = typeof setting?.toObject === 'function' ? setting.toObject() : (setting || {});
    const legacyDesktop = raw?.desktop?.url ? [{ url: raw.desktop.url, publicId: raw.desktop.publicId || '' }] : [];
    const legacyMobile = raw?.mobile?.url ? [{ url: raw.mobile.url, publicId: raw.mobile.publicId || '' }] : [];
    return { legacyDesktop, legacyMobile };
};

const resolveBannerLists = (setting) => {
    const currentDesktop = normalizeBannerEntries(setting?.desktopBanners || []);
    const currentMobile = normalizeBannerEntries(setting?.mobileBanners || []);
    const { legacyDesktop, legacyMobile } = readLegacyBannerLists(setting);
    return {
        desktop: currentDesktop.length ? currentDesktop : legacyDesktop,
        mobile: currentMobile.length ? currentMobile : legacyMobile,
    };
};

const normalizeBannerResponse = (setting) => {
    const lists = resolveBannerLists(setting);
    return {
        desktopBanners: lists.desktop.map((item) => item?.url).filter(Boolean),
        mobileBanners: lists.mobile.map((item) => item?.url).filter(Boolean),
        desktopImageUrl: lists.desktop?.[0]?.url || '',
        mobileImageUrl: lists.mobile?.[0]?.url || '',
        updatedAt: setting?.updatedAt || null,
    };
};

const parseBannerList = (value) => {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    try {
        const parsed = JSON.parse(String(value));
        if (Array.isArray(parsed)) {
            return parsed.map((item) => String(item || '').trim()).filter(Boolean);
        }
    } catch {}
    const single = String(value).trim();
    return single ? [single] : [];
};

export const getPublicBannerSettings = async (req, res) => {
    try {
        const setting = await ensureBannerSetting();
        res.status(200).json({
            success: true,
            data: normalizeBannerResponse(setting),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getAdminBannerSettings = async (req, res) => {
    try {
        const setting = await ensureBannerSetting();
        res.status(200).json({
            success: true,
            data: normalizeBannerResponse(setting),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateAdminBannerSettings = async (req, res) => {
    try {
        const setting = await ensureBannerSetting();

        const resolved = resolveBannerLists(setting);
        const oldDesktop = Array.isArray(resolved.desktop) ? resolved.desktop : [];
        const oldMobile = Array.isArray(resolved.mobile) ? resolved.mobile : [];

        const desktopUrls = parseBannerList(req.body.desktopBanners);
        const mobileUrls = parseBannerList(req.body.mobileBanners);
        const uploadedFiles = Array.isArray(req.files) ? req.files : [];
        const desktopFiles = uploadedFiles.filter((file) => file.fieldname === 'desktopImages');
        const mobileFiles = uploadedFiles.filter((file) => file.fieldname === 'mobileImages');

        const nextDesktop = desktopUrls.map((url) => {
            const existing = oldDesktop.find((item) => item?.url === url);
            return { url, publicId: existing?.publicId || '' };
        });
        const nextMobile = mobileUrls.map((url) => {
            const existing = oldMobile.find((item) => item?.url === url);
            return { url, publicId: existing?.publicId || '' };
        });

        for (const file of desktopFiles) {
            const uploaded = await uploadToCloudinary(file.buffer, 'banners');
            nextDesktop.push({
                url: uploaded.secure_url || '',
                publicId: uploaded.public_id || '',
            });
        }
        for (const file of mobileFiles) {
            const uploaded = await uploadToCloudinary(file.buffer, 'banners');
            nextMobile.push({
                url: uploaded.secure_url || '',
                publicId: uploaded.public_id || '',
            });
        }

        const desktopIdsToKeep = new Set(nextDesktop.map((item) => item.publicId).filter(Boolean));
        const mobileIdsToKeep = new Set(nextMobile.map((item) => item.publicId).filter(Boolean));
        const oldIdsToDelete = [
            ...oldDesktop.map((item) => item?.publicId).filter((id) => id && !desktopIdsToKeep.has(id)),
            ...oldMobile.map((item) => item?.publicId).filter((id) => id && !mobileIdsToKeep.has(id)),
        ];
        await Promise.all(oldIdsToDelete.map((publicId) => deleteFromCloudinary(publicId).catch(() => {})));

        setting.desktopBanners = nextDesktop;
        setting.mobileBanners = nextMobile;

        setting.updatedBy = req.admin?._id || null;
        await setting.save();

        res.status(200).json({
            success: true,
            message: 'Banner settings updated successfully',
            data: normalizeBannerResponse(setting),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
