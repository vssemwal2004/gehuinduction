import mongoose from 'mongoose';
import { env } from './env.js';
import { activityLogSchema } from '../models/ActivityLog.js';
import { groupSchema } from '../models/Group.js';
import { emailTemplateSettingSchema } from '../models/EmailTemplateSetting.js';
import { importJobSchema } from '../models/ImportJob.js';
import { mailJobSchema } from '../models/MailJob.js';
import { scanEventSchema } from '../models/ScanEvent.js';
import { studentSchema } from '../models/Student.js';
import { studentQrDataSchema } from '../models/StudentQrData.js';
import { userSchema } from '../models/User.js';

export const PRIMARY_DB_KEY = 'primary';
export const SECONDARY_DB_KEY = 'secondary';
export const MBA_DB_KEY = 'mba';
export const BBA_DB_KEY = 'bba';

const modelSchemas = {
  ActivityLog: activityLogSchema,
  EmailTemplateSetting: emailTemplateSettingSchema,
  Group: groupSchema,
  ImportJob: importJobSchema,
  MailJob: mailJobSchema,
  ScanEvent: scanEventSchema,
  Student: studentSchema,
  StudentQrData: studentQrDataSchema,
  User: userSchema,
};

const contexts = new Map();

function configuredDatabases() {
  const configs = [{
    key: PRIMARY_DB_KEY,
    uri: env.MONGODB_URI,
    dbName: env.MONGODB_DB_NAME,
    label: 'primary',
  }];
  if (env.MONGODB_SECONDARY_URI) {
    configs.push({
      key: SECONDARY_DB_KEY,
      uri: env.MONGODB_SECONDARY_URI,
      dbName: env.MONGODB_SECONDARY_DB_NAME,
      label: 'secondary',
    });
  }
  if (env.MONGODB_MBA_URI) {
    configs.push({
      key: MBA_DB_KEY,
      uri: env.MONGODB_MBA_URI,
      dbName: env.MONGODB_MBA_DB_NAME,
      label: 'mba',
    });
  }
  if (env.MONGODB_BBA_URI) {
    configs.push({
      key: BBA_DB_KEY,
      uri: env.MONGODB_BBA_URI,
      dbName: env.MONGODB_BBA_DB_NAME,
      label: 'bba',
    });
  }
  return configs;
}

function registerModels(connection) {
  return Object.fromEntries(
    Object.entries(modelSchemas).map(([name, schema]) => [name, connection.models[name] || connection.model(name, schema)]),
  );
}

export async function connectDatabase() {
  mongoose.set('strictQuery', true);
  for (const config of configuredDatabases()) {
    const options = {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 10000,
    };
    if (config.dbName) options.dbName = config.dbName;
    const connection = mongoose.createConnection(config.uri, options);
    try {
      await connection.asPromise();
    } catch (error) {
      throw new Error(`MongoDB ${config.label} connection failed: ${error.message}`);
    }
    contexts.set(config.key, {
      ...config,
      connection,
      models: registerModels(connection),
    });
    console.log(`MongoDB ${config.label} connected`);
  }
}

export function getDatabaseContext(dbKey = PRIMARY_DB_KEY) {
  const context = contexts.get(dbKey);
  if (!context) throw new Error(`Database context is unavailable: ${dbKey}`);
  return context;
}

export function getModels(dbKey = PRIMARY_DB_KEY) {
  return getDatabaseContext(dbKey).models;
}

export function getRequestModels(req) {
  return req.models || getModels(req.dbKey || PRIMARY_DB_KEY);
}

export function getActiveDatabaseContexts() {
  return [...contexts.values()];
}

export function hasDatabaseContext(dbKey) {
  return contexts.has(dbKey);
}
