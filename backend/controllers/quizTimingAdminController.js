import bcrypt from 'bcryptjs';
import Admin from '../models/admin/admin.js';
import {
  getQuizTimingSettings,
  updateQuizTimingSettings,
} from '../services/quizTimingSettingsService.js';

const normalizeMode = (raw) => (String(raw || '2d').toLowerCase() === '3d' ? '3d' : '2d');

async function verifySecretDeclarePassword(req, providedRaw = '') {
  const adminWithSecret = await Admin.findById(req.admin?._id).select('+secretDeclarePassword').lean();
  if (!adminWithSecret?.secretDeclarePassword) {
    return { success: true, hasSecretDeclarePassword: false };
  }
  const provided = String(providedRaw || '').trim();
  const isValid = await bcrypt.compare(provided, adminWithSecret.secretDeclarePassword);
  if (!isValid) {
    return {
      success: false,
      error: {
        status: 403,
        body: {
          success: false,
          message: 'Invalid secret declare password',
          code: 'INVALID_SECRET_DECLARE_PASSWORD',
        },
      },
    };
  }
  return { success: true, hasSecretDeclarePassword: true };
}

export const getAdminQuizTimingSettings = async (req, res) => {
  try {
    const verification = await verifySecretDeclarePassword(req, req.query?.secretDeclarePassword);
    if (!verification.success) {
      return res.status(verification.error.status).json(verification.error.body);
    }
    const mode = normalizeMode(req.params?.mode);
    const settings = await getQuizTimingSettings(mode);
    return res.json({ success: true, data: { mode, ...settings } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

export const updateAdminQuizTimingSettings = async (req, res) => {
  try {
    if (req.admin?.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'Super admin access required.' });
    }
    const verification = await verifySecretDeclarePassword(req, req.body?.secretDeclarePassword);
    if (!verification.success) {
      return res.status(verification.error.status).json(verification.error.body);
    }
    const mode = normalizeMode(req.params?.mode);
    const next = await updateQuizTimingSettings(mode, req.body || {}, req.admin?._id);
    return res.json({ success: true, message: 'Quiz timing settings updated.', data: { mode, ...next } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

