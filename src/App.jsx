import React from 'react';
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate, Navigate } from 'react-router-dom';
import { projects as projectsApi, users as usersApi, tasks as tasksApi, milestones as milestonesApi, documents as documentsApi, notes as notesApi, projectFiles as projectFilesApi, rag as ragApi, auth as authApi, getStoredToken, getStoredUser, setAuth, clearAuth } from './api';
import t from './strings';

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
  const navigate = useNavigate();

  React.useEffect(() => {
    projectsApi.list().then(d => { setProjects(d.projects || []); setLoading(false); }).catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const filteredProjects = !search.trim() ? projects : projects.filter(p =>
    (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const onProjectClick = (p) => {
    projectsApi.getAccess(p.id).then(access => {
      if (access.canAccess) navigate(`/project/${p.id}`);
      else setRequestProject({ project: p, hasPendingRequest: access.hasPendingRequest });
    }).catch(() => setRequestProject({ project: p, hasPendingRequest: false }));
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
    <div className="app-shell" dir="rtl">
      <aside className="sidebar">
        <h1>{t.appTitle}</h1>
        <nav>
          <Link to="/">{t.allProjects}</Link>
        </nav>
        {user && (
          <div className="sidebar-user">
            <span>{user.username}</span>
            <button type="button" className="secondary" onClick={onLogout}>{t.logout}</button>
          </div>
        )}
      </aside>
      <main className="main">
        <h2 className="page-title">{t.projects}</h2>
        {error && <p className="error">{error}</p>}
        <div className="flex gap" style={{ flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          <input type="search" placeholder={t.searchProjects} value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: 280 }} />
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
              <div key={p.id} className="project-card" onClick={() => onProjectClick(p)}>
                <h3>{p.name}</h3>
                <p>{p.description || t.noDescription}</p>
              </div>
            ))}
          </div>
        )}
        {!loading && filteredProjects.length === 0 && !showNew && <p className="loading">{search.trim() ? t.noResults : t.noProjectsYet}</p>}

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

const TABS = ['overview', 'tasks', 'milestones', 'notes', 'rag', 'reports', 'activity', 'settings'];
const TAB_LABELS = { overview: t.overview, tasks: t.tasks, milestones: t.milestones, notes: t.notes, rag: t.docsManagementTab, reports: t.reports, activity: t.activity, settings: t.settings };

function ProjectView({ user, onLogout }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = React.useState(null);
  const [projectRole, setProjectRole] = React.useState(null);
  const [tab, setTab] = React.useState('overview');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    if (!id) return;
    Promise.all([projectsApi.get(id), projectsApi.getAccess(id)])
      .then(([proj, access]) => { setProject(proj); setProjectRole(access.role); })
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !project) return <div className="main" dir="rtl"><p className="loading">{t.loading}</p></div>;
  if (error) return <div className="main" dir="rtl"><p className="error">{error}</p><button onClick={() => navigate('/')}>{t.back}</button></div>;

  return (
    <div className="app-shell" dir="rtl">
      <aside className="sidebar">
        <h1>{t.appTitle}</h1>
        <nav>
          <Link to="/">{t.allProjects}</Link>
        </nav>
        {user && (
          <div className="sidebar-user">
            <span>{user.username}</span>
            <button type="button" className="secondary" onClick={onLogout}>{t.logout}</button>
          </div>
        )}
        <p style={{ marginTop: 16, fontSize: '0.9rem', color: 'var(--muted)' }}>{project.name}</p>
      </aside>
      <main className="main">
        <div className="flex gap" style={{ alignItems: 'center', marginBottom: 20 }}>
          <button className="secondary" onClick={() => navigate('/')}>← {t.back}</button>
          <h2 className="page-title mb-0">{project.name}</h2>
        </div>
        {project.description && <p style={{ color: 'var(--muted)', marginBottom: 20 }}>{project.description}</p>}
        <div className="tabs">
          {TABS.map(tabId => (
            <button key={tabId} className={tab === tabId ? 'active' : ''} onClick={() => setTab(tabId)}>{TAB_LABELS[tabId]}</button>
          ))}
        </div>
        <div className="tab-content">
          {tab === 'overview' && <Overview projectId={id} project={project} />}
          {tab === 'tasks' && <TasksTab projectId={id} />}
          {tab === 'milestones' && <MilestonesTab projectId={id} />}
{tab === 'notes' && <NotesTab projectId={id} />}
        {tab === 'rag' && <RagTab projectId={id} />}
        {tab === 'reports' && <ReportsTab projectId={id} />}
        {tab === 'activity' && <ActivityTab projectId={id} />}
        {tab === 'settings' && <SettingsTab projectId={id} project={project} setProject={setProject} navigate={navigate} projectRole={projectRole} user={user} />}
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

  const loadFiles = () => projectFilesApi.list(projectId).then(d => { setProjectFiles(d.files || []); setFilesLoading(false); });

  React.useEffect(() => {
    ragApi.health().then(setHealth).catch(() => setHealth({ ok: false }));
  }, []);
  React.useEffect(() => {
    if (projectId) loadFiles();
  }, [projectId]);

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    projectFilesApi.upload(projectId, file)
      .then(() => { loadFiles(); e.target.value = ''; })
      .catch(err => setError(err.response?.data?.error || err.message))
      .finally(() => setUploading(false));
  };

  const removeFile = (fileId) => {
    if (!window.confirm(t.removeFileConfirm)) return;
    setRemovingFileId(fileId);
    projectFilesApi.delete(projectId, fileId).then(loadFiles).catch(err => setError(err.message)).finally(() => setRemovingFileId(null));
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
        if (selectedFilename) body.filename = selectedFilename;
        return ragApi.researchRun(body);
      })
      .then(data => {
        const out = data.outputs || {};
        setResult(out.synthesis || out.research || out.analysis || JSON.stringify(data, null, 2));
      })
      .catch(e => setError(e.response?.data?.error || e.message))
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
          <input
            id="rag-file-upload"
            type="file"
            accept=".pdf,.docx,.doc,.txt,.xlsx,.xls"
            onChange={onFileChange}
            className="rag-file-input-hidden"
            aria-label={t.chooseFile}
            tabIndex={-1}
          />
          <label htmlFor="rag-file-upload" className="rag-file-button">
            {t.chooseFile}
          </label>
          {uploading && <span className="loading">{t.uploading}</span>}
        </div>
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
                  <button type="button" className="secondary" title={t.downloadNotAvailable} disabled>{t.download}</button>
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
        <button type="button" onClick={runSearch} disabled={loading || !health?.ok} className={loading ? 'btn-loading' : ''}>{loading ? t.loading : t.run}</button>
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

function ReportsTab({ projectId }) {
  return (
    <div className="card tab-card">
      <h3>{t.reports}</h3>
      <p style={{ color: 'var(--muted)' }}>{t.comingSoon}</p>
    </div>
  );
}

function ActivityTab({ projectId }) {
  return (
    <div className="card tab-card">
      <h3>{t.activity}</h3>
      <p style={{ color: 'var(--muted)' }}>{t.comingSoon}</p>
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
        setError(err.response?.data?.error || t.loginError);
        setLoading(false);
      });
  };

  return (
    <div className="app-shell" dir="rtl">
      <main className="main" style={{ maxWidth: 420, margin: '40px auto' }}>
        <div className="card tab-card">
          <h2 className="page-title">{t.loginTitle}</h2>
          <p style={{ color: 'var(--muted)', marginBottom: 20 }}>משתמשים באותה טבלת משתמשים כמו מטריה</p>
          {error && <p className="error">{error}</p>}
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
          <p style={{ marginTop: 16, color: 'var(--muted)' }}>{t.noAccount} <Link to="/signup">{t.signup}</Link></p>
        </div>
      </main>
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
        setError(err.response?.data?.error || t.signupError);
        setLoading(false);
      });
  };

  return (
    <div className="app-shell" dir="rtl">
      <main className="main" style={{ maxWidth: 420, margin: '40px auto' }}>
        <div className="card tab-card">
          <h2 className="page-title">{t.signupTitle}</h2>
          {error && <p className="error">{error}</p>}
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
          <p style={{ marginTop: 16, color: 'var(--muted)' }}>{t.haveAccount} <Link to="/login">{t.login}</Link></p>
        </div>
      </main>
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
