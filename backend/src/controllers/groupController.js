import mongoose from 'mongoose';
import { getRequestModels } from '../config/database.js';
import { groupInputSchema } from '../validators/groupValidator.js';
import { HttpError } from '../utils/httpError.js';

export async function listGroups(req, res) {
  const { Group, Student } = getRequestModels(req);
  const [groups, studentCounts] = await Promise.all([
    Group.find()
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
  const { Group } = getRequestModels(req);
  const parsed = groupInputSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid group details');
  const code = parsed.data.code.toUpperCase();
  const duplicate = await Group.exists({ code });
  if (duplicate) throw new HttpError(409, 'Group code already exists');

  const group = await Group.create({
    name: parsed.data.name,
    code,
    whatsappLink: parsed.data.whatsappLink,
    isActive: parsed.data.isActive ?? true,
  });
  res.status(201).json({ group });
}

export async function updateGroup(req, res) {
  const { Group } = getRequestModels(req);
  if (!mongoose.isValidObjectId(req.params.groupId)) throw new HttpError(400, 'Invalid group ID');
  const parsed = groupInputSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || 'Invalid group details');
  const code = parsed.data.code.toUpperCase();
  const duplicate = await Group.exists({ code, _id: { $ne: req.params.groupId } });
  if (duplicate) throw new HttpError(409, 'Group code already exists');

  const group = await Group.findByIdAndUpdate(req.params.groupId, {
    name: parsed.data.name,
    code,
    whatsappLink: parsed.data.whatsappLink,
    isActive: parsed.data.isActive ?? true,
  }, { new: true, runValidators: true });
  if (!group) throw new HttpError(404, 'Group not found');
  res.json({ group });
}

export async function deleteGroup(req, res) {
  const { Group, Student } = getRequestModels(req);
  if (!mongoose.isValidObjectId(req.params.groupId)) throw new HttpError(400, 'Invalid group ID');
  const group = await Group.findById(req.params.groupId);
  if (!group) throw new HttpError(404, 'Group not found');

  const assignedStudents = await Student.countDocuments({ groupIds: group._id });
  if (assignedStudents > 0) {
    throw new HttpError(409, `Group is referenced by ${assignedStudents} student${assignedStudents === 1 ? '' : 's'} and cannot be deleted.`);
  }
  await group.deleteOne();
  res.status(204).end();
}
