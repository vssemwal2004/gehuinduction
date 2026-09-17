import { getRequestModels } from '../config/database.js';

export async function getAdminDashboard(req, res) {
  const { ScanEvent, Student, User } = getRequestModels(req);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const [totalStudents, enteredStudents, waitingStudents, scanCoordinators, scansToday, duplicateScansToday] = await Promise.all([
    Student.countDocuments({ isActive: true }),
    Student.countDocuments({ isActive: true, registrationStatus: 'registered' }),
    Student.countDocuments({ isActive: true, registrationStatus: 'not_registered' }),
    User.countDocuments({ role: 'scan_coordinator', isActive: true }),
    ScanEvent.countDocuments({ createdAt: { $gte: startOfToday }, isFirstScan: true }),
    ScanEvent.countDocuments({ createdAt: { $gte: startOfToday }, isFirstScan: false }),
  ]);
  res.json({ counts: { totalStudents, enteredStudents, waitingStudents, scanCoordinators, scansToday, duplicateScansToday }, entryPercent: totalStudents ? Math.round((enteredStudents / totalStudents) * 100) : 0 });
}
