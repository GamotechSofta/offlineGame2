import BankDetail from '../models/bankDetail/bankDetail.js';
import { logActivity, getClientIp } from '../utils/activityLogger.js';

/**
 * User: Get my bank details. Requires verifyUser (JWT).
 */
export const getMyBankDetails = async (req, res) => {
    try {
        const userId = req.userId;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const bankDetails = await BankDetail.find({ userId, isActive: true })
            .sort({ isDefault: -1, createdAt: -1 })
            .lean();

        res.status(200).json({ success: true, data: bankDetails });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * User: Add new bank detail. Requires verifyUser (JWT).
 */
export const addBankDetail = async (req, res) => {
    try {
        const userId = req.userId;
        const {
            accountHolderName,
            accountNumber,
            ifscCode,
            bankName,
            upiId,
            accountType,
            isDefault,
        } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        if (!accountHolderName) {
            return res.status(400).json({ success: false, message: 'Account holder name is required' });
        }

        // Must have either bank details or UPI ID
        if (!upiId && (!accountNumber || !ifscCode)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide either UPI ID or bank account details (account number and IFSC)',
            });
        }

        // Check limit (max 5 accounts per user)
        const existingCount = await BankDetail.countDocuments({ userId, isActive: true });
        if (existingCount >= 5) {
            return res.status(400).json({
                success: false,
                message: 'Maximum 5 bank accounts allowed. Please delete an existing account first.',
            });
        }

        // Determine account type
        let finalAccountType = accountType || 'savings';
        if (upiId && !accountNumber) {
            finalAccountType = 'upi_only';
        }

        // If this is the first account or isDefault is true, make it default
        const shouldBeDefault = isDefault || existingCount === 0;

        const bankDetail = await BankDetail.create({
            userId,
            accountHolderName: accountHolderName.trim(),
            accountNumber: accountNumber?.trim() || '',
            ifscCode: ifscCode?.trim().toUpperCase() || '',
            bankName: bankName?.trim() || '',
            upiId: upiId?.trim() || '',
            accountType: finalAccountType,
            isDefault: shouldBeDefault,
            isVerified: false,
            isActive: true,
        });

        await logActivity({
            action: 'bank_detail_added',
            performedBy: userId,
            performedByType: 'user',
            targetType: 'bank_detail',
            targetId: bankDetail._id.toString(),
            details: `Bank detail added: ${bankName || 'UPI'} - ${accountNumber || upiId}`,
            ip: getClientIp(req),
        });

        res.status(201).json({
            success: true,
            message: 'Bank detail added successfully',
            data: bankDetail,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * User: Update bank detail. Requires verifyUser (JWT).
 */
export const updateBankDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        const {
            accountHolderName,
            accountNumber,
            ifscCode,
            bankName,
            upiId,
            accountType,
            isDefault,
        } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const bankDetail = await BankDetail.findOne({ _id: id, userId, isActive: true });
        if (!bankDetail) {
            return res.status(404).json({ success: false, message: 'Bank detail not found' });
        }

        // Update fields
        if (accountHolderName) bankDetail.accountHolderName = accountHolderName.trim();
        if (accountNumber !== undefined) bankDetail.accountNumber = accountNumber?.trim() || '';
        if (ifscCode !== undefined) bankDetail.ifscCode = ifscCode?.trim().toUpperCase() || '';
        if (bankName !== undefined) bankDetail.bankName = bankName?.trim() || '';
        if (upiId !== undefined) bankDetail.upiId = upiId?.trim() || '';
        if (accountType) bankDetail.accountType = accountType;
        if (isDefault !== undefined) bankDetail.isDefault = isDefault;

        // Reset verification on update
        bankDetail.isVerified = false;

        await bankDetail.save();

        await logActivity({
            action: 'bank_detail_updated',
            performedBy: userId,
            performedByType: 'user',
            targetType: 'bank_detail',
            targetId: id,
            details: `Bank detail updated`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: 'Bank detail updated successfully',
            data: bankDetail,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * User: Delete (soft delete) bank detail
 */
export const deleteBankDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const bankDetail = await BankDetail.findOne({ _id: id, userId, isActive: true });
        if (!bankDetail) {
            return res.status(404).json({ success: false, message: 'Bank detail not found' });
        }

        // Soft delete
        bankDetail.isActive = false;
        bankDetail.isDefault = false;
        await bankDetail.save();

        // If this was the default, set another one as default
        if (bankDetail.isDefault) {
            const anotherAccount = await BankDetail.findOne({ userId, isActive: true });
            if (anotherAccount) {
                anotherAccount.isDefault = true;
                await anotherAccount.save();
            }
        }

        await logActivity({
            action: 'bank_detail_deleted',
            performedBy: userId,
            performedByType: 'user',
            targetType: 'bank_detail',
            targetId: id,
            details: `Bank detail deleted`,
            ip: getClientIp(req),
        });

        res.status(200).json({
            success: true,
            message: 'Bank detail deleted successfully',
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * User: Set a bank detail as default
 */
export const setDefaultBankDetail = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.userId;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const bankDetail = await BankDetail.findOne({ _id: id, userId, isActive: true });
        if (!bankDetail) {
            return res.status(404).json({ success: false, message: 'Bank detail not found' });
        }

        // Remove default from all other accounts
        await BankDetail.updateMany(
            { userId, _id: { $ne: id } },
            { $set: { isDefault: false } }
        );

        // Set this one as default
        bankDetail.isDefault = true;
        await bankDetail.save();

        res.status(200).json({
            success: true,
            message: 'Default bank account updated',
            data: bankDetail,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
