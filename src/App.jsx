import React from 'react';
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate, Navigate } from 'react-router-dom';
import { projects as projectsApi, users as usersApi, tasks as tasksApi, milestones as milestonesApi, documents as documentsApi, notes as notesApi, projectFiles as projectFilesApi, rag as ragApi, chat as chatApi, lab as labApi, auth as authApi, getStoredToken, getStoredUser, setAuth, clearAuth, getNetworkErrorMessage } from './api';
import t from './strings';

/** Ensure we never pass an object to setError (React cannot render objects). */
function errorMessageFromResponse(err, fallback) {
  const data = err?.response?.data;
  if (data == null) return typeof fallback === 'string' ? fallback : (err?.message || 'שגיאה');
  const msg = data.error ?? data.message;
  if (typeof msg === 'string') return msg;
  if (msg && typeof msg === 'object' && typeof msg.message === 'string') return msg.message;
  return typeof fallback === 'string' ? fallback : (err?.message || 'שגיאה');
}

function Home({ user, onLogout }) {
  const [projects, setProjects] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [showNew, setShowNew] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const [newDesc, setNewDesc] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [requestProject, setRequestProject] = React.useState(null);
  const [requestSending, setRequestSending] = React.useState(false);
  const [creatingProject, setCreatingProject] = React.useState(false);
  const [loadingProjectId, setLoadingProjectId] = React.useState(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    projectsApi.list().then(d => { setProjects(d.projects || []); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const filteredProjects = !search.trim() ? projects : projects.filter(p =>
    (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const onProjectClick = (p) => {
    if (loadingProjectId) return;
    setLoadingProjectId(p.id);
    projectsApi.getAccess(p.id)
      .then(access => {
        if (access.canAccess) navigate(`/project/${p.id}`);
        else setRequestProject({ project: p, hasPendingRequest: access.hasPendingRequest });
      })
      .catch(() => setRequestProject({ project: p, hasPendingRequest: false }))
      .finally(() => setLoadingProjectId(null));
  };

  const sendRequest = () => {
    if (!requestProject || requestProject.hasPendingRequest) return;
    setRequestSending(true);
    projectsApi.requestJoin(requestProject.project.id)
      .then(() => setRequestProject(prev => prev ? { ...prev, hasPendingRequest: true } : null))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setRequestSending(false));
  };

  const createProject = () => {
    if (!newName.trim()) return;
    setCreatingProject(true);
    projectsApi.create({ name: newName.trim(), description: newDesc.trim() || null })
      .then(p => { setShowNew(false); setNewName(''); setNewDesc(''); setProjects(prev => [p, ...prev]); navigate(`/project/${p.id}`); })
      .catch(e => setError(e.message))
      .finally(() => setCreatingProject(false));
  };

  return (
    <div className="app-shell app-shell-no-sidebar" dir="rtl">
      <main className="main">
        <header className="main-header">
          <div className="main-header-search">
            <input type="search" placeholder={t.searchProjects} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="main-header-actions">
            {user && (
              <>
                <div className="main-header-user">
                  <div className="main-header-avatar">{(user.username || 'A').charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="main-header-user-name">{user.username}</div>
                    <div className="main-header-user-email">{user.email || 'admin'}</div>
                  </div>
                </div>
                <button type="button" className="secondary" onClick={onLogout}>{t.logout}</button>
              </>
            )}
          </div>
        </header>
        <div className="main-content">
          <h1 className="page-title">{t.projects}</h1>
          <p className="page-subtitle">נהל את הפרויקטים והמשימות שלך במקום אחד.</p>
          {error && <p className="error">{error}</p>}
          <div className="main-content-toolbar">
            <button onClick={() => setShowNew(!showNew)}>{showNew ? t.cancel : `+ ${t.newProject}`}</button>
          </div>
        {showNew && (
          <div className="card">
            <h3>{t.newProject}</h3>
            <div className="form-group"><label>{t.name}</label><input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t.projectName} /></div>
            <div className="form-group"><label>{t.description}</label><textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder={t.optional} rows={2} /></div>
            <div className="flex gap"><button onClick={createProject} disabled={creatingProject} className={creatingProject ? 'btn-loading' : ''}>{creatingProject ? t.loading : t.create}</button><button className="secondary" onClick={() => setShowNew(false)} disabled={creatingProject}>{t.cancel}</button></div>
          </div>
        )}
        {loading && <p className="loading">{t.loading}</p>}
        {!loading && (
          <div className="grid-2">
            {filteredProjects.map(p => (
              <div key={p.id} className={`project-card ${loadingProjectId === p.id ? 'project-card-loading' : ''}`} onClick={() => onProjectClick(p)}>
                {loadingProjectId === p.id ? (
                  <p className="loading" style={{ margin: 0 }}>{t.loading}</p>
                ) : (
                  <>
                    <h3>{p.name}</h3>
                    <p>{p.description || t.noDescription}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        {!loading && filteredProjects.length === 0 && !showNew && <p className="loading">{search.trim() ? t.noResults : t.noProjectsYet}</p>}

        </div>
        {requestProject && (
          <div className="modal-overlay" onClick={() => setRequestProject(null)}>
            <div className="card modal" onClick={e => e.stopPropagation()}>
              <h3>{requestProject.project.name}</h3>
              <p className="error">{t.notPartOfProject}</p>
              {requestProject.hasPendingRequest ? (
                <p style={{ color: 'var(--muted)' }}>{t.requestPending}</p>
              ) : (
                <p>{t.sendRequestToOwner}</p>
              )}
              <div className="flex gap">
                {!requestProject.hasPendingRequest && (
                  <button onClick={sendRequest} disabled={requestSending}>{requestSending ? t.loading : t.sendRequestToOwner}</button>
                )}
                <button className="secondary" onClick={() => setRequestProject(null)}>{t.cancel}</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const TABS = ['overview', 'tasks', 'milestones', 'notes', 'lab', 'rag', 'chat', 'settings'];
const TAB_LABELS = { overview: `📊 ${t.overview}`, tasks: `📋 ${t.tasks}`, milestones: `🎯 ${t.milestones}`, notes: `📝 ${t.notes}`, lab: `🧪 ${t.labTab}`, rag: `📁 ${t.docsManagementTab}`, chat: `💬 ${t.chat}`, settings: `⚙️ ${t.settings}` };
const TAB_TITLES = { overview: t.overview, tasks: t.tasks, milestones: t.milestones, notes: t.notes, lab: t.labTab, rag: t.docsManagementTab, chat: t.chat, settings: t.settings };

function ProjectView({ user, onLogout }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = React.useState(null);
  const [projectRole, setProjectRole] = React.useState(null);
  const [fullScreenSection, setFullScreenSection] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!id) return;
    Promise.all([projectsApi.get(id), projectsApi.getAccess(id)])
      .then(([proj, access]) => { setProject(proj); setProjectRole(access.role); })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const [overviewCounts, setOverviewCounts] = React.useState({ tasks: 0, tasksDone: 0, milestones: 0, milestonesDone: 0, notes: 0 });
  React.useEffect(() => {
    if (!id) return;
    Promise.all([tasksApi.list(id), milestonesApi.list(id), notesApi.list(id)])
      .then(([tRes, mRes, nRes]) => {
        const tasks = tRes.tasks || [];
        const milestones = mRes.milestones || [];
        const notes = nRes.notes || [];
        const tasksDone = tasks.filter(t => t.status === 'done').length;
        const milestonesDone = milestones.filter(m => m.completed_at).length;
        setOverviewCounts({ tasks: tasks.length, tasksDone, milestones: milestones.length, milestonesDone, notes: notes.length });
      })
      .catch(() => {});
  }, [id]);

  if (loading || !project) return <div className="app-shell" dir="rtl"><main className="main"><div className="main-content"><p className="loading">{t.loading}</p></div></main></div>;
  if (error) return <div className="app-shell" dir="rtl"><main className="main"><div className="main-content"><p className="error">{error}</p><button onClick={() => navigate('/')}>{t.back}</button></div></main></div>;

  const taskPending = overviewCounts.tasks - overviewCounts.tasksDone;

  return (
    <div className="app-shell app-shell-no-sidebar" dir="rtl">
      <main className="main">
        <header className="main-header">
          <div className="main-header-search">
            <input type="search" placeholder="חיפוש משימה..." dir="rtl" />
          </div>
          <div className="main-header-actions">
            <Link to="/" className="header-link">📊 {t.allProjects}</Link>
            {user && (
              <>
                <div className="main-header-user">
                  <div className="main-header-avatar">{(user.username || 'A').charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="main-header-user-name">{user.username}</div>
                    <div className="main-header-user-email">{user.email || 'admin'}</div>
                  </div>
                </div>
                <button type="button" className="secondary" onClick={onLogout}>{t.logout}</button>
              </>
            )}
          </div>
        </header>
        <div className="main-content">
          <div className="flex gap" style={{ alignItems: 'center', marginBottom: 8 }}>
            <button className="secondary" onClick={() => navigate('/')}>← {t.back}</button>
          </div>
          <h1 className="page-title">{project.name}</h1>
          {project.description ? <p className="page-subtitle">{project.description}</p> : <p className="page-subtitle">תכנן, עדכן והשלם משימות ואבני דרך.</p>}
          <div className="overview-cards-row">
            <div className="overview-card-item primary">
              <span className="card-icon">📋</span>
              <div className="overview-card-value">{overviewCounts.tasks}</div>
              <div className="overview-card-label">{t.tasksCount}</div>
              <div className="overview-card-meta">{overviewCounts.tasksDone} {t.completed}</div>
            </div>
            <div className="overview-card-item">
              <span className="card-icon">✓</span>
              <div className="overview-card-value">{overviewCounts.tasksDone}</div>
              <div className="overview-card-label">{t.completed}</div>
              <div className="overview-card-meta">{t.tasks}</div>
            </div>
            <div className="overview-card-item">
              <span className="card-icon">🎯</span>
              <div className="overview-card-value">{overviewCounts.milestones}</div>
              <div className="overview-card-label">{t.milestonesCount}</div>
              <div className="overview-card-meta">{overviewCounts.milestonesDone} {t.completedMilestones}</div>
            </div>
            <div className="overview-card-item">
              <span className="card-icon">📝</span>
              <div className="overview-card-value">{overviewCounts.notes}</div>
              <div className="overview-card-label">{t.notesCount}</div>
              <div className="overview-card-meta">{t.notes}</div>
            </div>
          </div>
          <div className="widgets-grid">
            {TABS.map(tabId => (
              <button key={tabId} type="button" className="widget-card" onClick={() => setFullScreenSection(tabId)}>
                <span className="widget-card-icon">{tabId === 'overview' ? '📊' : tabId === 'tasks' ? '📋' : tabId === 'milestones' ? '🎯' : tabId === 'notes' ? '📝' : tabId === 'lab' ? '🧪' : tabId === 'rag' ? '📁' : tabId === 'chat' ? '💬' : '⚙️'}</span>
                <span className="widget-card-title">{TAB_TITLES[tabId]}</span>
                {tabId === 'overview' && <span className="widget-card-meta">{overviewCounts.tasks} {t.tasks}, {overviewCounts.milestones} {t.milestones}</span>}
                {tabId === 'tasks' && <span className="widget-card-meta">{overviewCounts.tasks} {t.tasks}</span>}
                {tabId === 'milestones' && <span className="widget-card-meta">{overviewCounts.milestones} {t.milestones}</span>}
                {tabId === 'notes' && <span className="widget-card-meta">{overviewCounts.notes} {t.notes}</span>}
              </button>
            ))}
          </div>
          {fullScreenSection && (
            <div className="fullscreen-overlay" role="dialog" aria-modal="true" aria-label={TAB_LABELS[fullScreenSection]}>
              <div className="fullscreen-content">
                <div className="fullscreen-header">
                  <h2 className="fullscreen-title">{TAB_LABELS[fullScreenSection]}</h2>
                  <button type="button" className="fullscreen-close" onClick={() => setFullScreenSection(null)} aria-label={t.cancel}>×</button>
                </div>
                <div className="fullscreen-body modal-scroll">
                  {fullScreenSection === 'overview' && <Overview projectId={id} project={project} />}
                  {fullScreenSection === 'tasks' && <TasksTab projectId={id} />}
                  {fullScreenSection === 'milestones' && <MilestonesTab projectId={id} />}
                  {fullScreenSection === 'notes' && <NotesTab projectId={id} />}
                  {fullScreenSection === 'lab' && <LabTab projectId={id} />}
                  {fullScreenSection === 'rag' && <RagTab projectId={id} />}
                  {fullScreenSection === 'chat' && <ChatTab projectId={id} />}
                  {fullScreenSection === 'settings' && <SettingsTab projectId={id} project={project} setProject={setProject} navigate={navigate} projectRole={projectRole} user={user} />}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function isOverdueDate(dateStr) {
  if (!dateStr) return false;
  return dateStr < new Date().toISOString().slice(0, 10);
}

function Overview({ projectId, project }) {
  const [tasks, setTasks] = React.useState([]);
  const [milestones, setMilestones] = React.useState([]);
  const [notesCount, setNotesCount] = React.useState(0);
  const [filesCount, setFilesCount] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      tasksApi.list(projectId),
      milestonesApi.list(projectId),
      notesApi.list(projectId),
      projectFilesApi.list(projectId)
    ]).then(([tRes, mRes, nRes, fRes]) => {
      setTasks(tRes.tasks || []);
      setMilestones(mRes.milestones || []);
      setNotesCount((nRes.notes || []).length);
      setFilesCount((fRes.files || []).length);
      setLoading(false);
    });
  }, [projectId]);

  const taskDone = tasks.filter(x => x.status === 'done').length;
  const progress = tasks.length ? Math.round((taskDone / tasks.length) * 100) : 0;
  const statusBreakdown = { todo: 0, in_progress: 0, in_review: 0, done: 0 };
  tasks.forEach(t => { if (statusBreakdown[t.status] !== undefined) statusBreakdown[t.status]++; });
  const maxStatus = Math.max(1, ...Object.values(statusBreakdown));
  const overdueTasks = tasks.filter(t => t.status !== 'done' && isOverdueDate(t.due_date));
  const milestonesDone = milestones.filter(m => m.completed_at).length;
  const milestonesProgress = milestones.length ? Math.round((milestonesDone / milestones.length) * 100) : 0;
  const priorityBreakdown = { high: 0, medium: 0, low: 0 };
  tasks.forEach(t => { if (priorityBreakdown[t.priority] !== undefined) priorityBreakdown[t.priority]++; });
  const maxPriority = Math.max(1, ...Object.values(priorityBreakdown));
  const upcoming = milestones.filter(m => !m.completed_at && m.due_date).sort((a, b) => (a.due_date || '').localeCompare(b.due_date || '')).slice(0, 5);

  const exportSummary = () => {
    const name = (project && project.name) || 'project';
    const lines = [name, project && project.description ? project.description : '', '', '--- משימות ---', ...tasks.map(x => `[${x.status}] ${x.priority} ${x.title}${x.due_date ? ' (' + x.due_date + ')' : ''}`), '', '--- אבני דרך ---', ...milestones.map(m => `${m.completed_at ? '[✓]' : '[ ]'} ${m.title}${m.due_date ? ' — ' + m.due_date : ''}${m.description ? '\n  ' + m.description : ''}`)];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${name.replace(/[^\w\s-]/g, '')}_summary.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (loading) return <div className="card tab-card"><p className="loading">{t.loading}</p></div>;

  return (
    <div className="card tab-card overview-card">
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <h3>{t.overview}</h3>
        <button type="button" className="secondary" onClick={exportSummary}>{t.exportSummary}</button>
      </div>

      <div className="overview-summary">
        <span>{t.tasksCount}: <strong>{tasks.length}</strong></span>
        <span>{t.milestonesCount}: <strong>{milestones.length}</strong></span>
        <span>{t.notesCount}: <strong>{notesCount}</strong></span>
        <span>{t.filesCount}: <strong>{filesCount}</strong></span>
      </div>

      {tasks.length > 0 && (
        <>
          <div className="overview-section">
            <label>{t.taskProgress}</label>
            <div className="overview-stats-inline">{taskDone} / {tasks.length} {t.completed} — {progress}%</div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          </div>

          <div className="overview-section">
            <label>{t.taskStatusBreakdown}</label>
            <div className="overview-bar-chart">
              {['todo', 'in_progress', 'in_review', 'done'].map(col => (
                <div key={col} className="overview-bar-row">
                  <span className="overview-bar-legend">{TASK_COLUMN_LABELS[col]}</span>
                  <div className="overview-bar-track">
                    <div className={`overview-bar-segment overview-bar-${col}`} style={{ width: `${(statusBreakdown[col] / maxStatus) * 100}%` }} />
                  </div>
                  <span className="overview-bar-value">{statusBreakdown[col]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overview-section">
            <label>{t.byPriority}</label>
            <div className="overview-bar-chart">
              {['high', 'medium', 'low'].map(p => (
                <div key={p} className="overview-bar-row">
                  <span className="overview-bar-legend">{p === 'high' ? t.high : p === 'medium' ? t.medium : t.low}</span>
                  <div className="overview-bar-track">
                    <div className={`overview-bar-segment overview-bar-priority-${p}`} style={{ width: `${(priorityBreakdown[p] / maxPriority) * 100}%` }} />
                  </div>
                  <span className="overview-bar-value">{priorityBreakdown[p]}</span>
                </div>
              ))}
            </div>
          </div>

          {overdueTasks.length > 0 && (
            <div className="overview-section overview-overdue">
              <label>{t.overdueTasks} ({overdueTasks.length})</label>
              <ul className="upcoming-list">
                {overdueTasks.slice(0, 8).map(t => <li key={t.id}>{t.title}{t.due_date ? ' — ' + t.due_date : ''}</li>)}
              </ul>
              {overdueTasks.length > 8 && <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>+{overdueTasks.length - 8} עוד</p>}
            </div>
          )}
          {overdueTasks.length === 0 && tasks.some(t => t.status !== 'done') && <p style={{ color: 'var(--success)', fontSize: '0.9rem', marginTop: 8 }}>{t.noOverdue}</p>}
        </>
      )}

      {milestones.length > 0 && (
        <div className="overview-section">
          <label>{t.milestonesProgress}</label>
          <div className="overview-stats-inline">{milestonesDone} / {milestones.length} {t.completedMilestones} — {milestonesProgress}%</div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${milestonesProgress}%` }} /></div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="overview-section">
          <label>{t.upcomingMilestones}</label>
          <ul className="upcoming-list">
            {upcoming.map(m => <li key={m.id}>{m.title} — {m.due_date}</li>)}
          </ul>
        </div>
      )}
      {milestones.length > 0 && upcoming.length === 0 && <p style={{ color: 'var(--muted)', marginTop: 8 }}>{t.noUpcomingMilestones}</p>}
    </div>
  );
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return dateStr < new Date().toISOString().slice(0, 10);
}

const TASK_COLUMNS = ['todo', 'in_progress', 'in_review', 'done'];
const TASK_COLUMN_LABELS = { todo: t.todo, in_progress: t.inProgress, in_review: t.inReview, done: t.done };

function TasksTab({ projectId }) {
  const [list, setList] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showNew, setShowNew] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [status, setStatus] = React.useState('todo');
  const [priority, setPriority] = React.useState('medium');
  const [search, setSearch] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [removingId, setRemovingId] = React.useState(null);

  const load = () => tasksApi.list(projectId).then(d => { setList(d.tasks || []); setLoading(false); });
  React.useEffect(() => { load(); }, [projectId]);

  const create = () => {
    if (!title.trim()) return;
    setCreating(true);
    const today = new Date().toISOString().slice(0, 10);
    tasksApi.create(projectId, { title: title.trim(), status, priority, due_date: today })
      .then(() => { setTitle(''); setShowNew(false); load(); })
      .finally(() => setCreating(false));
  };

  const updateStatus = (taskId, newStatus) => {
    tasksApi.update(projectId, taskId, { status: newStatus }).then(load);
  };

  const remove = (taskId) => {
    if (!window.confirm(t.deleteTaskConfirm)) return;
    setRemovingId(taskId);
    tasksApi.delete(projectId, taskId).then(load).finally(() => setRemovingId(null));
  };

  const priorityLabel = (p) => ({ low: t.low, medium: t.medium, high: t.high }[p] || p);
  const filteredList = !search.trim() ? list : list.filter(task => (task.title || '').toLowerCase().includes(search.toLowerCase()));
  const byColumn = TASK_COLUMNS.reduce((acc, col) => { acc[col] = filteredList.filter(t => t.status === col); return acc; }, {});

  return (
    <div className="card tab-card tasks-kanban">
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <h3>{t.tasks}</h3>
        <div className="flex gap" style={{ flexWrap: 'wrap' }}>
          <input type="search" placeholder={t.searchInList} value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 180 }} />
          <button onClick={() => setShowNew(!showNew)}>{showNew ? t.cancel : `+ ${t.addTask}`}</button>
        </div>
      </div>
      {showNew && (
        <div className="form-group flex gap" style={{ flexWrap: 'wrap', marginBottom: 16, padding: 12, background: 'var(--bg)', borderRadius: 8 }}>
          <input placeholder={t.taskTitle} value={title} onChange={e => setTitle(e.target.value)} style={{ maxWidth: 280 }} />
          <select value={status} onChange={e => setStatus(e.target.value)} style={{ width: 120 }}>
            {TASK_COLUMNS.map(col => <option key={col} value={col}>{TASK_COLUMN_LABELS[col]}</option>)}
          </select>
          <select value={priority} onChange={e => setPriority(e.target.value)} style={{ width: 100 }}>
            <option value="low">{t.low}</option>
            <option value="medium">{t.medium}</option>
            <option value="high">{t.high}</option>
          </select>
          <button onClick={create} disabled={creating} className={creating ? 'btn-loading' : ''}>{creating ? t.loading : t.add}</button>
        </div>
      )}
      {loading && <p className="loading">{t.loading}</p>}
      {!loading && (
        <div className="kanban-board">
          {TASK_COLUMNS.map(col => (
            <div key={col} className="kanban-column">
              <div className="kanban-column-header">
                <span>{TASK_COLUMN_LABELS[col]}</span>
                <span className="kanban-count">{(byColumn[col] || []).length}</span>
              </div>
              <div className="kanban-column-cards">
                {(byColumn[col] || []).map(task => (
                  <div key={task.id} className={`kanban-card ${task.status !== 'done' && isOverdue(task.due_date) ? 'overdue' : ''}`}>
                    <div className="kanban-card-body">
                      <span className={`badge badge-${task.priority}`}>{priorityLabel(task.priority)}</span>
                      <span className="kanban-card-title">{task.title}</span>
                      {task.due_date && <span className="kanban-card-meta">{task.due_date}{task.status !== 'done' && isOverdue(task.due_date) ? ' · ' + t.overdue : ''}</span>}
                    </div>
                    <div className="kanban-card-actions">
                      <select value={task.status} onChange={e => updateStatus(task.id, e.target.value)} className="kanban-move-select" aria-label={t.tasks}>
                        {TASK_COLUMNS.map(c => <option key={c} value={c}>{TASK_COLUMN_LABELS[c]}</option>)}
                      </select>
                      <button type="button" className={`secondary kanban-delete ${removingId === task.id ? 'btn-loading' : ''}`} onClick={() => remove(task.id)} disabled={removingId === task.id}>{removingId === task.id ? t.loading : t.delete}</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && list.length === 0 && <p className="loading">{t.noTasksYet}</p>}
    </div>
  );
}

function MilestonesTab({ projectId }) {
  const [list, setList] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showNew, setShowNew] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [dueDate, setDueDate] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [sortBy, setSortBy] = React.useState('date');
  const [creating, setCreating] = React.useState(false);
  const [togglingId, setTogglingId] = React.useState(null);
  const [removingId, setRemovingId] = React.useState(null);

  const load = () => milestonesApi.list(projectId).then(d => { setList(d.milestones || []); setLoading(false); });
  React.useEffect(() => { load(); }, [projectId]);

  const create = () => {
    if (!title.trim()) return;
    setCreating(true);
    milestonesApi.create(projectId, { title: title.trim(), due_date: dueDate || null, description: description.trim() || null })
      .then(() => { setTitle(''); setDueDate(''); setDescription(''); setShowNew(false); load(); })
      .finally(() => setCreating(false));
  };

  let filteredList = !search.trim() ? list : list.filter(m => (m.title || '').toLowerCase().includes(search.toLowerCase()) || (m.description || '').toLowerCase().includes(search.toLowerCase()));
  filteredList = [...filteredList].sort((a, b) => sortBy === 'title' ? (a.title || '').localeCompare(b.title || '') : (a.due_date || '').localeCompare(b.due_date || ''));

  const toggleComplete = (m) => {
    setTogglingId(m.id);
    milestonesApi.update(projectId, m.id, { completed_at: m.completed_at ? null : new Date().toISOString() }).then(load).finally(() => setTogglingId(null));
  };

  const remove = (milestoneId) => {
    if (!window.confirm(t.deleteMilestoneConfirm)) return;
    setRemovingId(milestoneId);
    milestonesApi.delete(projectId, milestoneId).then(load).finally(() => setRemovingId(null));
  };

  return (
    <div className="card tab-card">
      <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <h3>{t.milestones}</h3>
        <button onClick={() => setShowNew(!showNew)}>{showNew ? t.cancel : `+ ${t.addMilestone}`}</button>
      </div>
      {showNew && (
        <div className="form-group" style={{ marginBottom: 16 }}>
          <div className="flex gap" style={{ flexWrap: 'wrap' }}>
            <input placeholder={t.milestoneTitle} value={title} onChange={e => setTitle(e.target.value)} style={{ maxWidth: 280 }} />
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: 160 }} />
            <button onClick={create} disabled={creating} className={creating ? 'btn-loading' : ''}>{creating ? t.loading : t.add}</button>
          </div>
          <label className="mt-8">{t.milestoneDescription}</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t.optional} rows={2} style={{ marginTop: 4 }} />
        </div>
      )}
      <div className="flex gap" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        <input type="search" placeholder={t.searchInList} value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 240 }} />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 120 }}>
          <option value="date">{t.sortByDate}</option>
          <option value="title">{t.sortByTitle}</option>
        </select>
      </div>
      {loading && <p className="loading">{t.loading}</p>}
      {!loading && filteredList.map(m => (
        <div key={m.id} className={`list-item ${!m.completed_at && isOverdue(m.due_date) ? 'overdue' : ''}`}>
            <span>
              {m.title} {m.due_date && <span style={{ color: 'var(--muted)' }}>({m.due_date}{!m.completed_at && isOverdue(m.due_date) ? ' · ' + t.overdue : ''})</span>} {m.description && <span style={{ color: 'var(--muted)', fontSize: '0.9rem', display: 'block', marginTop: 4 }}>{m.description}</span>}
              <button type="button" className={`secondary ${togglingId === m.id ? 'btn-loading' : ''}`} style={{ marginTop: 6 }} onClick={() => toggleComplete(m)} disabled={togglingId === m.id}>{togglingId === m.id ? t.loading : (m.completed_at ? t.unmarkCompleted : t.markAsCompleted)}</button>
            </span>
          <button className={`secondary ${removingId === m.id ? 'btn-loading' : ''}`} onClick={() => remove(m.id)} disabled={removingId === m.id}>{removingId === m.id ? t.loading : t.delete}</button>
        </div>
      ))}
      {!loading && list.length === 0 && <p className="loading">{t.noMilestonesYet}</p>}
      {!loading && list.length > 0 && filteredList.length === 0 && <p className="loading">{t.noResults}</p>}
    </div>
  );
}

function DocumentsTab({ projectId }) {
  const [list, setList] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showNew, setShowNew] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [removingId, setRemovingId] = React.useState(null);

  const load = () => documentsApi.list(projectId).then(d => { setList(d.documents || []); setLoading(false); });
  React.useEffect(() => { load(); }, [projectId]);

  const filteredList = !search.trim() ? list : list.filter(d => (d.title || '').toLowerCase().includes(search.toLowerCase()) || (d.content || '').toLowerCase().includes(search.toLowerCase()));

  const create = () => {
    if (!title.trim()) return;
    setCreating(true);
    documentsApi.create(projectId, { title: title.trim(), content: content.trim() || null })
      .then(() => { setTitle(''); setContent(''); setShowNew(false); load(); })
      .finally(() => setCreating(false));
  };

  const saveEdit = () => {
    if (!editing || !title.trim()) return;
    setSaving(true);
    documentsApi.update(projectId, editing.id, { title: title.trim(), content: content.trim() || null })
      .then(() => { setEditing(null); setTitle(''); setContent(''); load(); })
      .finally(() => setSaving(false));
  };

  const remove = (docId) => {
    if (!window.confirm(t.deleteDocumentConfirm)) return;
    setRemovingId(docId);
    documentsApi.delete(projectId, docId).then(load).finally(() => setRemovingId(null));
  };

  return (
    <div className="card tab-card">
      <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <h3>{t.documents}</h3>
        <button onClick={() => { setShowNew(!showNew); setEditing(null); }}>{showNew ? t.cancel : `+ ${t.addDocument}`}</button>
      </div>
      {showNew && !editing && (
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>{t.title}</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t.documentTitle} />
          <label className="mt-16">{t.content}</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder={t.optionalContent} rows={4} />
          <div className="flex gap mt-16"><button onClick={create} disabled={creating} className={creating ? 'btn-loading' : ''}>{creating ? t.loading : t.create}</button></div>
        </div>
      )}
      {editing && (
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>{t.title}</label>
          <input value={title} onChange={e => setTitle(e.target.value)} />
          <label className="mt-16">{t.content}</label>
          <textarea value={content} onChange={e => setContent(e.target.value)} rows={4} />
          <div className="flex gap mt-16"><button onClick={saveEdit} disabled={saving} className={saving ? 'btn-loading' : ''}>{saving ? t.loading : t.save}</button><button className="secondary" onClick={() => { setEditing(null); setTitle(''); setContent(''); }} disabled={saving}>{t.cancel}</button></div>
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <input type="search" placeholder={t.searchInList} value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 240 }} />
      </div>
      {loading && <p className="loading">{t.loading}</p>}
      {!loading && filteredList.map(d => (
        <div key={d.id} className="list-item">
          <span>{d.title}</span>
          <div className="flex gap">
            <button className="secondary" onClick={() => { setEditing(d); setTitle(d.title); setContent(d.content || ''); setShowNew(false); }} disabled={saving}>{t.edit}</button>
            <button className={`secondary ${removingId === d.id ? 'btn-loading' : ''}`} onClick={() => remove(d.id)} disabled={removingId === d.id}>{removingId === d.id ? t.loading : t.delete}</button>
          </div>
        </div>
      ))}
      {!loading && list.length === 0 && <p className="loading">{t.noDocumentsYet}</p>}
      {!loading && list.length > 0 && filteredList.length === 0 && <p className="loading">{t.noResults}</p>}
    </div>
  );
}

function NotesTab({ projectId }) {
  const [list, setList] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [showNew, setShowNew] = React.useState(false);
  const [editing, setEditing] = React.useState(null);
  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [removingId, setRemovingId] = React.useState(null);

  const load = () => notesApi.list(projectId).then(d => { setList(d.notes || []); setLoading(false); });
  React.useEffect(() => { load(); }, [projectId]);

  const filteredList = !search.trim() ? list : list.filter(n => (n.title || '').toLowerCase().includes(search.toLowerCase()) || (n.body || '').toLowerCase().includes(search.toLowerCase()));

  const create = () => {
    setCreating(true);
    notesApi.create(projectId, { title: title.trim() || t.untitled, body: body.trim() || null })
      .then(() => { setTitle(''); setBody(''); setShowNew(false); load(); })
      .finally(() => setCreating(false));
  };

  const saveEdit = () => {
    if (!editing) return;
    setSaving(true);
    notesApi.update(projectId, editing.id, { title: title.trim() || t.untitled, body: body.trim() || null })
      .then(() => { setEditing(null); setTitle(''); setBody(''); load(); })
      .finally(() => setSaving(false));
  };

  const remove = (noteId) => {
    if (!window.confirm(t.deleteNoteConfirm)) return;
    setRemovingId(noteId);
    notesApi.delete(projectId, noteId).then(load).finally(() => setRemovingId(null));
  };

  return (
    <div className="card tab-card">
      <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 16 }}>
        <h3>{t.notes}</h3>
        <button onClick={() => { setShowNew(!showNew); setEditing(null); }}>{showNew ? t.cancel : `+ ${t.addNote}`}</button>
      </div>
      {showNew && !editing && (
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>{t.title}</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t.noteTitle} />
          <label className="mt-16">{t.body}</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder={t.noteContent} rows={4} />
          <div className="flex gap mt-16"><button onClick={create} disabled={creating} className={creating ? 'btn-loading' : ''}>{creating ? t.loading : t.create}</button></div>
        </div>
      )}
      {editing && (
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>{t.title}</label>
          <input value={title} onChange={e => setTitle(e.target.value)} />
          <label className="mt-16">{t.body}</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} />
          <div className="flex gap mt-16"><button onClick={saveEdit} disabled={saving} className={saving ? 'btn-loading' : ''}>{saving ? t.loading : t.save}</button><button className="secondary" onClick={() => { setEditing(null); setTitle(''); setBody(''); }} disabled={saving}>{t.cancel}</button></div>
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <input type="search" placeholder={t.searchInList} value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 240 }} />
      </div>
      {loading && <p className="loading">{t.loading}</p>}
      {!loading && filteredList.map(n => (
        <div key={n.id} className="list-item">
          <span>{n.title || t.untitled}</span>
          <div className="flex gap">
            <button className="secondary" onClick={() => { setEditing(n); setTitle(n.title || ''); setBody(n.body || ''); setShowNew(false); }} disabled={saving}>{t.edit}</button>
            <button className={`secondary ${removingId === n.id ? 'btn-loading' : ''}`} onClick={() => remove(n.id)} disabled={removingId === n.id}>{removingId === n.id ? t.loading : t.delete}</button>
          </div>
        </div>
      ))}
      {!loading && list.length === 0 && <p className="loading">{t.noNotesYet}</p>}
      {!loading && list.length > 0 && filteredList.length === 0 && <p className="loading">{t.noResults}</p>}
    </div>
  );
}

function LabTab({ projectId }) {
  const [experiments, setExperiments] = React.useState([]);
  const [sessions, setSessions] = React.useState([]);
  const [materials, setMaterials] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [contradictions, setContradictions] = React.useState(null);
  const [failurePatterns, setFailurePatterns] = React.useState(null);
  const [snapshot, setSnapshot] = React.useState(null);
  const [relations, setRelations] = React.useState(null);
  const [insights, setInsights] = React.useState(null);
  const [formulaValidateInput, setFormulaValidateInput] = React.useState('');
  const [formulaValidateResult, setFormulaValidateResult] = React.useState(null);
  const [guardInput, setGuardInput] = React.useState('');
  const [guardResult, setGuardResult] = React.useState(null);
  const [formulationInput, setFormulationInput] = React.useState('');
  const [formulationResult, setFormulationResult] = React.useState(null);
  const [similarExperimentId, setSimilarExperimentId] = React.useState('');
  const [similarResult, setSimilarResult] = React.useState(null);
  const [activeSection, setActiveSection] = React.useState('insights');

  const load = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      labApi.experiments(projectId),
      labApi.researchSessions(projectId),
      labApi.materialLibrary(projectId)
    ]).then(([eRes, sRes, mRes]) => {
      setExperiments(eRes.experiments || []);
      setSessions(sRes.sessions || []);
      setMaterials(mRes.materials || []);
      setLoading(false);
    }).catch(err => { setError(err.response?.data?.error || err.message); setLoading(false); });
  };
  React.useEffect(() => { if (projectId) load(); }, [projectId]);
  React.useEffect(() => { if (projectId && activeSection === 'insights' && !insights) loadInsights(); }, [projectId, activeSection]);

  const loadContradictions = () => labApi.analysis.contradictions(projectId).then(d => setContradictions(d)).catch(() => setContradictions({ contradictions: [] }));
  const loadFailurePatterns = () => labApi.analysis.failurePatterns(projectId).then(d => setFailurePatterns(d)).catch(() => setFailurePatterns(null));
  const loadSnapshot = () => labApi.analysis.researchSnapshot(projectId).then(d => setSnapshot(d)).catch(() => setSnapshot(null));
  const loadRelations = () => labApi.analysis.relations(projectId).then(d => setRelations(d)).catch(() => setRelations(null));
  const loadInsights = () => labApi.analysis.insights(projectId).then(d => setInsights(d)).catch(() => setInsights(null));

  const runFormulaValidate = () => {
    setFormulaValidateResult(null);
    labApi.analysis.formulaValidate(projectId, { formula: formulaValidateInput }).then(d => setFormulaValidateResult(d)).catch(err => setFormulaValidateResult({ valid: false, errors: [err.response?.data?.error || err.message] }));
  };
  const runGuard = () => {
    setGuardResult(null);
    labApi.guard(projectId, { formula: guardInput }).then(d => setGuardResult(d)).catch(err => setGuardResult({ allowed: false, warnings: [{ message: err.response?.data?.error || err.message }] }));
  };
  const runFormulationIntelligence = () => {
    setFormulationResult(null);
    const body = { formula: formulationInput };
    try {
      const parsed = formulationInput.trim() ? JSON.parse(formulationInput) : {};
      if (typeof parsed === 'object' && parsed !== null) {
        body.formula = parsed.formula ?? formulationInput;
        body.domain = parsed.domain;
        body.materials = parsed.materials;
        body.percentages = parsed.percentages;
      }
    } catch (_) { body.formula = formulationInput; }
    labApi.analysis.formulationIntelligence(projectId, body).then(d => setFormulationResult(d)).catch(err => setFormulationResult({ status: 'Risk', issues: [{ message: err.response?.data?.error || err.message }] }));
  };
  const runSimilarExperiments = () => {
    setSimilarResult(null);
    labApi.analysis.similarExperiments(projectId, similarExperimentId.trim()).then(d => setSimilarResult(d)).catch(err => setSimilarResult({ error: err.response?.data?.error || err.message }));
  };

  const sections = [
    { id: 'insights', label: t.labInsights },
    { id: 'contradictions', label: t.labContradictions },
    { id: 'failure-patterns', label: t.labFailurePatterns },
    { id: 'snapshot', label: t.labResearchSnapshot },
    { id: 'formula-validate', label: t.labFormulaValidator },
    { id: 'formulation-intelligence', label: t.labFormulationIntelligence },
    { id: 'similar-experiments', label: t.labSimilarExperiments },
    { id: 'relations', label: t.labRelations },
    { id: 'guard', label: t.labResearchGuard },
    { id: 'experiments', label: t.labExperimentsList }
  ];

  if (loading && experiments.length === 0) return <div className="card tab-card"><p className="loading">{t.loading}</p></div>;
  if (error) return <div className="card tab-card"><p className="error">{error}</p><button type="button" className="secondary" onClick={load}>{t.retry}</button></div>;

  return (
    <div className="card tab-card">
      <h3 style={{ marginBottom: 16 }}>{t.labTab}</h3>
      <div className="flex gap" style={{ flexWrap: 'wrap', marginBottom: 16 }}>
        {sections.map(s => (
          <button key={s.id} type="button" className={activeSection === s.id ? 'active' : 'secondary'} onClick={() => { setActiveSection(s.id); if (s.id === 'contradictions' && !contradictions) loadContradictions(); if (s.id === 'failure-patterns' && !failurePatterns) loadFailurePatterns(); if (s.id === 'snapshot' && !snapshot) loadSnapshot(); if (s.id === 'relations' && !relations) loadRelations(); if (s.id === 'insights') loadInsights(); }}>{s.label}</button>
        ))}
      </div>

      {activeSection === 'insights' && (
        <section className="rag-section">
          {insights ? (
            <div>
              <p><strong>{t.labInsightsSummary}</strong> {insights.total_experiments} {t.labExperiments}, {insights.success_rate_pct}% {t.labSuccessRate}, {insights.failure_count} {t.labFailures}.</p>
              {insights.by_domain?.length > 0 && <div style={{ marginTop: 12 }}><label>{t.labByDomain}</label><ul style={{ margin: 0, paddingRight: 20 }}>{insights.by_domain.slice(0, 10).map((d, i) => <li key={i}>{d.domain}: {d.total} ({d.success_rate}% success)</li>)}</ul></div>}
            </div>
          ) : <p className="muted">{t.labLoadInsights}</p>}
          <button type="button" className="secondary" onClick={loadInsights} style={{ marginTop: 8 }}>{t.refresh}</button>
        </section>
      )}

      {activeSection === 'contradictions' && (
        <section className="rag-section">
          {contradictions && <div><p>{contradictions.contradictions?.length ? t.labContradictionsFound(contradictions.contradictions.length) : t.labNoContradictions}</p>{contradictions.contradictions?.map((c, i) => <div key={i} className="card" style={{ marginTop: 8, padding: 12 }}><strong>{t.labSameFormulaDifferentOutcomes}</strong><ul style={{ margin: 0, paddingRight: 20 }}>{c.experiments?.map((e, j) => <li key={j}>{e.experiment_id}: {e.experiment_outcome}</li>)}</ul></div>)}</div>}
          <button type="button" className="secondary" onClick={loadContradictions}>{contradictions ? t.refresh : t.load}</button>
        </section>
      )}

      {activeSection === 'failure-patterns' && (
        <section className="rag-section">
          {failurePatterns && <div><p>{t.labFailureCount(failurePatterns.failure_count)}</p><p>{t.labByDomain}</p><ul style={{ margin: 0, paddingRight: 20 }}>{(failurePatterns.by_domain || []).map(([name, count], i) => <li key={i}>{name}: {count}</li>)}</ul><p style={{ marginTop: 8 }}>{t.labByMaterial}</p><ul style={{ margin: 0, paddingRight: 20 }}>{(failurePatterns.by_material || []).slice(0, 15).map(([name, count], i) => <li key={i}>{name}: {count}</li>)}</ul></div>}
          <button type="button" className="secondary" onClick={loadFailurePatterns}>{failurePatterns ? t.refresh : t.load}</button>
        </section>
      )}

      {activeSection === 'snapshot' && (
        <section className="rag-section">
          {snapshot && <div><p>{t.labSnapshotTotal(snapshot.total)}</p><p>success: {snapshot.outcomes?.success ?? 0}, failure: {snapshot.outcomes?.failure ?? 0}, partial: {snapshot.outcomes?.partial ?? 0}, production: {snapshot.outcomes?.production_formula ?? 0}</p>{(snapshot.by_domain?.length > 0) && <ul style={{ margin: 0, paddingRight: 20 }}>{snapshot.by_domain.map(([d, n], i) => <li key={i}>{d}: {n}</li>)}</ul>}</div>}
          <button type="button" className="secondary" onClick={loadSnapshot}>{snapshot ? t.refresh : t.load}</button>
        </section>
      )}

      {activeSection === 'formula-validate' && (
        <section className="rag-section">
          <label>{t.labFormulaValidator}</label>
          <textarea className="form-control" dir="ltr" rows={3} placeholder={t.labFormulaPlaceholder} value={formulaValidateInput} onChange={e => setFormulaValidateInput(e.target.value)} />
          <button type="button" onClick={runFormulaValidate} style={{ marginTop: 8 }}>{t.validate}</button>
          {formulaValidateResult && <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-soft)', borderRadius: 8 }}><p>{formulaValidateResult.valid !== false ? t.labFormulaValid : t.labFormulaInvalid}</p>{(formulaValidateResult.warnings || []).length > 0 && <ul style={{ paddingRight: 20 }}>{formulaValidateResult.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}{(formulaValidateResult.errors || []).length > 0 && <ul style={{ paddingRight: 20 }}>{formulaValidateResult.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}{(formulaValidateResult.similar_experiments || []).length > 0 && <p>{t.labSimilarExperiments}: {formulaValidateResult.similar_experiments.length}</p>}</div>}
        </section>
      )}

      {activeSection === 'formulation-intelligence' && (
        <section className="rag-section">
          <label>{t.labFormulationIntelligence}</label>
          <p className="muted" style={{ marginBottom: 8 }}>{t.labFormulationIntelligenceHint}</p>
          <textarea className="form-control" dir="ltr" rows={4} placeholder={t.labFormulationPlaceholder} value={formulationInput} onChange={e => setFormulationInput(e.target.value)} />
          <button type="button" onClick={runFormulationIntelligence} style={{ marginTop: 8 }}>{t.check}</button>
          {formulationResult && <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-soft)', borderRadius: 8 }}><p><strong>{t.labStatus}:</strong> <span style={{ color: formulationResult.status === 'OK' ? 'green' : formulationResult.status === 'Warning' ? 'orange' : 'red' }}>{formulationResult.status}</span></p>{(formulationResult.issues || []).length > 0 && <ul style={{ paddingRight: 20 }}>{formulationResult.issues.map((issue, i) => <li key={i}>{issue.message || issue}</li>)}</ul>}</div>}
        </section>
      )}

      {activeSection === 'similar-experiments' && (
        <section className="rag-section">
          <label>{t.labSimilarExperimentsTitle}</label>
          <p className="muted" style={{ marginBottom: 8 }}>{t.labSimilarExperimentsHint}</p>
          <input type="text" className="form-control" dir="ltr" placeholder={t.labExperimentIdPlaceholder} value={similarExperimentId} onChange={e => setSimilarExperimentId(e.target.value)} style={{ maxWidth: 320, marginBottom: 8 }} />
          <button type="button" onClick={runSimilarExperiments} disabled={!similarExperimentId.trim()} style={{ marginTop: 0 }}>{t.load}</button>
          {similarResult && (similarResult.error ? <p className="error" style={{ marginTop: 12 }}>{similarResult.error}</p> : <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-soft)', borderRadius: 8 }}><p>{t.labSimilarTo(similarResult.source_experiment_id)}</p><ul style={{ margin: 0, paddingRight: 20 }}>{(similarResult.similar || []).map((s, i) => <li key={i}>{s.experiment_id} — {s.experiment_outcome} (score: {s.similarity_score})</li>)}</ul>{(similarResult.similar || []).length === 0 && <p className="muted">{t.labNoSimilarFound}</p>}</div>)}
        </section>
      )}

      {activeSection === 'relations' && (
        <section className="rag-section">
          {relations && <div><p>{t.labRelationsSummary(relations.experiments_count, relations.material_library_count)}</p><p className="muted">{t.labRelationsList}</p><ul style={{ margin: 0, paddingRight: 20 }}>{(relations.relations || []).slice(0, 30).map((r, i) => <li key={i}>{r.type}: {r.experiment_id} {r.formula != null ? `— ${String(r.formula).slice(0, 40)}` : ''} {r.material != null ? `— ${r.material}` : ''}</li>)}</ul></div>}
          <button type="button" className="secondary" onClick={loadRelations}>{relations ? t.refresh : t.load}</button>
        </section>
      )}

      {activeSection === 'guard' && (
        <section className="rag-section">
          <label>{t.labResearchGuard}</label>
          <textarea className="form-control" dir="ltr" rows={2} placeholder={t.labGuardPlaceholder} value={guardInput} onChange={e => setGuardInput(e.target.value)} />
          <button type="button" onClick={runGuard} style={{ marginTop: 8 }}>{t.check}</button>
          {guardResult && <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-soft)', borderRadius: 8 }}><p>{guardResult.allowed !== false ? t.labGuardAllowed : t.labGuardBlocked}</p>{(guardResult.warnings || []).length > 0 && <ul style={{ paddingRight: 20 }}>{guardResult.warnings.map((w, i) => <li key={i}>{w.message || w}</li>)}</ul>}</div>}
        </section>
      )}

      {activeSection === 'experiments' && (
        <section className="rag-section">
          <p>{t.labExperimentsCount(experiments.length)}</p>
          <p className="muted">{t.labSessionsCount(sessions.length)} {t.labMaterialsCount(materials.length)}</p>
          <button type="button" className="secondary" onClick={load} style={{ marginBottom: 8 }}>{t.refresh}</button>
          <ul style={{ margin: 0, paddingRight: 20, maxHeight: 300, overflow: 'auto' }}>{experiments.slice(0, 50).map(e => <li key={e.id}>{e.experiment_id} — {e.technology_domain} — {e.experiment_outcome} {e.formula ? `(${String(e.formula).slice(0, 30)}…)` : ''}</li>)}</ul>
          {experiments.length > 50 && <p className="muted">{t.labShowingFirst(50)}</p>}
        </section>
      )}
    </div>
  );
}

function RagTab({ projectId }) {
  const [query, setQuery] = React.useState('');
  const [result, setResult] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [health, setHealth] = React.useState(null);
  const [projectFiles, setProjectFiles] = React.useState([]);
  const [filesLoading, setFilesLoading] = React.useState(true);
  const [uploading, setUploading] = React.useState(false);
  const [selectedFilename, setSelectedFilename] = React.useState('');
  const [actionMessage, setActionMessage] = React.useState(null);
  const [removingFileId, setRemovingFileId] = React.useState(null);
  const [showSharepointPicker, setShowSharepointPicker] = React.useState(false);
  const [sharepointBucketFiles, setSharepointBucketFiles] = React.useState([]);
  const [sharepointDisplayNamesMap, setSharepointDisplayNamesMap] = React.useState({});
  const [sharepointBucketLoading, setSharepointBucketLoading] = React.useState(false);
  const [sharepointSearchQuery, setSharepointSearchQuery] = React.useState('');
  const [sharepointExpandedFolders, setSharepointExpandedFolders] = React.useState(() => new Set());
  const [addingFromBucket, setAddingFromBucket] = React.useState(null);
  const [showSharepointUploadModal, setShowSharepointUploadModal] = React.useState(false);
  const [sharepointUploadFiles, setSharepointUploadFiles] = React.useState([]);
  const [sharepointUploading, setSharepointUploading] = React.useState(false);
  const [sharepointUploadLoaded, setSharepointUploadLoaded] = React.useState(0);
  const [sharepointUploadTotal, setSharepointUploadTotal] = React.useState(0);
  const [sharepointServerProgress, setSharepointServerProgress] = React.useState(null);
  const [sharepointUploadFolderName, setSharepointUploadFolderName] = React.useState('');
  const sharepointProgressPollRef = React.useRef(null);
  const sharepointFolderInputRef = React.useRef(null);

  const loadFiles = () => projectFilesApi.list(projectId).then(d => { setProjectFiles(d.files || []); setFilesLoading(false); });

  React.useEffect(() => {
    ragApi.health().then(setHealth).catch(() => setHealth({ ok: false }));
  }, []);
  React.useEffect(() => {
    if (projectId) loadFiles();
  }, [projectId]);
  React.useEffect(() => {
    const el = sharepointFolderInputRef.current;
    if (el) {
      el.setAttribute('webkitdirectory', '');
      el.setAttribute('directory', '');
    }
  }, [showSharepointUploadModal]);

  async function readDroppedFolder(entry, basePath = '') {
    const out = [];
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      const relPath = basePath ? `${basePath}/${file.name}` : file.name;
      out.push(new File([file], relPath, { type: file.type }));
      return out;
    }
    if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries = await new Promise((res, rej) => reader.readEntries(res, rej));
      const name = entry.name || 'folder';
      const dirPath = basePath ? `${basePath}/${name}` : name;
      for (const e of entries) {
        out.push(...(await readDroppedFolder(e, dirPath)));
      }
    }
    return out;
  }
  function handleSharepointDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    const items = e.dataTransfer?.items;
    if (!items?.length) return;
    const promises = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) promises.push(readDroppedFolder(entry));
    }
    Promise.all(promises).then(arrays => {
      const flat = arrays.flat();
      if (flat.length) {
        setSharepointUploadFiles(flat);
        // Default folder name from dropped folder (first file's path is "FolderName/..." from readDroppedFolder)
        const firstPath = flat[0].name;
        const folderName = firstPath && firstPath.includes('/') ? firstPath.split('/')[0] : '';
        if (folderName) setSharepointUploadFolderName(folderName);
      }
    }).catch(() => {});
  }
  function handleSharepointDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }

  const onFileChange = async (e) => {
    const fileList = e.target.files;
    if (!fileList?.length) return;
    setError(null);
    setUploading(true);
    const files = Array.from(fileList);
    const errors = [];
    for (let i = 0; i < files.length; i++) {
      try {
        await projectFilesApi.upload(projectId, files[i]);
      } catch (err) {
        errors.push(files[i].name + ': ' + (err.response?.data?.error || err.message));
      }
    }
    e.target.value = '';
    setUploading(false);
    loadFiles();
    if (errors.length) setError(errors.length === files.length ? errors.join('; ') : t.uploadSomeFailed + ' ' + errors.join('; '));
  };

  const removeFile = (fileId) => {
    if (!window.confirm(t.removeFileConfirm)) return;
    setRemovingFileId(fileId);
    projectFilesApi.delete(projectId, fileId).then(loadFiles).catch(err => setError(err.message)).finally(() => setRemovingFileId(null));
  };

  /** True only when the string looks like a storage placeholder (bucket id or file_1-style), not a real filename. */
  function looksLikeStoragePlaceholder(str) {
    if (!str || typeof str !== 'string') return true;
    const s = str.trim();
    if (s.length === 0 || s === '_' || s === 'file') return true;
    if (/[\u0590-\u05FF\uFB1D-\uFB4F]/.test(s)) return false;
    const segment = s.split('/').pop() || s;
    if (/^[a-fA-F0-9]{8}(\.[a-zA-Z0-9]+)?$/.test(segment)) return true;
    if (/^file_\d+(\.[a-zA-Z0-9]+)?$/.test(segment) || /^folder_\d+$/.test(segment)) return true;
    return false;
  }
  function friendlyHebrewLabel(path, fallbackName) {
    const segment = (path || '').split('/').filter(Boolean).pop() || fallbackName || '';
    const extMatch = segment && segment.includes('.') ? segment.match(/\.([^.]+)$/) : null;
    const ext = extMatch ? extMatch[1] : null;
    if (ext) return `קובץ.${ext}`;
    return segment && segment.includes('.') ? 'קובץ' : 'תיקייה';
  }
  function looksMojibake(str) {
    if (!str || typeof str !== 'string') return false;
    return /[\uFFFD\u00A4¢]/.test(str);
  }
  function safeDisplayName(displayName, path, fallbackName) {
    const d = displayName ?? fallbackName ?? path ?? '';
    if (d === '' || d === '_') return friendlyHebrewLabel(path, fallbackName) || path || '';
    if (/[\uFFFD\u00A4]/.test(String(d))) return friendlyHebrewLabel(path, fallbackName) || path || '';
    if (looksMojibake(d)) return friendlyHebrewLabel(path, fallbackName) || path || '';
    if (looksLikeStoragePlaceholder(d)) return friendlyHebrewLabel(path, fallbackName) || d;
    return d;
  }
  const RAG_ALLOWED_EXT = /\.(pdf|docx|doc|txt|xlsx|xls)$/i;
  function isRagAllowedFile(pathOrName) {
    const s = (pathOrName || '').trim();
    return s && RAG_ALLOWED_EXT.test(s);
  }
  function buildBucketTree(files, displayNamesMap = {}, currentProjectId = '') {
    const root = { type: 'folder', pathPrefix: '', children: [] };
    const pathToFolder = new Map();
    pathToFolder.set('', root);
    for (const f of files) {
      const path = f.path || '';
      const parts = path.split('/').filter(Boolean);
      if (parts.length === 0) continue;
      let prefix = '';
      for (let i = 0; i < parts.length - 1; i++) {
        const segment = parts[i];
        const nextPrefix = prefix ? `${prefix}/${segment}` : segment;
        if (!pathToFolder.has(nextPrefix)) {
          const displayPath = displayNamesMap[nextPrefix];
          const rawFolderDisplay = displayPath ? displayPath.split('/').pop() : segment;
          const folder = { type: 'folder', name: segment, pathPrefix: nextPrefix, displayName: safeDisplayName(rawFolderDisplay, nextPrefix, segment), children: [] };
          pathToFolder.set(nextPrefix, folder);
          const parent = pathToFolder.get(prefix);
          if (parent && parent.children) parent.children.push(folder);
        }
        prefix = prefix ? `${prefix}/${segment}` : segment;
      }
      const fileDisplayFromMap = displayNamesMap[f.path];
      const fileNode = { type: 'file', path: f.path, name: parts[parts.length - 1], displayName: safeDisplayName(fileDisplayFromMap ?? f.displayName, f.path, f.name) };
      const parent = pathToFolder.get(prefix);
      if (parent && parent.children) parent.children.push(fileNode);
    }
    const sortNodes = (nodes) => {
      nodes.sort((a, b) => {
        const aIsFolder = a.type === 'folder' ? 1 : 0;
        const bIsFolder = b.type === 'folder' ? 1 : 0;
        if (bIsFolder !== aIsFolder) return bIsFolder - aIsFolder;
        return String(a.name || a.pathPrefix).localeCompare(String(b.name || b.pathPrefix), undefined, { sensitivity: 'base' });
      });
      nodes.forEach(n => { if (n.children) sortNodes(n.children); });
    };
    sortNodes(root.children);
    let topLevel = root.children;
    if (currentProjectId) {
      const projectPrefix = 'project_' + currentProjectId;
      const idx = topLevel.findIndex(n => n.type === 'folder' && n.pathPrefix === projectPrefix);
      if (idx !== -1) {
        const projectNode = topLevel[idx];
        const rest = topLevel.filter((_, i) => i !== idx);
        topLevel = [...(projectNode.children || []), ...rest];
        sortNodes(topLevel);
      }
    }
    const manualIdx = topLevel.findIndex(n => n.type === 'folder' && n.pathPrefix === 'manual');
    if (manualIdx !== -1) {
      const manualNode = topLevel[manualIdx];
      const rest = topLevel.filter((_, i) => i !== manualIdx);
      topLevel = [...(manualNode.children || []), ...rest];
      sortNodes(topLevel);
    }
    return topLevel;
  }

  const toggleBucketFolder = (pathPrefix) => {
    setSharepointExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(pathPrefix)) next.delete(pathPrefix);
      else next.add(pathPrefix);
      return next;
    });
  };

  const runSearch = () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    const body = { session_id: null, query: query.trim(), use_4_agents: true };
    ragApi.researchSession()
      .then(session => {
        body.session_id = session.session_id;
        if (selectedFilename) {
          body.filename = selectedFilename;
        } else if (projectFiles.length > 0) {
          body.filenames = projectFiles.map(f => f.original_name);
        }
        return ragApi.researchRun(body);
      })
      .then(data => {
        const out = data.outputs || {};
        const text = (out.synthesis || out.research || out.analysis || '').trim();
        if (text) {
          setResult(text);
        } else if (data.run_id != null) {
          setResult('לא נוצר טקסט. ייתכן שהמודל לא זמין או החזיר תשובה ריקה. נסה שוב או בדוק את הגדרות LLM ב-Matriya.');
        } else {
          setResult(JSON.stringify(data, null, 2));
        }
      })
      .catch(e => setError(e.response?.data?.error || e.message || (e.code === 'ECONNABORTED' ? 'הבקשה ארכה יותר מדי – נסה שוב.' : 'שגיאה בביצוע השאילתה.')))
      .finally(() => setLoading(false));
  };

  const copyAnswer = () => {
    if (!result) return;
    navigator.clipboard.writeText(String(result)).then(() => { setActionMessage(t.copySuccess); setTimeout(() => setActionMessage(null), 2000); }).catch(() => setError(t.copySuccess));
  };
  const saveAnswerAsNote = () => {
    if (!result) return;
    const title = (query || '').slice(0, 80) || t.askQuestion;
    notesApi.create(projectId, { title, body: String(result) }).then(() => { setActionMessage(t.saveAsNoteSuccess); setTimeout(() => setActionMessage(null), 2000); }).catch(e => setError(e.response?.data?.error || e.message));
  };

  return (
    <div className="card tab-card rag-tab">
      <h3>{t.docsManagementTitle}</h3>
      <p style={{ color: 'var(--muted)', fontSize: '0.95rem', marginBottom: 20 }}>{t.docsManagementIntro}</p>
      {health && <p style={{ color: health.ok ? 'var(--success)' : 'var(--muted)', fontSize: '0.85rem', marginBottom: 16 }}>{health.ok ? t.matriyaConnected : t.matriyaNotSet}</p>}
      {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}

      <section className="rag-section" aria-labelledby="docs-upload-heading">
        <h4 id="docs-upload-heading" style={{ fontSize: '1rem', marginBottom: 8 }}>{t.docsUploadSection}</h4>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 12 }}>{t.docsUploadHint}</p>
        <div className="flex gap" style={{ marginBottom: 16, alignItems: 'center' }}>
          <button
            type="button"
            className="rag-file-button"
            disabled={!health?.ok}
            title={!health?.ok ? t.matriyaNotSet : undefined}
            onClick={() => {
              if (!health?.ok) return;
              setSharepointSearchQuery('');
              setShowSharepointPicker(true);
              setSharepointBucketLoading(true);
              projectFilesApi.listSharepointBucket(projectId).then(d => {
                const files = d.files || [];
                const displayNamesMap = d.displayNamesMap || {};
                const mapKeys = Object.keys(displayNamesMap);
                console.log('[SharePoint decode] list response:', { filesCount: files.length, displayNamesMapKeys: mapKeys.length, sampleMapKeys: mapKeys.slice(0, 5) });
                const manualFiles = files.filter(f => (f.path || '').startsWith('manual/'));
                const missingInMap = manualFiles.filter(f => displayNamesMap[f.path] == null);
                const inMap = manualFiles.filter(f => displayNamesMap[f.path] != null);
                console.log('[SharePoint decode] manual files: total=', manualFiles.length, '| in displayNamesMap=', inMap.length, '| MISSING from map (will show קובץ/placeholder)=', missingInMap.length, '| missing paths=', missingInMap.map(f => f.path));
                manualFiles.slice(0, 10).forEach(f => {
                  console.log('[SharePoint decode] file:', f.path, '| displayName from API:', JSON.stringify(f.displayName), '| in map:', f.path in displayNamesMap, '| map value:', JSON.stringify(displayNamesMap[f.path]));
                });
                if (manualFiles.length > 10) console.log('[SharePoint decode] ... and', manualFiles.length - 10, 'more manual files');
                setSharepointBucketFiles(files);
                setSharepointDisplayNamesMap(displayNamesMap);
                setSharepointBucketLoading(false);
                // Auto-expand "manual" so uploaded files (with Hebrew/English display names) are visible
                const hasManual = files.some(f => (f.path || '').startsWith('manual/'));
                if (hasManual) setSharepointExpandedFolders(prev => new Set(prev).add('manual'));
              }).catch(err => {
                console.warn('[SharePoint decode] list failed:', err);
                setSharepointBucketLoading(false); setSharepointBucketFiles([]); setSharepointDisplayNamesMap({});
              });
            }}
          >
            {t.chooseFromSharepoint}
          </button>
          <input
            id="rag-file-upload"
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.txt,.xlsx,.xls"
            onChange={onFileChange}
            className="rag-file-input-hidden"
            aria-label={t.chooseFile}
            tabIndex={-1}
          />
          <label htmlFor="rag-file-upload" className="rag-file-button">
            {t.chooseFileMultiple}
          </label>
          {uploading && <span className="loading">{t.uploading}</span>}
        </div>
        {showSharepointPicker && (
          <div className="modal-overlay" onClick={() => setShowSharepointPicker(false)} role="dialog" aria-modal="true" aria-label={t.sharepointBucketList}>
            <div className="modal card" onClick={e => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div className="flex gap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0 }}>{t.sharepointBucketList}</h4>
                <div className="flex gap" style={{ alignItems: 'center' }}>
                  <button type="button" className="rag-file-button" onClick={() => { setSharepointUploadFiles([]); setShowSharepointUploadModal(true); }}>{t.uploadToSharepointManual}</button>
                  <button type="button" className="secondary" onClick={() => setShowSharepointPicker(false)}>×</button>
                </div>
              </div>
              {!sharepointBucketLoading && sharepointBucketFiles.length > 0 && (
                <input
                  type="search"
                  className="form-control"
                  placeholder={t.searchSharepointFiles}
                  value={sharepointSearchQuery}
                  onChange={e => setSharepointSearchQuery(e.target.value)}
                  style={{ marginBottom: 12 }}
                  aria-label={t.searchSharepointFiles}
                />
              )}
              <div className="modal-scroll" style={{ overflow: 'auto', flex: 1, minHeight: 200 }}>
                {sharepointBucketLoading && <p className="loading">{t.loadingSharepointFiles}</p>}
                {!sharepointBucketLoading && sharepointBucketFiles.length === 0 && <p className="muted">{t.noSharepointFiles}</p>}
                {!sharepointBucketLoading && sharepointBucketFiles.length > 0 && (() => {
                  const q = sharepointSearchQuery.trim().toLowerCase();
                  const filtered = q ? sharepointBucketFiles.filter(f => (f.displayName || f.name || f.path || '').toLowerCase().includes(q)) : sharepointBucketFiles;
                  if (filtered.length === 0) return <p className="muted">{t.noSharepointFiles}</p>;
                  const isSearch = !!q;
                  function renderBucketNode(node, depth = 0) {
                    const pathKey = node.path || node.pathPrefix || '';
                    const displayFromMap = sharepointDisplayNamesMap[pathKey];
                    const display = displayFromMap ?? node.displayName;
                    const finalDisplay = safeDisplayName(display, node.path, node.name);
                    if (node.type === 'file' && pathKey.startsWith('manual/')) {
                      console.log('[SharePoint decode] render file:', pathKey, '| displayFromMap:', JSON.stringify(displayFromMap), '| node.displayName:', JSON.stringify(node.displayName), '| final:', JSON.stringify(finalDisplay));
                    }
                    if (node.type === 'file') {
                      const ragAllowed = isRagAllowedFile(node.path || node.name);
                      return (
                        <li key={node.path} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)', paddingRight: depth * 16 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }} title={node.path}>{finalDisplay}</span>
                          {ragAllowed ? (
                            <button type="button" className="secondary" disabled={addingFromBucket === node.path} onClick={() => { setAddingFromBucket(node.path); projectFilesApi.addFromBucket(projectId, node.path, safeDisplayName(display, node.path, node.name)).then(() => { loadFiles(); setAddingFromBucket(null); }).catch(err => { setError(err.response?.data?.error || err.message); setAddingFromBucket(null); }); }}>{addingFromBucket === node.path ? t.uploading : t.addToProject}</button>
                          ) : (
                            <span className="muted" style={{ fontSize: '0.85rem' }}>קובץ בפורמט לא מתאים, לא ניתן לסרוק על ידי RAG</span>
                          )}
                        </li>
                      );
                    }
                    const expanded = sharepointExpandedFolders.has(node.pathPrefix);
                    return (
                      <li key={node.pathPrefix || node.name} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                        <button type="button" className="secondary" style={{ width: '100%', justifyContent: 'flex-start', textAlign: 'right', marginBottom: 4, padding: '6px 8px', background: 'var(--bg)' }} onClick={() => toggleBucketFolder(node.pathPrefix)} aria-expanded={expanded}>
                          <span style={{ marginLeft: 8 }}>{expanded ? '▼' : '▶'}</span>
                          <span style={{ marginRight: 6 }}>{safeDisplayName(display, node.path || node.pathPrefix, node.name)}</span>
                        </button>
                        {expanded && node.children && node.children.length > 0 && (
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0, borderRight: '1px solid var(--border)', marginRight: 8 }}>
                            {node.children.map(child => renderBucketNode(child, depth + 1))}
                          </ul>
                        )}
                      </li>
                    );
                  }
                  if (isSearch) {
                    return (
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {filtered.map(f => {
                          const fileDisplay = sharepointDisplayNamesMap[f.path] ?? f.displayName;
                          const ragAllowed = isRagAllowedFile(f.path || f.name);
                          return (
                            <li key={f.path} className="list-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.path}>{safeDisplayName(fileDisplay, f.path, f.name)}</span>
                              {ragAllowed ? (
                                <button type="button" className="secondary" disabled={addingFromBucket === f.path} onClick={() => { setAddingFromBucket(f.path); projectFilesApi.addFromBucket(projectId, f.path, safeDisplayName(fileDisplay, f.path, f.name)).then(() => { loadFiles(); setAddingFromBucket(null); }).catch(err => { setError(err.response?.data?.error || err.message); setAddingFromBucket(null); }); }}>{addingFromBucket === f.path ? t.uploading : t.addToProject}</button>
                              ) : (
                                <span className="muted" style={{ fontSize: '0.85rem' }}>קובץ בפורמט לא מתאים, לא ניתן לסרוק על ידי RAG</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    );
                  }
                  const tree = buildBucketTree(filtered, sharepointDisplayNamesMap, projectId);
                  return (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                      {tree.map(node => renderBucketNode(node))}
                    </ul>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
        {showSharepointUploadModal && (
          <div className="modal-overlay" onClick={() => !sharepointUploading && setShowSharepointUploadModal(false)} role="dialog" aria-modal="true" aria-label={t.uploadToSharepoint}>
            <div className="modal card" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
              <div className="flex gap" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h4 style={{ margin: 0 }}>{t.uploadToSharepoint}</h4>
                <button type="button" className="secondary" disabled={sharepointUploading} onClick={() => setShowSharepointUploadModal(false)}>×</button>
              </div>
              <input
                type="file"
                multiple
                id="sharepoint-upload-files"
                className="rag-file-input-hidden"
                onChange={e => {
                  const list = e.target.files;
                  const files = list ? Array.from(list) : [];
                  setSharepointUploadFiles(files);
                  setSharepointUploadFolderName(''); // no folder context when picking individual files
                  e.target.value = '';
                }}
              />
              <input
                ref={sharepointFolderInputRef}
                type="file"
                multiple
                id="sharepoint-upload-folder"
                className="rag-file-input-hidden"
                onChange={e => {
                  const list = e.target.files;
                  const files = list ? Array.from(list) : [];
                  setSharepointUploadFiles(files);
                  if (files.length > 0) {
                    const path = files[0].webkitRelativePath;
                    const folderName = path ? path.split('/')[0] : '';
                    if (folderName) setSharepointUploadFolderName(folderName);
                  }
                  e.target.value = '';
                }}
              />
              <div
                onDrop={handleSharepointDrop}
                onDragOver={handleSharepointDragOver}
                style={{ border: '2px dashed var(--border)', borderRadius: 8, padding: 24, marginBottom: 12, textAlign: 'center', color: 'var(--muted)', fontSize: '0.9rem' }}
              >
                גרור תיקייה לכאן או בחר קבצים/תיקייה
              </div>
              <div className="flex gap" style={{ marginBottom: 12 }}>
                {/* Files upload to bucket with ASCII paths; Hebrew names are stored as display names and shown in the UI (Supabase bucket does not support Hebrew in paths). */}
                <label htmlFor="sharepoint-upload-files" className="rag-file-button" style={{ display: 'inline-block' }}>בחר קבצים</label>
                <button type="button" className="rag-file-button" onClick={() => sharepointFolderInputRef.current?.click()}>בחר תיקייה</button>
              </div>
              {sharepointUploadFiles.length > 0 && !sharepointUploading && (
                <>
                  <p className="muted" style={{ marginBottom: 8 }}>{sharepointUploadFiles.length} קבצים נבחרו</p>
                  {sharepointUploadFiles.length > 1 && (
                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', marginBottom: 4, color: 'var(--muted)', fontSize: '0.9rem' }}>{t.sharepointFolderName}</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="למשל: דוחות-2024"
                        value={sharepointUploadFolderName}
                        onChange={e => setSharepointUploadFolderName(e.target.value)}
                        dir="ltr"
                      />
                    </div>
                  )}
                </>
              )}
              {sharepointUploading && (() => {
                const total = sharepointUploadTotal || sharepointUploadFiles.reduce((s, f) => s + (f.size || 0), 0);
                const loaded = sharepointUploadLoaded;
                const format = (n) => n >= 1024 * 1024 ? (n / (1024 * 1024)).toFixed(1) + ' MB' : n >= 1024 ? (n / 1024).toFixed(1) + ' KB' : n + ' B';
                const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
                const waitingOnServer = total > 0 && loaded >= total;
                const server = sharepointServerProgress;
                const serverLine = server?.phase === 'displayNames'
                  ? 'שומר שמות תצוגה...'
                  : server?.file != null && server?.total
                    ? `מעלה קובץ ${server.file} מתוך ${server.total}`
                    : waitingOnServer
                      ? 'מעבד בשרת...'
                      : null;
                return (
                  <div style={{ marginBottom: 12 }} role="status" aria-live="polite">
                    <p className="loading" style={{ marginBottom: 6 }}>
                      {waitingOnServer ? (serverLine || 'מעבד בשרת...') : `מעלה ${sharepointUploadFiles.length} קבצים — ${format(loaded)} / ${format(total)}`}
                    </p>
                    <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: 'var(--accent)',
                          borderRadius: 4,
                          transition: 'width 0.2s ease'
                        }}
                      />
                    </div>
                    {waitingOnServer && serverLine && <p className="muted" style={{ marginTop: 6, fontSize: '0.85rem' }}>{serverLine}</p>}
                  </div>
                );
              })()}
              <div className="flex gap">
                <button type="button" className="secondary" onClick={() => setShowSharepointUploadModal(false)} disabled={sharepointUploading}>ביטול</button>
                <button
                  type="button"
                  disabled={sharepointUploadFiles.length === 0 || sharepointUploading}
                  onClick={() => {
                    if (sharepointUploadFiles.length === 0) {
                      setError('בחר קבצים או תיקייה להעלאה');
                      return;
                    }
                    if (!projectId) {
                      setError('פרויקט לא זמין');
                      return;
                    }
                    setSharepointUploading(true);
                    setSharepointServerProgress(null);
                    const totalBytes = sharepointUploadFiles.reduce((s, f) => s + (f.size || 0), 0);
                    setSharepointUploadLoaded(0);
                    setSharepointUploadTotal(totalBytes);
                    setError(null);
                    const folderPath = sharepointUploadFolderName.trim() || (sharepointUploadFiles.length > 1 ? 'upload' : '');
                    const filesToUpload = [...sharepointUploadFiles];
                    const uploadId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `upload-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
                    const progressOpts = {
                      uploadId,
                      onUploadProgress: (e) => {
                        if (e.loaded != null) setSharepointUploadLoaded(e.loaded);
                        if (e.total != null) setSharepointUploadTotal(e.total);
                        if (e.total && e.loaded >= e.total && !sharepointProgressPollRef.current) {
                          sharepointProgressPollRef.current = setInterval(() => {
                            projectFilesApi.getSharepointUploadProgress(projectId, uploadId).then(setSharepointServerProgress).catch(() => {});
                          }, 800);
                        }
                      },
                      onProgress: (loaded, total) => {
                        setSharepointUploadLoaded(loaded);
                        if (total != null) setSharepointUploadTotal(total);
                      }
                    };
                    projectFilesApi.uploadToSharepointBucketDirect(projectId, filesToUpload, folderPath, progressOpts)
                      .then(res => {
                        if (res.uploaded_paths?.length > 0 && folderPath) {
                          const firstPath = res.uploaded_paths[0].path || '';
                          const bucketFolderPath = firstPath.includes('/') ? firstPath.slice(0, firstPath.lastIndexOf('/')) : firstPath;
                          console.log('[SharePoint upload] Folder in bucket:', res.bucket || 'sharepoint-files', '| Path:', bucketFolderPath, '| Display name:', folderPath);
                          if (res.supabase_project) console.log('[SharePoint upload] Open Supabase dashboard → project', res.supabase_project, '→ Storage → bucket', (res.bucket || 'sharepoint-files'));
                        }
                        if (res.errors?.length) console.warn('[SharePoint upload] Errors:', res.errors);
                        setActionMessage(res.failed > 0 ? t.sharepointUploadSomeFailed : t.sharepointUploadSuccess);
                        setTimeout(() => setActionMessage(null), 3000);
                        setShowSharepointUploadModal(false);
                        setSharepointUploadFiles([]);
                        setSharepointUploadFolderName('');
                        if (showSharepointPicker) {
                          setSharepointBucketLoading(true);
                          projectFilesApi.listSharepointBucket(projectId).then(d => {
                            const files = d.files || [];
                            setSharepointBucketFiles(files);
                            setSharepointDisplayNamesMap(d.displayNamesMap || {});
                            setSharepointBucketLoading(false);
                            setSharepointExpandedFolders(prev => new Set(prev).add('manual'));
                          }).catch(() => setSharepointBucketLoading(false));
                        }
                      })
                      .catch(err => {
                        setError(getNetworkErrorMessage(err));
                      })
                      .finally(() => {
                        if (sharepointProgressPollRef.current) {
                          clearInterval(sharepointProgressPollRef.current);
                          sharepointProgressPollRef.current = null;
                        }
                        setSharepointUploading(false);
                        setSharepointUploadLoaded(0);
                        setSharepointUploadTotal(0);
                        setSharepointServerProgress(null);
                      });
                  }}
                >
                  {sharepointUploading ? t.uploading : 'העלה'}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="rag-section" aria-labelledby="docs-list-heading">
        <h4 id="docs-list-heading" style={{ fontSize: '1rem', marginBottom: 8 }}>{t.docsListSection}</h4>
        {filesLoading && <p className="loading">{t.loading}</p>}
        {!filesLoading && projectFiles.length === 0 && <p className="loading">{t.noFilesYet}</p>}
        {!filesLoading && projectFiles.length > 0 && (
          <div className="rag-file-list">
            {projectFiles.map(f => (
              <div key={f.id} className="list-item">
                <span>{f.original_name}</span>
                <div className="flex gap">
                  <button type="button" className="secondary" title={f.storage_path ? t.download : t.downloadNotAvailable} disabled={!f.storage_path} onClick={() => f.storage_path && projectFilesApi.download(projectId, f.id, f.original_name).catch(err => setError(err.response?.data?.error || err.message))}>{t.download}</button>
                  <button type="button" className={`secondary ${removingFileId === f.id ? 'btn-loading' : ''}`} onClick={() => removeFile(f.id)} disabled={removingFileId === f.id}>{removingFileId === f.id ? t.loading : t.remove}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rag-section" aria-labelledby="docs-ask-heading">
        <h4 id="docs-ask-heading" style={{ fontSize: '1rem', marginBottom: 8 }}>{t.docsAskSection}</h4>
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 12 }}>{t.docsAskHint}</p>
        {projectFiles.length > 0 && (
          <div className="form-group">
            <label>{t.queryOver}</label>
            <select value={selectedFilename} onChange={e => setSelectedFilename(e.target.value)}>
              <option value="">{t.allFiles}</option>
              {projectFiles.map(f => <option key={f.id} value={f.original_name}>{f.original_name}</option>)}
            </select>
          </div>
        )}
        <label>{t.askQuestion}</label>
        <textarea value={query} onChange={e => setQuery(e.target.value)} placeholder={t.questionPlaceholder} disabled={!health?.ok} rows={4} />
        <button type="button" onClick={runSearch} disabled={loading || !health?.ok || projectFiles.length === 0} className={loading ? 'btn-loading' : ''}>{loading ? t.loading : t.run}</button>
        {result && (
          <>
            <div className="flex gap mt-16" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="secondary" onClick={copyAnswer}>{t.copyAnswer}</button>
              <button type="button" className="secondary" onClick={saveAnswerAsNote}>{t.saveAnswerAsNote}</button>
            </div>
            {actionMessage && <p style={{ color: 'var(--success)', fontSize: '0.9rem', marginTop: 8 }}>{actionMessage}</p>}
            <div className="rag-result mt-16">{result}</div>
          </>
        )}
        {loading && <p className="loading mt-16">{t.running}</p>}
      </section>
    </div>
  );
}

function ChatTab({ projectId }) {
  const [messages, setMessages] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [input, setInput] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState(null);
  const listRef = React.useRef(null);

  const load = () => {
    chatApi.list(projectId)
      .then(d => { setMessages(d.messages || []); setError(null); })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  };
  React.useEffect(() => { setLoading(true); load(); }, [projectId]);
  React.useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages]);

  const send = () => {
    const text = (input || '').trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);
    chatApi.send(projectId, text)
      .then(msg => { setMessages(prev => [...prev, msg]); setInput(''); })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setSending(false));
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="card tab-card chat-tab">
      <h3>💬 {t.chat}</h3>
      {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}
      <div ref={listRef} className="chat-messages" aria-live="polite">
        {loading && <p className="loading">{t.loading}</p>}
        {!loading && messages.length === 0 && <p className="loading">{t.noChatYet}</p>}
        {!loading && messages.map(m => (
          <div key={m.id} className="chat-message">
            <span className="chat-message-meta">{m.username} · {formatTime(m.created_at)}</span>
            <p className="chat-message-body">{m.body}</p>
          </div>
        ))}
      </div>
      <div className="chat-input-row">
        <textarea value={input} onChange={e => setInput(e.target.value)} placeholder={t.chatPlaceholder} rows={2} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button type="button" onClick={send} disabled={sending || !input.trim()} className={sending ? 'btn-loading' : ''}>{sending ? t.loading : t.chatSend}</button>
      </div>
    </div>
  );
}

function MembersTab({ projectId }) {
  const [requests, setRequests] = React.useState([]);
  const [members, setMembers] = React.useState([]);
  const [addableUsers, setAddableUsers] = React.useState([]);
  const [selectedUsername, setSelectedUsername] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [addingMember, setAddingMember] = React.useState(false);
  const [actingRequestId, setActingRequestId] = React.useState(null);

  const load = () => {
    Promise.all([
      projectsApi.getRequests(projectId),
      projectsApi.getMembers(projectId),
      usersApi.list(projectId).catch(() => ({ users: [] }))
    ])
      .then(([rRes, mRes, uRes]) => {
        setRequests(rRes.requests || []);
        setMembers(mRes.members || []);
        setAddableUsers(uRes.users || []);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };
  React.useEffect(() => { load(); }, [projectId]);

  const approve = (requestId) => {
    setActingRequestId(requestId);
    projectsApi.approveRequest(projectId, requestId).then(() => load()).catch(e => setError(e.response?.data?.error || e.message)).finally(() => setActingRequestId(null));
  };
  const reject = (requestId) => {
    setActingRequestId(requestId);
    projectsApi.rejectRequest(projectId, requestId).then(() => load()).catch(e => setError(e.message)).finally(() => setActingRequestId(null));
  };
  const addMember = () => {
    if (!selectedUsername.trim()) return;
    setAddingMember(true);
    projectsApi.addMember(projectId, selectedUsername.trim())
      .then(() => { setSelectedUsername(''); load(); setError(null); })
      .catch(e => setError(e.response?.data?.error || t.userNotFound || e.message))
      .finally(() => setAddingMember(false));
  };

  return (
    <div className="card tab-card">
      <h3>{t.members}</h3>
      {error && <p className="error">{error}</p>}
      <div className="form-group">
        <label>{t.addMember}</label>
        {!loading && (
          <>
            <div className="flex gap" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={selectedUsername}
                onChange={e => setSelectedUsername(e.target.value)}
                style={{ minWidth: 180 }}
                aria-label={t.selectUser}
              >
                <option value="">{t.selectUser}</option>
                {addableUsers.map(u => (
                  <option key={u.user_id} value={u.username}>{u.username}</option>
                ))}
              </select>
              <button onClick={addMember} disabled={!selectedUsername || addingMember} className={addingMember ? 'btn-loading' : ''}>{addingMember ? t.loading : t.add}</button>
            </div>
            {addableUsers.length === 0 && (
              <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: 4 }}>{t.noUsersToAdd}</p>
            )}
          </>
        )}
      </div>
      <div className="form-group">
        <label>{t.pendingRequests}</label>
        {loading && <p className="loading">{t.loading}</p>}
        {!loading && requests.length === 0 && <p className="loading">{t.noPendingRequests}</p>}
        {!loading && requests.map(req => (
          <div key={req.id} className="list-item">
            <span>{req.username}</span>
            <div className="flex gap">
              <button onClick={() => approve(req.id)} disabled={actingRequestId === req.id} className={actingRequestId === req.id ? 'btn-loading' : ''}>{actingRequestId === req.id ? t.loading : t.approve}</button>
              <button className="secondary" onClick={() => reject(req.id)} disabled={actingRequestId === req.id}>{actingRequestId === req.id ? t.loading : t.reject}</button>
            </div>
          </div>
        ))}
      </div>
      <div className="form-group">
        <label>{t.members}</label>
        {!loading && members.map(m => (
          <div key={m.user_id} className="list-item">
            <span>{m.username} <span className="badge badge-todo">{m.role === 'owner' ? t.owner : t.member}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({ projectId, project, setProject, navigate, projectRole, user: currentUser }) {
  const [name, setName] = React.useState(project?.name || '');
  const [description, setDescription] = React.useState(project?.description || '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [requests, setRequests] = React.useState([]);
  const [members, setMembers] = React.useState([]);
  const [permLoading, setPermLoading] = React.useState(false);
  const [addableUsers, setAddableUsers] = React.useState([]);
  const [selectedUsername, setSelectedUsername] = React.useState('');
  const [deletingProject, setDeletingProject] = React.useState(false);
  const [addingMember, setAddingMember] = React.useState(false);
  const [actingRequestId, setActingRequestId] = React.useState(null);
  const [removingUserId, setRemovingUserId] = React.useState(null);

  React.useEffect(() => {
    setName(project?.name || '');
    setDescription(project?.description || '');
  }, [project]);

  const loadPerms = () => {
    if (projectRole !== 'owner') return;
    setPermLoading(true);
    Promise.all([
      projectsApi.getRequests(projectId),
      projectsApi.getMembers(projectId),
      usersApi.list(projectId).catch(() => ({ users: [] }))
    ])
      .then(([rRes, mRes, uRes]) => {
        setRequests(rRes.requests || []);
        setMembers(mRes.members || []);
        setAddableUsers(uRes.users || []);
      })
      .catch(() => {})
      .finally(() => setPermLoading(false));
  };
  React.useEffect(() => { loadPerms(); }, [projectId, projectRole]);

  const save = () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    projectsApi.update(projectId, { name: name.trim(), description: description.trim() || null })
      .then(updated => { setProject(updated); setSaving(false); })
      .catch(e => { setError(e.message); setSaving(false); });
  };

  const deleteProject = () => {
    if (!window.confirm(t.deleteProjectConfirm)) return;
    setDeletingProject(true);
    projectsApi.delete(projectId)
      .then(() => navigate('/'))
      .catch(e => { setError(e.message); setDeletingProject(false); });
  };

  const approveRequest = (requestId) => {
    setActingRequestId(requestId);
    projectsApi.approveRequest(projectId, requestId).then(loadPerms).catch(e => setError(e.response?.data?.error || e.message)).finally(() => setActingRequestId(null));
  };
  const rejectRequest = (requestId) => {
    setActingRequestId(requestId);
    projectsApi.rejectRequest(projectId, requestId).then(loadPerms).catch(e => setError(e.message)).finally(() => setActingRequestId(null));
  };
  const addMember = () => {
    if (!selectedUsername.trim()) return;
    setAddingMember(true);
    projectsApi.addMember(projectId, selectedUsername.trim())
      .then(() => { setSelectedUsername(''); loadPerms(); setError(null); })
      .catch(e => setError(e.response?.data?.error || t.userNotFound || e.message))
      .finally(() => setAddingMember(false));
  };
  const removeMember = (userId) => {
    if (!window.confirm(t.removeFromProject + '?')) return;
    setRemovingUserId(userId);
    projectsApi.removeMember(projectId, userId).then(loadPerms).catch(e => setError(e.response?.data?.error || e.message)).finally(() => setRemovingUserId(null));
  };

  const isOwner = projectRole === 'owner';

  return (
    <div className="card tab-card">
      <h3>{t.projectSettings}</h3>
      {error && <p className="error">{error}</p>}
      {isOwner ? (
        <>
          <div className="form-group">
            <label>{t.name}</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t.projectName} />
          </div>
          <div className="form-group">
            <label>{t.description}</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t.optional} rows={3} />
          </div>
          <div className="flex gap">
            <button onClick={save} disabled={saving} className={saving ? 'btn-loading' : ''}>{saving ? t.loading : t.saveChanges}</button>
            <button className={`danger ${deletingProject ? 'btn-loading' : ''}`} onClick={deleteProject} disabled={deletingProject}>{deletingProject ? t.loading : t.deleteProject}</button>
          </div>
        </>
      ) : (
        <>
          <div className="form-group">
            <label>{t.name}</label>
            <p style={{ margin: 0 }}>{project?.name || ''}</p>
          </div>
          <div className="form-group">
            <label>{t.description}</label>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{project?.description || t.noDescription}</p>
          </div>
        </>
      )}

      {/* הרשאות פרויקט – only for project owner (opener) */}
      {isOwner && (
        <>
          <hr className="settings-divider" />
          <h3 style={{ marginTop: 24 }}>{t.projectPermissions}</h3>
          <div className="form-group">
            <label>{t.pendingRequests}</label>
            {permLoading && <p className="loading">{t.loading}</p>}
            {!permLoading && requests.length === 0 && <p className="loading">{t.noPendingRequests}</p>}
            {!permLoading && requests.map(req => (
              <div key={req.id} className="list-item">
                <span>{req.username}</span>
                <div className="flex gap">
                  <button type="button" onClick={() => approveRequest(req.id)} disabled={actingRequestId === req.id} className={actingRequestId === req.id ? 'btn-loading' : ''}>{actingRequestId === req.id ? t.loading : t.approve}</button>
                  <button type="button" className="secondary" onClick={() => rejectRequest(req.id)} disabled={actingRequestId === req.id}>{actingRequestId === req.id ? t.loading : t.reject}</button>
                </div>
              </div>
            ))}
          </div>
          <div className="form-group">
            <label>{t.addMember}</label>
            {!permLoading && (
              <>
                <div className="flex gap" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    value={selectedUsername}
                    onChange={e => setSelectedUsername(e.target.value)}
                    style={{ minWidth: 180 }}
                    aria-label={t.selectUser}
                  >
                    <option value="">{t.selectUser}</option>
                    {addableUsers.map(u => (
                      <option key={u.user_id} value={u.username}>{u.username}</option>
                    ))}
                  </select>
                  <button type="button" onClick={addMember} disabled={!selectedUsername || addingMember} className={addingMember ? 'btn-loading' : ''}>{addingMember ? t.loading : t.add}</button>
                </div>
                {addableUsers.length === 0 && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginTop: 4 }}>{t.noUsersToAdd}</p>
                )}
              </>
            )}
          </div>
          <div className="form-group">
            <label>{t.members}</label>
            {!permLoading && members.map(m => (
              <div key={m.user_id} className="list-item">
                <span>{m.username} <span className="badge badge-todo">{m.role === 'owner' ? t.owner : t.member}</span></span>
                {m.role === 'member' && currentUser && m.user_id !== currentUser.id && (
                  <button type="button" className={`secondary ${removingUserId === m.user_id ? 'btn-loading' : ''}`} onClick={() => removeMember(m.user_id)} disabled={removingUserId === m.user_id}>{removingUserId === m.user_id ? t.loading : t.removeFromProject}</button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LoginView({ onLogin }) {
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError(null);
    setLoading(true);
    authApi.login(username.trim(), password)
      .then(data => {
        setAuth(data.access_token, data.user);
        onLogin(data.user);
        navigate('/');
      })
      .catch(err => {
        setError(errorMessageFromResponse(err, t.loginError));
        setLoading(false);
      });
  };

  return (
    <div className="app-shell" dir="rtl">
      <div className="card tab-card auth-card" style={{ maxWidth: 340, margin: '40px auto' }}>
        <h2 className="page-title">{t.loginTitle}</h2>
        {error && <p className="error">{typeof error === 'string' ? error : String(error)}</p>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label>{t.username}</label>
            <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
          </div>
          <div className="form-group">
            <label>{t.password}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          </div>
          <div className="flex gap">
            <button type="submit" disabled={loading} className={loading ? 'btn-loading' : ''}>{loading ? t.loading : t.loginButton}</button>
            <Link to="/signup" className="secondary" style={{ alignSelf: 'center' }}>{t.signup}</Link>
          </div>
        </form>
        <p className="auth-footer-p" style={{ color: 'var(--muted)' }}>{t.noAccount} <Link to="/signup">{t.signup}</Link></p>
      </div>
    </div>
  );
}

function SignupView({ onSignup }) {
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [error, setError] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    if (!username.trim() || !email.trim() || !password) return;
    setError(null);
    setLoading(true);
    authApi.signup(username.trim(), email.trim(), password, fullName.trim() || null)
      .then(data => {
        setAuth(data.access_token, data.user);
        onSignup(data.user);
        navigate('/');
      })
      .catch(err => {
        setError(errorMessageFromResponse(err, t.signupError));
        setLoading(false);
      });
  };

  return (
    <div className="app-shell" dir="rtl">
      <div className="card tab-card auth-card" style={{ maxWidth: 340, margin: '40px auto' }}>
        <h2 className="page-title">{t.signupTitle}</h2>
        {error && <p className="error">{typeof error === 'string' ? error : String(error)}</p>}
        <form onSubmit={submit}>
          <div className="form-group">
            <label>{t.username}</label>
            <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required />
          </div>
          <div className="form-group">
            <label>{t.email}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
          </div>
          <div className="form-group">
            <label>{t.password}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required />
          </div>
          <div className="form-group">
            <label>{t.fullName}</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder={t.optional} autoComplete="name" />
          </div>
          <div className="flex gap">
            <button type="submit" disabled={loading} className={loading ? 'btn-loading' : ''}>{loading ? t.loading : t.signupButton}</button>
            <Link to="/login" style={{ alignSelf: 'center' }}>{t.login}</Link>
          </div>
        </form>
        <p className="auth-footer-p" style={{ color: 'var(--muted)' }}>{t.haveAccount} <Link to="/login">{t.login}</Link></p>
      </div>
    </div>
  );
}

function ProtectedRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = React.useState(null);
  const [authChecked, setAuthChecked] = React.useState(false);

  React.useEffect(() => {
    const token = getStoredToken();
    const storedUser = getStoredUser();
    if (token) {
      setAuth(token, storedUser);
      authApi.me().then(me => setUser(me)).catch(() => { clearAuth(); setUser(null); }).finally(() => setAuthChecked(true));
    } else {
      setUser(storedUser);
      setAuthChecked(true);
    }
  }, []);

  const handleLogout = () => {
    clearAuth();
    setUser(null);
  };

  if (!authChecked) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>{t.loading}</div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginView onLogin={setUser} />} />
        <Route path="/signup" element={user ? <Navigate to="/" replace /> : <SignupView onSignup={setUser} />} />
        <Route path="/" element={<ProtectedRoute user={user}><Home user={user} onLogout={handleLogout} /></ProtectedRoute>} />
        <Route path="/project/:id" element={<ProtectedRoute user={user}><ProjectView user={user} onLogout={handleLogout} /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
