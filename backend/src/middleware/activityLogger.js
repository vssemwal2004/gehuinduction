import ActivityLog from '../models/ActivityLog.js';

const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function activityLogger(req, res, next) {
  if (!mutationMethods.has(req.method)) return next();
  res.on('finish', () => {
    if (!req.user || req.path === '/api/auth/logout') return;
    ActivityLog.create({
      actorId: req.user._id,
      actorName: req.user.name,
      actorRole: req.user.role,
      action: req.method,
      resource: req.originalUrl.split('?')[0].slice(0, 180),
      statusCode: res.statusCode,
      ip: String(req.ip || '').slice(0, 80),
      userAgent: String(req.get('user-agent') || '').slice(0, 300),
    }).catch((error) => console.error('Activity log write failed:', error.message));
  });
  next();
}
