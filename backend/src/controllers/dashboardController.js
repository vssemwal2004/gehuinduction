import Group from '../models/Group.js';
import MailJob from '../models/MailJob.js';
import ScanEvent from '../models/ScanEvent.js';
import Student from '../models/Student.js';
import User from '../models/User.js';

export async function getAdminDashboard(req, res) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [
    totalStudents,
    registeredStudents,
    pendingStudents,
    totalGroups,
    groupCoordinators,
    scanCoordinators,
    scansToday,
    sentEmails,
    failedEmails,
  ] = await Promise.all([
    Student.countDocuments({ isActive: true }),
    Student.countDocuments({ isActive: true, registrationStatus: 'registered' }),
    Student.countDocuments({ isActive: true, registrationStatus: 'not_registered' }),
    Group.countDocuments({ isActive: true }),
    User.countDocuments({ role: 'group_coordinator', isActive: true }),
    User.countDocuments({ role: 'scan_coordinator', isActive: true }),
    ScanEvent.countDocuments({ createdAt: { $gte: startOfToday } }),
    MailJob.countDocuments({ status: 'sent' }),
    MailJob.countDocuments({ status: 'failed' }),
  ]);

  res.json({
    counts: {
      totalStudents,
      registeredStudents,
      pendingStudents,
      totalGroups,
      groupCoordinators,
      scanCoordinators,
      scansToday,
      sentEmails,
      failedEmails,
    },
    registrationPercent: totalStudents ? Math.round((registeredStudents / totalStudents) * 100) : 0,
  });
}
