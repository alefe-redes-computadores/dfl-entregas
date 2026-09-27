import 'server-only';
import { getAuth } from 'firebase-admin/auth';
import { adminApp } from './admin';

export const adminAuth = getAuth(adminApp);
