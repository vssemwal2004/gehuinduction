import mongoose from 'mongoose';
import Group from '../models/Group.js';
import Student from '../models/Student.js';
import User from '../models/User.js';
import { groupInputSchema } from '../validators/groupValidator.js';
import { HttpError } from '../utils/httpError.js';

async function validateCoordinator(coordinatorId) {
  if (!coordinatorId) return null;
  const coordinator = await User.findOne({
    _id: coordinatorId,
    role: 'group_coordinator',
    isActive: true,
  }).select('_id').lean();
  if (!coordinator) throw new HttpError(400, 'Selected group coordinator is unavailable');
  return coordinator._id;
}

export async function listGroups(_req, res) {
  const [groups, studentCounts] = await Promise.all([
    Group.find()
      .populate('coordinatorId', 'name email mobile')
      .sort({ isActive: -1, code: 1 })
      .lean(),
    Student.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$groupIds' },
      { $group: { _id: '$groupIds', count: { $sum: 1 } } },
    ]),
  ]);
  const countMap = new Map(studentCounts.map((item) => [String(item._id), item.count]));
  res.json({
    groups: groups.map((group) => ({
      ...group,
      studentCount: countMap.get(String(group._id)) || 0,
    })),
  });
}

export async function createGroup(req, res) {
  const parsed = groupInputSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid group details');
  const code = parsed.data.code.toUpperCase();
  const duplicate = await Group.exists({ code });
  if (duplicate) throw new HttpError(409, 'Group code already exists');

  const coordinatorId = await validateCoordinator(parsed.data.coordinatorId);
  const group = await Group.create({
    name: parsed.data.name,
    code,
    whatsappLink: parsed.data.whatsappLink,
    coordinatorId,
    isActive: parsed.data.isActive ?? true,
  });
  res.status(201).json({ group });
}

export async function updateGroup(req, res) {
  if (!mongoose.isValidObjectId(req.params.groupId)) throw new HttpError(400, 'Invalid group ID');
  const parsed = groupInputSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid group details');
  const code = parsed.data.code.toUpperCase();
  const duplicate = await Group.exists({ code, _id: { $ne: req.params.groupId } });
  if (duplicate) throw new HttpError(409, 'Group code already exists');

  const coordinatorId = await validateCoordinator(parsed.data.coordinatorId);
  const group = await Group.findByIdAndUpdate(req.params.groupId, {
    name: parsed.data.name,
    code,
    whatsappLink: parsed.data.whatsappLink,
    coordinatorId,
    isActive: parsed.data.isActive ?? true,
  }, { new: true, runValidators: true }).populate('coordinatorId', 'name email mobile');
  if (!group) throw new HttpError(404, 'Group not found');
  await Student.updateMany(
    { 'groupIds.0': group._id },
    { $set: { groupCoordinatorId: coordinatorId } },
  );
  res.json({ group });
}

export async function deleteGroup(req, res) {
  if (!mongoose.isValidObjectId(req.params.groupId)) throw new HttpError(400, 'Invalid group ID');
  const group = await Group.findById(req.params.groupId);
  if (!group) throw new HttpError(404, 'Group not found');

  const assignedStudents = await Student.countDocuments({ groupIds: group._id });
  if (assignedStudents > 0) {
    throw new HttpError(409, `Group is referenced by ${assignedStudents} student${assignedStudents === 1 ? '' : 's'} and cannot be deleted.`);
  }
  await User.updateMany({ groupIds: group._id }, { $pull: { groupIds: group._id } });
  await group.deleteOne();
  res.status(204).end();
}
