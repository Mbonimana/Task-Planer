const $ = (sel) => document.querySelector(sel);

function openModal(id) {
  const el = $(id);
  if (el) el.setAttribute('aria-hidden', 'false');
}

function closeModal(id) {
  const el = $(id);
  if (el) el.setAttribute('aria-hidden', 'true');
}

function wireModals() {
  const addTaskBtn = $('#addTaskBtn');
  const addNoteBtn = $('#addNoteBtn');
  const taskModal = $('#taskModal');
  const noteModal = $('#noteModal');

  addTaskBtn?.addEventListener('click', () => openModal('#taskModal'));
  addNoteBtn?.addEventListener('click', () => openModal('#noteModal'));

  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const modal = btn.closest('.modal');
      modal?.setAttribute('aria-hidden', 'true');
    });
  });

  [taskModal, noteModal].forEach(modal => {
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(`#${modal.id}`);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      [taskModal, noteModal].forEach(m => m && m.setAttribute('aria-hidden','true'));
    }
  });
}

function wireAuthButtons() {
  const login = $('#loginBtn');
  const signup = $('#signupBtn');
  login?.addEventListener('click', () => alert('Login clicked'));
  signup?.addEventListener('click', () => alert('Sign Up clicked'));
}

function renderTask({ title, due, priority }) {
  const li = document.createElement('li');
  li.className = 'task-item';
  li.dataset.status = 'pending';
  li.innerHTML = `
    <label class="checkbox">
      <input type="checkbox">
      <span></span>
    </label>
    <div class="task-title"></div>
    <div class="task-meta">
      <span class="due due-warning"></span>
      <span class="created">Just now</span>
      <span class="priority high"></span>
      <span class="icons">
        <button class="icon-btn action-edit" title="Edit">✏️</button>
        <button class="icon-btn action-dup" title="Duplicate">📄</button>
        <button class="icon-btn action-del" title="Delete">🗑️</button>
      </span>
    </div>`;
  li.querySelector('.task-title').textContent = title || 'Untitled';
  li.querySelector('.due').textContent = due ? `Due ${due}` : 'No due date';
  li.querySelector('.priority').textContent = priority ? `${priority} Priority` : 'Normal';
  return li;
}

function renderNote({ title, body }) {
  const card = document.createElement('div');
  card.className = 'note-card';
  card.innerHTML = `<h3></h3><p></p>`;
  card.querySelector('h3').textContent = title || 'Untitled note';
  card.querySelector('p').textContent = body || '';
  return card;
}

function wireSaves() {
  const saveTask = $('#saveTask');
  const saveNote = $('#saveNote');
  const taskList = document.querySelector('.task-list');
  const notesBoard = document.querySelector('.notes-board');
  let editingTask = null; // holds li when editing

  function clearTaskFields() {
    ['#taskTitle','#taskDue','#taskPriority','#taskNotes'].forEach(id => { const el=$(id); if(el) el.value=''; });
  }

  function clearNoteFields() {
    ['#noteTitle','#noteBody'].forEach(id => { const el=$(id); if(el) el.value=''; });
  }

  saveTask?.addEventListener('click', () => {
    const title = $('#taskTitle')?.value.trim();
    const due = $('#taskDue')?.value.trim();
    const priority = $('#taskPriority')?.value.trim();
    if (!title) { alert('Please provide a task title.'); return; }
    if (editingTask) {
      editingTask.querySelector('.task-title').textContent = title;
      editingTask.querySelector('.due').textContent = due ? `Due ${due}` : 'No due date';
      editingTask.querySelector('.priority').textContent = priority ? `${priority} Priority` : 'Normal';
      updateTaskStatus(editingTask);
      editingTask = null;
    } else {
      taskList?.appendChild(renderTask({ title, due, priority }));
    }
    closeModal('#taskModal');
    clearTaskFields();
    updateStats();
  });

  saveNote?.addEventListener('click', () => {
    const title = $('#noteTitle')?.value.trim();
    const body = $('#noteBody')?.value.trim();
    if (!title) { alert('Please provide a note title.'); return; }
    const card = renderNote({ title, body });
    // Insert after header inside notes board
    const container = notesBoard?.querySelector('.note-card')?.parentElement || notesBoard;
    container?.appendChild(card);
    closeModal('#noteModal');
    clearNoteFields();
  });

  // Enter to save when inside modals
  ['#taskModal', '#noteModal'].forEach(id => {
    const modal = $(id);
    modal?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (id === '#taskModal') saveTask?.click();
        else saveNote?.click();
      }
    });
  });

  // expose a helper to open task modal in edit mode
  window.__openEditTask = (li) => {
    editingTask = li;
    $('#taskTitle').value = li.querySelector('.task-title').textContent;
    const dueText = (li.querySelector('.due').textContent||'').replace(/^Due\s*/i,'');
    $('#taskDue').value = dueText === 'No due date' ? '' : dueText;
    const pr = li.querySelector('.priority').textContent.replace(/\s*Priority/i,'');
    $('#taskPriority').value = pr === 'Normal' ? '' : pr;
    openModal('#taskModal');
  };
}

document.addEventListener('DOMContentLoaded', () => {
  wireModals();
  wireAuthButtons();
  wireSaves();
  wireTaskActions();
  wireFiltersAndSearch();
});

function parseDueText(dueText) {
  const d = new Date(dueText);
  return isNaN(d.getTime()) ? null : d;
}

function computeStatusFrom(li) {
  const checked = li.querySelector('input[type="checkbox"]').checked;
  if (checked) return 'completed';
  const dueLabel = li.querySelector('.due');
  const text = (dueLabel?.textContent || '').replace(/^Due\s*/i,'').trim();
  const date = parseDueText(text);
  if (!date) return 'pending';
  const today = new Date();
  today.setHours(0,0,0,0);
  if (date < today) return 'overdue';
  return 'pending';
}

function updateTaskStatus(li) {
  li.dataset.status = computeStatusFrom(li);
}

function wireTaskActions() {
  const list = document.querySelector('.task-list');
  list?.addEventListener('click', (e) => {
    const target = e.target;
    const li = target.closest('.task-item');
    if (!li) return;
    if (target.matches('.checkbox span')) {
      const cb = li.querySelector('input[type="checkbox"]');
      cb.checked = !cb.checked;
      updateTaskStatus(li);
      return;
    }
    if (target.matches('input[type="checkbox"]')) {
      updateTaskStatus(li);
      return;
    }
    if (target.closest('.action-del')) {
      li.remove();
      updateStats();
      return;
    }
    if (target.closest('.action-dup')) {
      const copy = li.cloneNode(true);
      list.appendChild(copy);
      updateStats();
      return;
    }
    if (target.closest('.action-edit')) {
      window.__openEditTask(li);
      return;
    }
  });
}

function wireFiltersAndSearch() {
  const chips = Array.from(document.querySelectorAll('.filters .chip'));
  const list = document.querySelector('.task-list');
  const search = document.querySelector('.tasks-board .search');

  function applyFilters() {
    const active = chips.find(c => c.classList.contains('active'));
    const q = (search?.value || '').toLowerCase().trim();
    list?.querySelectorAll('.task-item').forEach(li => {
      updateTaskStatus(li);
      const status = li.dataset.status;
      const title = li.querySelector('.task-title').textContent.toLowerCase();
      const matchesSearch = !q || title.includes(q);
      const matchesStatus = !active || active.textContent.toLowerCase() === status;
      li.hidden = !(matchesSearch && matchesStatus);
    });
    updateStats();
  }

  chips.forEach(chip => chip.addEventListener('click', () => {
    if (chip.classList.contains('active')) chip.classList.remove('active');
    else { chips.forEach(c => c.classList.remove('active')); chip.classList.add('active'); }
    applyFilters();
  }));

  search?.addEventListener('input', applyFilters);

  // initial compute once
  applyFilters();
}

function updateStats() {
  const items = Array.from(document.querySelectorAll('.task-list .task-item'));
  let total = 0, completed = 0, todayCnt = 0, overdue = 0;
  const today = new Date(); today.setHours(0,0,0,0);
  items.forEach(li => {
    total += 1;
    const status = computeStatusFrom(li);
    if (status === 'completed') completed += 1;
    if (status === 'overdue') overdue += 1;
    const text = (li.querySelector('.due')?.textContent || '').replace(/^Due\s*/i,'').trim();
    const date = new Date(text);
    const sameDay = !isNaN(date) && date.getTime() >= today.getTime() && date.getTime() < today.getTime() + 24*60*60*1000;
    if (sameDay) todayCnt += 1;
  });
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val); };
  set('statTotal', total);
  set('statCompleted', completed);
  set('statToday', todayCnt);
  set('statOverdue', overdue);
}
