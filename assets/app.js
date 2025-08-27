'use strict';

(function () {
  const dom = {
    // stats
    statTotal: document.getElementById('statTotal'),
    statCompleted: document.getElementById('statCompleted'),
    statToday: document.getElementById('statToday'),
    statOverdue: document.getElementById('statOverdue'),

    // toolbar
    globalSearch: document.getElementById('globalSearch'),
    sortBy: document.getElementById('sortBy'),
    chips: Array.from(document.querySelectorAll('.chip')),
    addTaskBtn: document.getElementById('addTaskBtn'),
    addNoteBtn: document.getElementById('addNoteBtn'),

    // tasks
    tasksCount: document.getElementById('tasksCount'),
    tasksEmpty: document.getElementById('tasksEmpty'),
    tasksList: document.getElementById('tasksList'),
    firstTaskBtn: document.getElementById('firstTaskBtn'),

    // notes
    noteSearch: document.getElementById('noteSearch'),
    notesEmpty: document.getElementById('notesEmpty'),
    notesList: document.getElementById('notesList'),
    firstNoteBtn: document.getElementById('firstNoteBtn'),

    // dialogs
    taskDialog: document.getElementById('taskDialog'),
    taskForm: document.getElementById('taskForm'),
    taskDialogTitle: document.getElementById('taskDialogTitle'),
    noteDialog: document.getElementById('noteDialog'),
    noteForm: document.getElementById('noteForm'),
    noteDialogTitle: document.getElementById('noteDialogTitle'),
  };

  const T_KEY = 'ssp_tasks_v1';
  const N_KEY = 'ssp_notes_v1';

  /** Data **/
  /** @typedef {{id:string,title:string,notes?:string,priority:'low'|'medium'|'high',due?:string,completed:boolean,created:number}} Task */
  /** @typedef {{id:string,title:string,content:string,created:number,updated:number}} Note */

  const state = {
    tasks: /** @type {Task[]} */ (load(T_KEY, [])),
    notes: /** @type {Note[]} */ (load(N_KEY, [])),
    filter: 'all',
    search: '',
    sortBy: 'deadline',
    noteSearch: '',
  };

  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function uid() { return Math.random().toString(36).slice(2, 10); }
  function todayISO() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); }
  function isOverdue(due) { if (!due) return false; const now = new Date(); now.setHours(0,0,0,0); const dd = new Date(due); dd.setHours(0,0,0,0); return dd < now; }
  function isToday(due) { if (!due) return false; const t = todayISO(); return due === t; }

  /** Init **/
  wireEvents();
  renderAll();

  function wireEvents() {
    dom.addTaskBtn.addEventListener('click', () => openTaskDialog());
    dom.firstTaskBtn.addEventListener('click', () => openTaskDialog());
    dom.addNoteBtn.addEventListener('click', () => openNoteDialog());
    dom.firstNoteBtn.addEventListener('click', () => openNoteDialog());

    // enforce min date for due input to today
    const dueInput = /** @type {HTMLInputElement} */ (document.getElementById('taskDue'));
    if (dueInput) { dueInput.min = todayISO(); }

    dom.globalSearch.addEventListener('input', (e) => { state.search = e.target.value.trim().toLowerCase(); renderAll(); });
    dom.noteSearch.addEventListener('input', (e) => { state.noteSearch = e.target.value.trim().toLowerCase(); renderNotes(); });

    dom.sortBy.addEventListener('change', (e) => { state.sortBy = e.target.value; renderTasks(); });

    dom.chips.forEach(chip => chip.addEventListener('click', () => {
      dom.chips.forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      state.filter = chip.dataset.filter;
      renderTasks();
    }));

    dom.taskForm.addEventListener('submit', onTaskSubmit);
    dom.taskForm.addEventListener('reset', () => dom.taskDialog.close());
    dom.noteForm.addEventListener('submit', onNoteSubmit);
    dom.noteForm.addEventListener('reset', () => dom.noteDialog.close());
  }

  /** Rendering **/
  function renderAll() {
    renderTasks();
    renderNotes();
    updateStats();
  }

  function renderTasks() {
    const filtered = state.tasks.filter(t =>
      (state.search === '' || t.title.toLowerCase().includes(state.search) || (t.notes ?? '').toLowerCase().includes(state.search))
    ).filter(t => {
      if (state.filter === 'all') return true;
      if (state.filter === 'pending') return !t.completed;
      if (state.filter === 'completed') return t.completed;
      if (state.filter === 'overdue') return !t.completed && isOverdue(t.due);
      if (state.filter === 'today') return isToday(t.due);
      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      switch (state.sortBy) {
        case 'priority': return priorityRank(b.priority) - priorityRank(a.priority);
        case 'created': return b.created - a.created;
        case 'title': return a.title.localeCompare(b.title);
        case 'deadline':
        default:
          return (a.due || '9999-12-31').localeCompare(b.due || '9999-12-31');
      }
    });

    dom.tasksList.innerHTML = '';
    sorted.forEach(task => dom.tasksList.appendChild(renderTaskItem(task)));

    const has = sorted.length > 0;
    dom.tasksEmpty.style.display = has ? 'none' : 'grid';
    dom.tasksCount.textContent = `${sorted.length} ${sorted.length === 1 ? 'task' : 'tasks'}`;

    updateStats();
  }

  function renderTaskItem(task) {
    const tpl = document.getElementById('taskItemTemplate');
    const el = tpl.content.firstElementChild.cloneNode(true);
    const checkbox = el.querySelector('.item__check');
    const title = el.querySelector('.item__title');
    const deadline = el.querySelector('.badge.deadline');
    const created = el.querySelector('.badge.created');
    const priority = el.querySelector('.badge.priority');

    title.textContent = task.title;
    checkbox.checked = task.completed;
    el.classList.toggle('is-done', task.completed);
    const dueLabel = formatDueLabel(task.due);
    deadline.textContent = dueLabel.text;
    deadline.classList.toggle('is-overdue', dueLabel.kind === 'overdue');
    deadline.classList.toggle('is-today', dueLabel.kind === 'today');
    deadline.classList.toggle('is-soon', dueLabel.kind === 'soon');
    if (created) {
      created.textContent = `Created ${new Date(task.created).toLocaleDateString()}`;
    }
    priority.textContent = `Priority ${capitalize(task.priority)}`;

    checkbox.addEventListener('change', () => {
      task.completed = checkbox.checked;
      save(T_KEY, state.tasks);
      renderTasks();
    });

    el.querySelector('.icon-btn.edit').addEventListener('click', () => openTaskDialog(task));
    el.querySelector('.icon-btn.delete').addEventListener('click', () => {
      if (confirm('Delete this task?')) {
        state.tasks = state.tasks.filter(t => t.id !== task.id);
        save(T_KEY, state.tasks);
        renderTasks();
      }
    });

    return el;
  }

  function renderNotes() {
    const filtered = state.notes.filter(n =>
      (state.search === '' || n.title.toLowerCase().includes(state.search) || n.content.toLowerCase().includes(state.search)) &&
      (state.noteSearch === '' || n.title.toLowerCase().includes(state.noteSearch) || n.content.toLowerCase().includes(state.noteSearch))
    ).sort((a, b) => b.updated - a.updated);

    dom.notesList.innerHTML = '';
    filtered.forEach(note => dom.notesList.appendChild(renderNoteItem(note)));

    const has = filtered.length > 0;
    dom.notesEmpty.style.display = has ? 'none' : 'grid';
  }

  function renderNoteItem(note) {
    const tpl = document.getElementById('noteItemTemplate');
    const el = tpl.content.firstElementChild.cloneNode(true);
    el.querySelector('.note__title').textContent = note.title;
    el.querySelector('.note__content').textContent = note.content;
    el.querySelector('.note__footer').textContent = `Updated ${new Date(note.updated).toLocaleString()}`;

    el.querySelector('.icon-btn.edit').addEventListener('click', () => openNoteDialog(note));
    el.querySelector('.icon-btn.delete').addEventListener('click', () => {
      if (confirm('Delete this note?')) {
        state.notes = state.notes.filter(n => n.id !== note.id);
        save(N_KEY, state.notes);
        renderNotes();
      }
    });

    return el;
  }

  function updateStats() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.completed).length;
    const dueToday = state.tasks.filter(t => isToday(t.due) && !t.completed).length;
    const overdue = state.tasks.filter(t => isOverdue(t.due) && !t.completed).length;

    dom.statTotal.textContent = String(total);
    dom.statCompleted.textContent = String(completed);
    dom.statToday.textContent = String(dueToday);
    dom.statOverdue.textContent = String(overdue);
  }

  /** Dialogs **/
  function openTaskDialog(task) {
    dom.taskForm.reset();
    dom.taskDialogTitle.textContent = task ? 'Edit Task' : 'Add Task';
    dom.taskForm.title.value = task?.title ?? '';
    dom.taskForm.due.value = task?.due ?? '';
    dom.taskForm.priority.value = task?.priority ?? 'medium';
    dom.taskForm.notes.value = task?.notes ?? '';
    dom.taskForm.id.value = task?.id ?? '';
    dom.taskDialog.showModal();
    setTimeout(() => dom.taskForm.title.focus(), 0);
  }

  function onTaskSubmit(ev) {
    ev.preventDefault();
    const data = new FormData(dom.taskForm);
    const id = String(data.get('id')) || uid();
    const title = String(data.get('title')).trim();
    if (!title) return;

    /** @type {Task} */
    const incoming = {
      id,
      title,
      notes: String(data.get('notes') || ''),
      priority: /** @type any */(data.get('priority') || 'medium'),
      due: String(data.get('due') || '') || undefined,
      completed: state.tasks.find(t => t.id === id)?.completed ?? false,
      created: state.tasks.find(t => t.id === id)?.created ?? Date.now(),
    };

    const exists = state.tasks.some(t => t.id === id);
    if (exists) {
      state.tasks = state.tasks.map(t => t.id === id ? incoming : t);
    } else {
      state.tasks.push(incoming);
    }
    save(T_KEY, state.tasks);
    dom.taskDialog.close();
    renderTasks();
  }

  function openNoteDialog(note) {
    dom.noteForm.reset();
    dom.noteDialogTitle.textContent = note ? 'Edit Note' : 'New Note';
    dom.noteForm.title.value = note?.title ?? '';
    dom.noteForm.content.value = note?.content ?? '';
    dom.noteForm.id.value = note?.id ?? '';
    dom.noteDialog.showModal();
    setTimeout(() => dom.noteForm.title.focus(), 0);
  }

  function onNoteSubmit(ev) {
    ev.preventDefault();
    const data = new FormData(dom.noteForm);
    const id = String(data.get('id')) || uid();
    const title = String(data.get('title')).trim();
    if (!title) return;

    /** @type {Note} */
    const incoming = {
      id,
      title,
      content: String(data.get('content') || ''),
      created: state.notes.find(n => n.id === id)?.created ?? Date.now(),
      updated: Date.now(),
    };

    const exists = state.notes.some(n => n.id === id);
    if (exists) {
      state.notes = state.notes.map(n => n.id === id ? incoming : n);
    } else {
      state.notes.unshift(incoming);
    }
    save(N_KEY, state.notes);
    dom.noteDialog.close();
    renderNotes();
  }

  /** Helpers **/
  function priorityRank(p) { return p === 'high' ? 3 : p === 'medium' ? 2 : 1; }
  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  /**
   * @param {string|undefined} due
   * @returns {{ text: string, kind: 'none'|'overdue'|'today'|'soon'|'future' }}
   */
  function formatDueLabel(due) {
    if (!due) return { text: 'No deadline', kind: 'none' };
    const today = new Date(); today.setHours(0,0,0,0);
    const dueDate = new Date(due); dueDate.setHours(0,0,0,0);
    const diffDays = Math.round((dueDate - today) / (1000*60*60*24));
    if (diffDays < 0) return { text: `Overdue ${Math.abs(diffDays)}d`, kind: 'overdue' };
    if (diffDays === 0) return { text: 'Due today', kind: 'today' };
    if (diffDays === 1) return { text: 'Due tomorrow', kind: 'soon' };
    if (diffDays <= 7) return { text: `Due in ${diffDays}d`, kind: 'soon' };
    return { text: `Due ${due}`, kind: 'future' };
  }
})();

