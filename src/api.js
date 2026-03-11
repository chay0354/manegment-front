import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// Backend URL from .env (VITE_MANEGER_API_URL) – used for all API and file uploads
const API_BASE = (import.meta.env.VITE_MANEGER_API_URL || 'http://localhost:8001').replace(/\/$/, '');

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

const AUTH_TOKEN_KEY = 'maneger_token';
const AUTH_USER_KEY = 'maneger_user';

export function getStoredToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}
export function getStoredUser() {
  try {
    const u = localStorage.getItem(AUTH_USER_KEY);
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}
export function setAuth(token, user) {
  if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
  else localStorage.removeItem(AUTH_TOKEN_KEY);
  if (user) localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(AUTH_USER_KEY);
  api.defaults.headers.common.Authorization = token ? `Bearer ${token}` : '';
}
export function clearAuth() {
  setAuth(null, null);
}

/** Turn axios network/request errors into a clearer message for the user. */
export function getNetworkErrorMessage(err) {
  if (!err) return 'שגיאה לא ידועה';
  const serverMsg = err.response?.data?.error;
  if (serverMsg) return serverMsg;
  const msg = err.message || '';
  const code = err.code || '';
  if (code === 'ECONNABORTED' || msg.includes('timeout')) return 'הבקשה ארכה יותר מדי (timeout). נסה שוב או להעלות פחות קבצים.';
  if (code === 'ERR_NETWORK' || msg === 'Network Error') return 'שגיאת רשת: לא ניתן להתחבר לשרת. בדוק ש־השרת רץ ו־VITE_MANEGER_API_URL נכון.';
  if (code === 'ERR_CONNECTION_REFUSED' || msg.includes('refused')) return 'החיבור נדחה. וודא שהשרת רץ (npm run dev).';
  return msg || String(err);
}

api.interceptors.request.use(config => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (config.data instanceof FormData) delete config.headers['Content-Type'];
  return config;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      const url = err.config?.url || '';
      if (!url.includes('/api/auth/login') && !url.includes('/api/auth/signup') && !url.includes('/api/auth/me')) {
        clearAuth();
        window.location.replace('/login');
      }
    }
    return Promise.reject(err);
  }
);

export const auth = {
  login: (username, password) =>
    api.post('/api/auth/login', { username, password }).then(r => r.data),
  signup: (username, email, password, full_name) =>
    api.post('/api/auth/signup', { username, email, password, full_name }).then(r => r.data),
  me: () => api.get('/api/auth/me').then(r => r.data)
};

export const users = {
  list: (projectId) =>
    api.get('/api/users', { params: projectId ? { projectId } : {} }).then(r => r.data)
};

export const projects = {
  list: () => api.get('/api/projects').then(r => r.data),
  get: (id) => api.get(`/api/projects/${id}`).then(r => r.data),
  getAccess: (id) => api.get(`/api/projects/${id}/access`).then(r => r.data),
  create: (body) => api.post('/api/projects', body).then(r => r.data),
  update: (id, body) => api.patch(`/api/projects/${id}`, body).then(r => r.data),
  delete: (id) => api.delete(`/api/projects/${id}`).then(r => r.data),
  requestJoin: (id) => api.post(`/api/projects/${id}/request`).then(r => r.data),
  getRequests: (id) => api.get(`/api/projects/${id}/requests`).then(r => r.data),
  approveRequest: (projectId, requestId) => api.post(`/api/projects/${projectId}/requests/${requestId}/approve`).then(r => r.data),
  rejectRequest: (projectId, requestId) => api.post(`/api/projects/${projectId}/requests/${requestId}/reject`).then(r => r.data),
  getMembers: (id) => api.get(`/api/projects/${id}/members`).then(r => r.data),
  addMember: (id, username) => api.post(`/api/projects/${id}/members`, { username }).then(r => r.data),
  removeMember: (id, userId) => api.delete(`/api/projects/${id}/members/${userId}`).then(r => r.data)
};

export const chat = {
  list: (projectId) => api.get(`/api/projects/${projectId}/chat`).then(r => r.data),
  send: (projectId, body) => api.post(`/api/projects/${projectId}/chat`, { body }).then(r => r.data)
};

export const tasks = {
  list: (projectId) => api.get(`/api/projects/${projectId}/tasks`).then(r => r.data),
  create: (projectId, body) => api.post(`/api/projects/${projectId}/tasks`, body).then(r => r.data),
  update: (projectId, taskId, body) => api.patch(`/api/projects/${projectId}/tasks/${taskId}`, body).then(r => r.data),
  delete: (projectId, taskId) => api.delete(`/api/projects/${projectId}/tasks/${taskId}`).then(r => r.data)
};

export const milestones = {
  list: (projectId) => api.get(`/api/projects/${projectId}/milestones`).then(r => r.data),
  create: (projectId, body) => api.post(`/api/projects/${projectId}/milestones`, body).then(r => r.data),
  update: (projectId, milestoneId, body) => api.patch(`/api/projects/${projectId}/milestones/${milestoneId}`, body).then(r => r.data),
  delete: (projectId, milestoneId) => api.delete(`/api/projects/${projectId}/milestones/${milestoneId}`).then(r => r.data)
};

export const documents = {
  list: (projectId) => api.get(`/api/projects/${projectId}/documents`).then(r => r.data),
  create: (projectId, body) => api.post(`/api/projects/${projectId}/documents`, body).then(r => r.data),
  update: (projectId, docId, body) => api.patch(`/api/projects/${projectId}/documents/${docId}`, body).then(r => r.data),
  delete: (projectId, docId) => api.delete(`/api/projects/${projectId}/documents/${docId}`).then(r => r.data)
};

export const notes = {
  list: (projectId) => api.get(`/api/projects/${projectId}/notes`).then(r => r.data),
  create: (projectId, body) => api.post(`/api/projects/${projectId}/notes`, body).then(r => r.data),
  update: (projectId, noteId, body) => api.patch(`/api/projects/${projectId}/notes/${noteId}`, body).then(r => r.data),
  delete: (projectId, noteId) => api.delete(`/api/projects/${projectId}/notes/${noteId}`).then(r => r.data)
};

export const projectFiles = {
  list: (projectId) => api.get(`/api/projects/${projectId}/files`).then(r => r.data),
  upload: (projectId, file) => {
    const form = new FormData();
    form.append('file', file);
    form.append('originalName', file.name || '');
    const headers = {};
    const token = getStoredToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return axios.post(`${API_BASE}/api/projects/${projectId}/files`, form, { timeout: 120000, headers }).then(r => r.data);
  },
  delete: (projectId, fileId) => api.delete(`/api/projects/${projectId}/files/${fileId}`).then(r => r.data),
  download: async (projectId, fileId, filename) => {
    const token = getStoredToken();
    const r = await axios.get(`${API_BASE}/api/projects/${projectId}/files/${fileId}/download`, { responseType: 'blob', validateStatus: () => true, headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (r.status !== 200) {
      const blob = r.data;
      let msg = 'Download failed';
      if (blob && (blob.type || '').startsWith('application/json')) {
        try { const j = JSON.parse(await blob.text()); msg = j.error || msg; } catch (_) {}
      }
      throw Object.assign(new Error(msg), { response: { data: { error: msg } } });
    }
    const url = URL.createObjectURL(r.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'download';
    a.click();
    URL.revokeObjectURL(url);
  },
  listSharepointBucket: (projectId) => api.get(`/api/projects/${projectId}/files/sharepoint-bucket`, { params: { _: Date.now() } }).then(r => r.data),
  addFromBucket: (projectId, path, displayName) => api.post(`/api/projects/${projectId}/files/from-bucket`, { path, displayName }).then(r => r.data),
  /** Upload via backend. Sends fileNames as JSON + base64 so Hebrew/Unicode names are preserved (multipart can corrupt them). Uses api so auth token is always attached. */
  uploadToSharepointBucket: (projectId, files, folderPath = '', options = {}) => {
    const form = new FormData();
    if (folderPath) form.append('folderPath', folderPath);
    const names = files.map(f => f.name || f.webkitRelativePath || 'file');
    form.append('fileNames', JSON.stringify(names));
    try {
      form.append('fileNamesB64', btoa(unescape(encodeURIComponent(JSON.stringify(names)))));
    } catch (_) {}
    for (let i = 0; i < files.length; i++) form.append('files', files[i], `file-${i}`);
    const headers = options.uploadId ? { 'X-Upload-ID': options.uploadId } : {};
    return api.post(`/api/projects/${projectId}/files/upload-to-sharepoint-bucket`, form, { timeout: 900000, onUploadProgress: options.onUploadProgress, headers }).then(r => r.data);
  },
  getSharepointUploadProgress: (projectId, uploadId) => api.get(`/api/projects/${projectId}/files/upload-to-sharepoint-bucket/progress`, { params: { uploadId } }).then(r => r.data),
  /** Direct-to-bucket upload using signed URLs (faster). Supabase bucket does not support Hebrew in paths; backend returns ASCII-only storage paths. We send path → original (Hebrew) name to update-display-names so the UI shows Hebrew. When folder name is set or single file, we use backend multipart so fileNames (UTF-8) are preserved the same way. */
  async uploadToSharepointBucketDirect(projectId, files, folderPath = '', options = {}) {
    const hasFolderName = (folderPath && String(folderPath).trim()) !== '';
    const singleFile = Array.isArray(files) && files.length === 1;
    if (hasFolderName || singleFile) {
      return this.uploadToSharepointBucket(projectId, files, folderPath, options);
    }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnon) {
      return this.uploadToSharepointBucket(projectId, files, folderPath, options);
    }
    const token = getStoredToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const fileDescriptors = files.map(f => ({
      relativeName: f.name || f.webkitRelativePath || 'file',
      contentType: f.type || undefined
    }));
    const { data } = await axios.post(
      `${API_BASE}/api/projects/${projectId}/files/upload-to-sharepoint-bucket/signed-urls`,
      { folderPath, files: fileDescriptors },
      { headers, timeout: 30000 }
    );
    const { bucket, urls } = data;
    if (!bucket || !Array.isArray(urls) || urls.length !== files.length) {
      throw new Error('Invalid signed URLs response');
    }
    const supabase = createClient(supabaseUrl, supabaseAnon);
    const uploaded = [];
    const failed = [];
    const onProgress = options.onProgress;
    const totalBytes = files.reduce((s, f) => s + (f.size || 0), 0);
    let loadedBytes = 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativeName = fileDescriptors[i].relativeName;
      const { path, token: uploadToken } = urls[i];
      const { error } = await supabase.storage.from(bucket).uploadToSignedUrl(path, uploadToken, file, { contentType: file.type || 'application/octet-stream' });
      if (!error) loadedBytes += (file.size || 0);
      if (onProgress) onProgress(loadedBytes, totalBytes);
      if (error) failed.push({ name: relativeName, error: error.message });
      else uploaded.push({ path, name: relativeName });
    }
    if (uploaded.length > 0) {
      const mappings = {};
      const folderPathNorm = (folderPath && String(folderPath).trim()) ? String(folderPath).trim().replace(/\/+/g, '/') : '';
      uploaded.forEach(u => {
        const displayName = folderPathNorm ? `${folderPathNorm}/${u.name}`.replace(/\/+/g, '/') : u.name;
        mappings[u.path] = displayName;
      });
      axios.post(
        `${API_BASE}/api/projects/${projectId}/files/upload-to-sharepoint-bucket/update-display-names`,
        { mappings },
        { headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' }, timeout: 15000 }
      ).catch(err => { console.warn('SharePoint display names update failed:', err.response?.data?.error || err.message); });
      axios.post(`${API_BASE}/api/projects/${projectId}/files/upload-to-sharepoint-bucket/invalidate-cache`, {}, { headers }).catch(() => {});
    }
    return { uploaded: uploaded.length, failed: failed.length, uploaded_paths: uploaded, errors: failed.length ? failed : undefined };
  }
};

export const lab = {
  experiments: (projectId, params) => api.get(`/api/projects/${projectId}/experiments`, { params }).then(r => r.data),
  researchSessions: (projectId) => api.get(`/api/projects/${projectId}/research-sessions`).then(r => r.data),
  createResearchSession: (projectId, body) => api.post(`/api/projects/${projectId}/research-sessions`, body).then(r => r.data),
  materialLibrary: (projectId) => api.get(`/api/projects/${projectId}/material-library`).then(r => r.data),
  addMaterial: (projectId, body) => api.post(`/api/projects/${projectId}/material-library`, body).then(r => r.data),
  importLog: (projectId, params) => api.get(`/api/projects/${projectId}/import/log`, { params }).then(r => r.data),
  syncToMatriya: (projectId) => api.post(`/api/projects/${projectId}/experiments/sync-to-matriya`).then(r => r.data),
  analysis: {
    contradictions: (projectId) => api.get(`/api/projects/${projectId}/analysis/contradictions`).then(r => r.data),
    failurePatterns: (projectId) => api.get(`/api/projects/${projectId}/analysis/failure-patterns`).then(r => r.data),
    researchSnapshot: (projectId, params) => api.get(`/api/projects/${projectId}/analysis/research-snapshot`, { params }).then(r => r.data),
    formulaValidate: (projectId, body) => api.post(`/api/projects/${projectId}/analysis/formula-validate`, body).then(r => r.data),
    relations: (projectId) => api.get(`/api/projects/${projectId}/analysis/relations`).then(r => r.data),
    insights: (projectId) => api.get(`/api/projects/${projectId}/analysis/insights`).then(r => r.data),
    formulationIntelligence: (projectId, body) => api.post(`/api/projects/${projectId}/analysis/formulation-intelligence`, body).then(r => r.data),
    similarExperiments: (projectId, experimentId) => api.get(`/api/projects/${projectId}/analysis/similar-experiments`, { params: { experiment_id: experimentId } }).then(r => r.data)
  },
  guard: (projectId, body) => api.post(`/api/projects/${projectId}/guard/check`, body).then(r => r.data)
};

export const runs = {
  list: (projectId, params) => api.get(`/api/projects/${projectId}/runs`, { params }).then(r => r.data),
  get: (projectId, runId) => api.get(`/api/projects/${projectId}/runs/${runId}`).then(r => r.data),
  create: (projectId, body) => api.post(`/api/projects/${projectId}/runs`, body).then(r => r.data),
  update: (projectId, runId, body) => api.patch(`/api/projects/${projectId}/runs/${runId}`, body).then(r => r.data),
  trace: (projectId, runId) => api.get(`/api/projects/${projectId}/runs/${runId}/trace`).then(r => r.data)
};

const RAG_RUN_TIMEOUT = 120000; // 2 min – research loop runs 4 agents

export const rag = {
  health: () => api.get('/api/rag/health').then(r => r.data),
  search: (body) => api.post('/api/rag/search', body).then(r => r.data),
  researchRun: (body) => api.post('/api/rag/research/run', body, { timeout: RAG_RUN_TIMEOUT }).then(r => r.data),
  researchSession: () => api.post('/api/rag/research/session', {}, { timeout: 15000 }).then(r => r.data)
};
