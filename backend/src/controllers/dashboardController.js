import { getRequestModels } from '../config/database.js';

export async function getAdminDashboard(req, res) {
  const { Group, MailJob, ScanEvent, Student, User } = getRequestModels(req);
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
    courseStats,
  ] = await Promise.all([
    Student.countDocuments({ isActive: true }),
    Student.countDocuments({ isActive: true, registrationStatus: 'registered' }),
    Student.countDocuments({ isActive: true, registrationStatus: 'not_registered' }),
    Group.countDocuments({ isActive: true }),
    Student.distinct('groupCoordinatorMobile', { isActive: true, groupCoordinatorMobile: { $nin: [null, ''] } }).then((items) => items.length),
    User.countDocuments({ role: 'scan_coordinator', isActive: true }),
    ScanEvent.countDocuments({ createdAt: { $gte: startOfToday } }),
    MailJob.countDocuments({ status: 'sent' }),
    MailJob.countDocuments({ status: 'failed' }),
    Student.aggregate([
      { $match: { isActive: true, course: { $nin: [null, ''] } } },
      {
        $group: {
          _id: '$course',
          totalStudents: { $sum: 1 },
          registeredStudents: { $sum: { $cond: [{ $eq: ['$registrationStatus', 'registered'] }, 1, 0] } },
          pendingStudents: { $sum: { $cond: [{ $eq: ['$registrationStatus', 'not_registered'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
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
    courseStats: courseStats.map((item) => ({
      course: item._id,
      totalStudents: item.totalStudents,
      registeredStudents: item.registeredStudents,
      pendingStudents: item.pendingStudents,
      registrationPercent: item.totalStudents ? Math.round((item.registeredStudents / item.totalStudents) * 100) : 0,
    })),
    registrationPercent: totalStudents ? Math.round((registeredStudents / totalStudents) * 100) : 0,
  });
}
