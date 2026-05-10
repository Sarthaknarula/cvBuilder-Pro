/** ===========================================================================
 * MODULE 1: GLOBAL STATE & UTILITIES
 * =========================================================================== */
let activeTemplateId = '';
let activeTemplateLatex = '';
let activeResumeName = ''; 
let removedCoreSections = [];
let customSectionCounter = 0; 
let isUserLoggedIn = false;
let mySavedResumes = [];
let currentWorkspaceView = 'grid';
let defaultCanvasHTML = '';

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✔' : type === 'error' ? '✖' : 'ℹ';
    toast.innerHTML = `<span style="font-size: 18px;">${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

/** ===========================================================================
 * MODULE 2: INITIALIZATION & AUTHENTICATION
 * =========================================================================== */
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Take Snapshot of Empty Editor
    defaultCanvasHTML = document.getElementById('builder-canvas').innerHTML;

    // 2. Setup Theme Toggle (FOUC is already handled in index.html head)
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
        toggleBtn.innerText = document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙';
        toggleBtn.addEventListener('click', () => {
            if (document.documentElement.getAttribute('data-theme') === 'dark') {
                document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', 'light');
                toggleBtn.innerText = '🌙';
            } else {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                toggleBtn.innerText = '☀️';
            }
        });
    }

    // 3. Setup Split Screen Resizer
    initResizer();

    // 4. Authenticate User
    await checkAuthStatus();

    // 5. Fetch Templates & Init Canvas
    await fetchTemplates();
    initDefaultCanvas();

    // 6. Bind Final Event Listeners
    document.getElementById('btn-generate')?.addEventListener('click', () => document.getElementById('output').value = getCompiledLatex());
    document.getElementById('btn-save-cloud')?.addEventListener('click', saveToCloud);
    document.getElementById('btn-download')?.addEventListener('click', downloadPDF);
});

async function checkAuthStatus() {
    const authSection = document.getElementById('auth-section');
    if (!authSection) return;
    try {
        const authRes = await fetch('/api/user');
        const authData = await authRes.json();
        if (authData.loggedIn) {
            isUserLoggedIn = true;
            authSection.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="font-size: 0.9rem; color: var(--text-muted);">Logged in: <strong>${authData.user.email}</strong></span>
                    <a href="/logout" style="color: #d9534f; text-decoration: none; font-weight: bold; font-size: 0.85rem; border: 1px solid #d9534f; padding: 5px 10px; border-radius: 4px;">Logout</a>
                </div>
            `;
            document.getElementById('dashboard-tabs').style.display = 'flex'; 
            document.getElementById('btn-save-cloud').style.display = 'block'; 
            fetchMyResumes(); 
        } else {
            authSection.innerHTML = `<a href="/auth/google" class="btn-google-login">Login with Google</a>`;
        }
    } catch (err) {
        authSection.innerHTML = `<a href="/auth/google" class="btn-google-login">Login with Google</a>`;
    }
}

/** ===========================================================================
 * MODULE 3: DASHBOARD & CLOUD API (Fetching, Saving, Rendering)
 * =========================================================================== */
async function fetchTemplates() {
    const grid = document.getElementById('template-grid');
    if (!grid) return;
    grid.innerHTML = `
        <div class="skel-card"><div class="skeleton skel-img"></div><div class="skeleton skel-text"></div><div class="skeleton skel-btn"></div></div>
        <div class="skel-card"><div class="skeleton skel-img"></div><div class="skeleton skel-text"></div><div class="skeleton skel-btn"></div></div>
    `;
    try {
        const response = await fetch('/api/templates');
        window.resumeTemplates = await response.json();
        grid.innerHTML = ''; 
        if (window.resumeTemplates.length === 0) return grid.innerHTML = `<p style="color:red;">No templates found.</p>`;
        
        window.resumeTemplates.forEach(t => {
            grid.insertAdjacentHTML('beforeend', `
                <div class="template-card" onclick="openBuilder('${t.id}')">
                    <div class="preview-wrapper" style="cursor:pointer;">${t.preview_html}</div>
                    <div class="template-title">${t.title}</div>
                    <div class="template-desc">${t.description}</div>
                    <button class="btn-primary" style="margin-top:0; padding: 10px; width: 80%;">Start Fresh Canvas</button>
                </div>
            `);
        });
    } catch (error) {
        grid.innerHTML = `<p style="color:var(--danger-text);">Error loading templates.</p>`;
    }
}

async function fetchMyResumes() {
    const container = document.getElementById('workspace-container');
    const toolbar = document.getElementById('workspace-toolbar');
    try {
        const response = await fetch('/api/my-resumes');
        if (!response.ok) return; 
        mySavedResumes = await response.json();
        if (mySavedResumes.length === 0) {
            if(toolbar) toolbar.style.display = 'none';
            container.innerHTML = `<div class="empty-state"><h3>No saved resumes found yet.</h3></div>`;
            return;
        }
        if(toolbar) toolbar.style.display = 'flex';
        renderWorkspace();
    } catch (err) { console.error("Fetch Error:", err); }
}

function renderWorkspace() {
    const container = document.getElementById('workspace-container');
    const searchEl = document.getElementById('search-resume');
    const sortEl = document.getElementById('sort-resume');
    const searchQuery = searchEl ? searchEl.value.toLowerCase() : '';
    const sortMethod = sortEl ? sortEl.value : 'newest';

    let filtered = mySavedResumes.filter(save => save.resume_name.toLowerCase().includes(searchQuery));
    filtered.sort((a, b) => {
        if (sortMethod === 'newest') return new Date(b.updated_at) - new Date(a.updated_at);
        if (sortMethod === 'oldest') return new Date(a.updated_at) - new Date(b.updated_at);
        if (sortMethod === 'az') return a.resume_name.localeCompare(b.resume_name);
        if (sortMethod === 'za') return b.resume_name.localeCompare(a.resume_name);
        return 0;
    });

    if (filtered.length === 0) return container.innerHTML = `<div class="empty-state"><p class="text-muted">No resumes match your search.</p></div>`;

    const gridClass = currentWorkspaceView === 'list' ? 'template-grid list-view' : 'template-grid';
    let html = `<div class="${gridClass}">`;
    filtered.forEach(save => {
        const dateStr = new Date(save.updated_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        html += `
            <div class="template-card">
                <div class="preview-wrapper" style="cursor:pointer;" onclick="loadSavedResume('${save.id}', '${save.template_id}')">${save.preview_html}</div>
                <div class="template-title">${save.resume_name}</div>
                <div class="template-desc" style="color: var(--brand-blue); font-weight: bold; margin-bottom: 10px;">Last edited: ${dateStr}</div>
                <div class="card-actions" style="display: flex; gap: 10px; width: 100%;">
                    <button class="btn-success" style="flex: 1; padding: 10px;" onclick="loadSavedResume('${save.id}', '${save.template_id}')">✎ Edit</button>
                    <button class="btn-remove-section" style="padding: 10px; border: 1px solid var(--danger-text);" onclick="deleteResume('${save.id}')">🗑</button>
                </div>
            </div>`;
    });
    container.innerHTML = html + `</div>`;
}

async function loadSavedResume(resumeId, templateId) {
    activeTemplateId = templateId;
    activeTemplateLatex = window.resumeTemplates.find(t => t.id === templateId).latex_code;
    switchScreen('builder');
    const canvas = document.getElementById('builder-canvas');
    canvas.style.opacity = '0.5'; canvas.style.pointerEvents = 'none';

    try {
        const response = await fetch(`/api/load-resume/${resumeId}`);
        if (response.ok) {
            const data = await response.json();
            activeResumeName = data.resumeName; 
            if (data.resumeData && data.resumeData.html) {
                canvas.innerHTML = data.resumeData.html;
                customSectionCounter = canvas.querySelectorAll('[data-type="custom"]').length;
                window.workCounter = canvas.querySelectorAll('.work-item').length;
            }
        }
    } catch (err) { showToast("Error loading resume.", "error"); } 
    finally { canvas.style.opacity = '1'; canvas.style.pointerEvents = 'auto'; }
}

async function executeSave() {
    const saveBtn = document.getElementById('btn-save-cloud');
    saveBtn.disabled = true; showToast("Saving to cloud...", "info");

    try {
        document.querySelectorAll('#builder-canvas input, #builder-canvas textarea, #builder-canvas select').forEach(el => {
            if (el.tagName === 'INPUT') el.setAttribute('value', el.value);
            else if (el.tagName === 'TEXTAREA') el.innerHTML = el.value;
            else if (el.tagName === 'SELECT') {
                Array.from(el.options).forEach(opt => opt.value === el.value ? opt.setAttribute('selected', 'selected') : opt.removeAttribute('selected'));
            }
        });
        const response = await fetch('/api/save-resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ templateId: activeTemplateId, resumeName: activeResumeName, resumeData: { html: document.getElementById('builder-canvas').innerHTML } })
        });
        if (!response.ok) throw new Error();
        showToast("Resume saved successfully!", "success");
    } catch (err) { showToast("Failed to save resume.", "error"); } 
    finally { saveBtn.disabled = false; }
}

async function deleteResume(id) {
    if(!confirm("Are you sure you want to delete this resume?")) return;
    try {
        const res = await fetch(`/api/delete-resume/${id}`, { method: 'DELETE' });
        if(res.ok) { showToast("Resume deleted.", "success"); fetchMyResumes(); } 
        else throw new Error();
    } catch (err) { showToast("Failed to delete.", "error"); }
}

async function downloadPDF() {
    const btn = document.getElementById('btn-download');
    const compiledCode = getCompiledLatex();
    document.getElementById('output').value = compiledCode; 
    const origText = btn.innerText; btn.innerText = "Compiling PDF..."; btn.disabled = true;
    try {
        const response = await fetch('/api/compile-pdf', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latex: compiledCode })
        });
        if (!response.ok) throw new Error();
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'My_Resume.pdf';
        document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(url);
    } catch (error) { showToast("Error compiling PDF.", "error"); } 
    finally { btn.innerText = origText; btn.disabled = false; }
}

/** ===========================================================================
 * MODULE 4: EDITOR UI MECHANICS & EVENT HANDLERS
 * =========================================================================== */
function initResizer() {
    const resizer = document.getElementById('dragMe');
    const leftPane = document.getElementById('left-pane');
    const rightPane = document.getElementById('right-pane');
    if(!resizer) return;
    let x = 0; let leftWidth = 0;
    
    const mouseMove = (e) => {
        const newLeftWidth = ((leftWidth + e.clientX - x) * 100) / resizer.parentNode.getBoundingClientRect().width;
        if(newLeftWidth > 20 && newLeftWidth < 80) { leftPane.style.flex = `0 0 ${newLeftWidth}%`; rightPane.style.flex = `1 1 0%`; }
    };
    const mouseUp = () => {
        resizer.classList.remove('resizing');
        document.removeEventListener('mousemove', mouseMove);
        document.removeEventListener('mouseup', mouseUp);
    };
    resizer.addEventListener('mousedown', (e) => {
        x = e.clientX; leftWidth = leftPane.getBoundingClientRect().width;
        resizer.classList.add('resizing');
        document.addEventListener('mousemove', mouseMove);
        document.addEventListener('mouseup', mouseUp);
    });
}

function switchScreen(screen) {
    document.getElementById('selection-screen').style.display = screen === 'selection' ? 'block' : 'none';
    document.getElementById('builder-screen').style.display = screen === 'builder' ? 'flex' : 'none';
    if(screen === 'selection') fetchMyResumes();
}

function openTab(evt, tabId) {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).style.display = 'block';
    evt.currentTarget.classList.add('active');
}

function setWorkspaceView(viewType) {
    currentWorkspaceView = viewType;
    document.getElementById('btn-view-grid').classList.toggle('active', viewType === 'grid');
    document.getElementById('btn-view-list').classList.toggle('active', viewType === 'list');
    renderWorkspace();
}

function openBuilder(templateId) {
    activeTemplateId = templateId; 
    activeTemplateLatex = window.resumeTemplates.find(t => t.id === templateId).latex_code; 
    activeResumeName = ''; 
    switchScreen('builder');
    document.getElementById('builder-canvas').innerHTML = defaultCanvasHTML;
    customSectionCounter = 0; window.workCounter = 0;
    document.getElementById('education-container').innerHTML = '';
    addEducation(true, 'B.Tech Computer Science', '2023 - 2027', 'Delhi Technological University', '9.15 CGPA');
}

function goBackToSelection() { switchScreen('selection'); }
function saveToCloud() { activeResumeName ? executeSave() : (document.getElementById('naming-modal').style.display = 'flex', document.getElementById('resume-name-input').focus()); }
function closeNamingModal() { document.getElementById('naming-modal').style.display = 'none'; document.getElementById('resume-name-input').value = ''; }
function confirmNameAndSave() {
    const input = document.getElementById('resume-name-input').value.trim();
    if (!input) return showToast("Please enter a name.", "error"); 
    activeResumeName = input; closeNamingModal(); executeSave();
}

function toggleSection(element) { element.closest('.draggable-section').classList.toggle('collapsed'); }
function toggleDate(btn, show) {
    const item = btn.closest('.custom-item');
    item.querySelector('.date-wrapper').style.display = show ? 'block' : 'none';
    item.querySelector('.add-date-btn').style.display = show ? 'none' : 'inline';
    if(!show) item.querySelector('.c-date').value = '';
}

// Drag & Drop
document.addEventListener('dragstart', e => { if (e.target.classList?.contains('draggable-section')) e.target.classList.add('dragging'); });
document.addEventListener('dragend', e => { if (e.target.classList?.contains('draggable-section')) { e.target.classList.remove('dragging'); e.target.removeAttribute('draggable'); }});
const canvas = document.getElementById('builder-canvas');
if (canvas) {
    canvas.addEventListener('dragover', e => {
        e.preventDefault();
        const draggable = document.querySelector('.dragging');
        if (draggable) {
            const siblings = [...canvas.querySelectorAll('.draggable-section:not(.dragging):not(#core-header)')];
            const afterEl = siblings.reduce((closest, child) => {
                const box = child.getBoundingClientRect(); const offset = e.clientY - box.top - box.height / 2;
                return (offset < 0 && offset > closest.offset) ? { offset: offset, element: child } : closest;
            }, { offset: Number.NEGATIVE_INFINITY }).element;
            afterEl == null ? canvas.appendChild(draggable) : canvas.insertBefore(draggable, afterEl);
        }
    });
}

/** ===========================================================================
 * MODULE 5: CONTENT BLOCK GENERATORS
 * =========================================================================== */
function initDefaultCanvas() {
    if (!isUserLoggedIn && document.getElementById('education-container')) {
        addEducation(true, 'B.Tech Computer Science Engineering', '2023 - 2027', 'Delhi Technological University', '9.15 CGPA');
        addWorkExperience('Tech Solutions Inc.', '2024 - Present', false); 
        addRole('work-exp-1', 'Software Engineer Intern', 'June 2024 - Present', 'Developed and maintained scalable web applications.');
        addProject('E-Commerce Platform | React, Firebase', '', 'Architected a full-stack e-commerce solution.');
    }
}

function getDescHTML(linesArr = ['']) {
    return linesArr.map(l => `
        <div class="desc-line-item">
            <textarea class="desc-line" placeholder="Action or achievement...">${l}</textarea>
            <button type="button" class="btn-remove-line" onclick="this.parentElement.remove()" title="Remove point">✖</button>
        </div>
    `).join('');
}
function addDescLine(btn) { btn.previousElementSibling.insertAdjacentHTML('beforeend', getDescHTML([''])); }

function removeCoreSection(id, name) {
    document.getElementById(id).style.display = 'none';
    if (!removedCoreSections.find(s => s.id === id)) removedCoreSections.push({id, name});
}
function toggleAddMenu(event, btn) {
    event.stopPropagation(); document.querySelectorAll('.add-menu').forEach(m => m.style.display = 'none');
    const menu = btn.nextElementSibling; menu.innerHTML = '';
    removedCoreSections.forEach(sec => menu.innerHTML += `<button type="button" onclick="restoreCoreSection('${sec.id}')">Restore: ${sec.name}</button>`);
    menu.innerHTML += `<button type="button" class="custom-add-btn" onclick="spawnCustomBlock()">+ Create New Custom Section</button>`;
    menu.style.display = 'flex';
}
function restoreCoreSection(id) {
    const sec = document.getElementById(id); document.getElementById('builder-canvas').appendChild(sec); sec.style.display = 'block';
    removedCoreSections = removedCoreSections.filter(s => s.id !== id); document.querySelectorAll('.add-menu').forEach(m => m.style.display = 'none');
}
document.addEventListener('click', e => { if (!e.target.closest('.bottom-action-area')) document.querySelectorAll('.add-menu').forEach(m => m.style.display = 'none'); });

function addEducation(isCompulsory = false, deg='', yr='', inst='', score='') {
    const html = `
        <div class="section-block edu-item">
            ${isCompulsory ? '' : `<button type="button" class="btn-remove" onclick="this.parentElement.remove()">Remove</button>`}
            <div class="flex-row"><div><label>Degree</label><input type="text" class="e-deg" value="${deg}"></div><div><label>Year</label><input type="text" class="e-yr" value="${yr}"></div></div>
            <div class="flex-row"><div><label>Institution</label><input type="text" class="e-inst" value="${inst}"></div><div><label>Score/CGPA</label><input type="text" class="e-score" value="${score}"></div></div>
        </div>`;
    document.getElementById('education-container')?.insertAdjacentHTML('beforeend', html);
}
function addProject(title='', link='', desc='') {
    const linesHtml = getDescHTML(desc.split('\n').map(l => l.trim()).filter(l => l).length ? desc.split('\n') : ['']);
    const html = `
        <div class="section-block proj-item">
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()">Remove</button>
            <div class="flex-row"><div><label>Project Name & Tech</label><input type="text" class="p-title" value="${title}"></div><div><label>Link</label><input type="text" class="p-link" value="${link}"></div></div>
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 8px;"><label style="margin:0;">Format</label><select class="desc-format format-select"><option value="bullets">Bullets</option><option value="numbers">Numbers</option><option value="paragraph">Paragraph</option></select></div>
            <div class="desc-lines-container">${linesHtml}</div>
            <button type="button" class="btn-add-line" onclick="addDescLine(this)">+ Add Point</button>
        </div>`;
    document.getElementById('project-container')?.insertAdjacentHTML('beforeend', html);
}
function addWorkExperience(company='', date='', autoRole=true) {
    window.workCounter = (window.workCounter || 0) + 1; const workId = `work-exp-${window.workCounter}`;
    const html = `
        <div class="section-block work-item" id="${workId}">
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()">Remove Company</button>
            <div class="flex-row"><div><label>Company</label><input type="text" class="w-company" value="${company}"></div><div><label>Duration</label><input type="text" class="w-date" value="${date}"></div></div>
            <div class="roles-container"></div>
            <button type="button" class="btn-add" style="margin-top: 10px; background: var(--bg-card);" onclick="addRole('${workId}')">+ Add Role</button>
        </div>`;
    document.getElementById('work-container')?.insertAdjacentHTML('beforeend', html);
    if(autoRole) addRole(workId);
}
function addRole(workId, title='', rDate='', rDesc='') {
    const linesHtml = getDescHTML(rDesc.split('\n').map(l => l.trim()).filter(l => l).length ? rDesc.split('\n') : ['']);
    const html = `
        <div class="role-item">
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()">X</button>
            <div class="flex-row"><div><label>Role</label><input type="text" class="r-title" value="${title}"></div><div><label>Duration</label><input type="text" class="r-date" value="${rDate}"></div></div>
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 8px;"><label style="margin:0;">Format</label><select class="desc-format format-select"><option value="bullets">Bullets</option><option value="numbers">Numbers</option><option value="paragraph">Paragraph</option></select></div>
            <div class="desc-lines-container">${linesHtml}</div>
            <button type="button" class="btn-add-line" onclick="addDescLine(this)">+ Add Point</button>
        </div>`;
    document.querySelector(`#${workId} .roles-container`)?.insertAdjacentHTML('beforeend', html);
}
function spawnCustomBlock() {
    customSectionCounter++; const blockId = `custom-sec-${customSectionCounter}`;
    const html = `
        <div class="draggable-section" id="${blockId}" data-type="custom">
            <div class="section-header-flex" style="margin-top: 0;">
                <div style="display:flex; align-items:center; width:60%;"><span class="toggle-icon" onclick="toggleSection(this)" style="cursor:pointer; padding:5px;">▼</span><input type="text" class="custom-sec-title custom-sec-title-input" placeholder="SECTION TITLE"></div>
                <div class="section-controls"><span class="drag-handle" onmousedown="this.closest('.draggable-section').setAttribute('draggable', 'true')" onmouseup="this.closest('.draggable-section').removeAttribute('draggable')">☰</span><button type="button" class="btn-remove-section" onclick="this.closest('.draggable-section').remove()">✖ Remove</button></div>
            </div>
            <div class="custom-items-container"></div>
            <button type="button" class="btn-add" style="margin-top: 10px; background: var(--bg-card);" onclick="addCustomItem('${blockId}')">+ Add Item</button>
        </div>`;
    document.getElementById('builder-canvas').insertAdjacentHTML('beforeend', html);
    addCustomItem(blockId); document.querySelectorAll('.add-menu').forEach(m => m.style.display = 'none');
}
function addCustomItem(blockId) {
    const html = `
        <div class="section-block custom-item">
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()">Remove Item</button>
            <div class="form-group"><label>Heading <span class="add-date-btn" style="color:var(--brand-blue); cursor:pointer; font-size:10px; margin-left:10px; display:none;" onclick="toggleDate(this, true)">[+ Date]</span></label><input type="text" class="c-heading"></div>
            <div class="form-group date-wrapper"><label>Duration <span style="color:var(--danger-text); cursor:pointer; font-size:10px; float:right;" onclick="toggleDate(this, false)">✖ Remove Date</span></label><input type="text" class="c-date"></div>
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 8px;"><label style="margin:0;">Format</label><select class="desc-format format-select"><option value="bullets">Bullets</option><option value="numbers">Numbers</option><option value="paragraph">Paragraph</option></select></div>
            <div class="desc-lines-container"><div class="desc-line-item"><textarea class="desc-line"></textarea><button type="button" class="btn-remove-line" onclick="this.parentElement.remove()">✖</button></div></div>
            <button type="button" class="btn-add-line" onclick="addDescLine(this)">+ Add Point</button>
        </div>`;
    document.querySelector(`#${blockId} .custom-items-container`)?.insertAdjacentHTML('beforeend', html);
}

/** ===========================================================================
 * MODULE 6: LATEX COMPILATION ENGINE
 * =========================================================================== */
function escapeLatex(str) { return str ? str.replace(/%/g, '\\%').replace(/&/g, '\\&').replace(/\$/g, '\\$').replace(/#/g, '\\#') : ''; }

function formatText(linesArray, formatType, templateId) {
    if (!linesArray || linesArray.length === 0) return '';
    const isPro = templateId === 'tpl-professional';
    if (linesArray.length === 1 || formatType === 'paragraph') {
        let text = linesArray.map(escapeLatex).join(' \\\\[3pt]\n');
        return isPro ? `\\begin{itemize}[leftmargin=0in, label={}, itemsep=0pt, topsep=3pt, parsep=0pt, partopsep=0pt]\n  \\item \\small{${text}}\n\\end{itemize}` : `\\vspace{2pt}\n${text}`;
    }
    if (formatType === 'numbers') {
        return isPro ? '\\begin{enumerate}[leftmargin=0.20in,itemsep=0pt,topsep=3pt,parsep=0pt,partopsep=0pt]\n' + linesArray.map(l => `  \\item \\small{${escapeLatex(l)}}`).join('\n') + '\n\\end{enumerate}' : '\\begin{enumerate}\n' + linesArray.map(l => `  \\item ${escapeLatex(l)}`).join('\n') + '\n\\end{enumerate}';
    }
    return isPro ? '\\resumeItemListStart\n' + linesArray.map(l => `  \\resumeItem{${escapeLatex(l)}}`).join('\n') + '\n\\resumeItemListEnd' : '\\begin{itemize}\n' + linesArray.map(l => `  \\item ${escapeLatex(l)}`).join('\n') + '\n\\end{itemize}';
}

function getHeaderLatex(block) {
    let name = escapeLatex(block.querySelector('#name').value).toUpperCase();
    let phone = escapeLatex(block.querySelector('#phone').value);
    let email = escapeLatex(block.querySelector('#email').value);
    let links = escapeLatex(block.querySelector('#links').value);
    if (activeTemplateId === 'tpl-professional') {
        return `\\begin{center}\n  \\textbf{\\Huge ${name}} \\\\\n  \\vspace{4pt}\n  \\small\n  ${phone} $|$ \\href{mailto:${email}}{${email}}${links ? ` $|$ ${links}` : ''}\n\\end{center}\n\n`;
    }
    return `\\begin{center}\n  {\\color{black}\\LARGE\\bfseries ${name}}\n\\end{center}\n\\vspace{-4pt}\n\\noindent\n\\begin{tabular*}{\\linewidth}{@{\\extracolsep{\\fill}} l r}\n  ${phone} & \\href{mailto:${email}}{${email}} \\\\${links ? `\n  \\multicolumn{2}{c}{${links}} \\\\` : ''}\n\\end{tabular*}\n\n`;
}

function getCompiledLatex() {
    let bodyLatex = '';
    document.querySelectorAll('#builder-canvas .draggable-section').forEach(block => {
        if (block.style.display === 'none') return;
        let type = block.getAttribute('data-type');
        let title = escapeLatex(block.querySelector('.core-sec-title, .custom-sec-title')?.value) || type;
        
        if(type === 'header') bodyLatex += getHeaderLatex(block);
        else if(type === 'education') {
            let rows = [];
            block.querySelectorAll('.edu-item').forEach(i => {
                let deg=escapeLatex(i.querySelector('.e-deg').value), yr=escapeLatex(i.querySelector('.e-yr').value), inst=escapeLatex(i.querySelector('.e-inst').value), sc=escapeLatex(i.querySelector('.e-score').value);
                if(deg||inst) rows.push(activeTemplateId === 'tpl-professional' ? `  \\resumeSubheading{${inst}}{${yr}}{${deg}}{${sc}}` : `  \\textbf{${deg}} & ${yr} & ${inst} & ${sc} \\\\`);
            });
            bodyLatex += activeTemplateId === 'tpl-professional' ? `\\section{${title}}\n\\resumeSubHeadingList\n${rows.join('\n')}\n\\resumeSubHeadingListEnd\n\n` : `\\Section{${title.toUpperCase()}}\n\\begin{tabularx}{\\linewidth}{|X|l|X|r|}\n  \\hline\n${rows.join('\n  \\hhline{|====|}\n')}\n  \\hline\n\\end{tabularx}\n\n`;
        }
        else if(type === 'work') {
            let latex = '';
            block.querySelectorAll('.work-item').forEach(cb => {
                let comp = escapeLatex(cb.querySelector('.w-company').value), cDate = escapeLatex(cb.querySelector('.w-date').value);
                if(!comp) return;
                let roles = cb.querySelectorAll('.role-item');
                if (activeTemplateId === 'tpl-professional') {
                    if (roles.length <= 1) {
                        let rTitle = roles.length ? escapeLatex(roles[0].querySelector('.r-title').value) : '';
                        let rDate = roles.length ? escapeLatex(roles[0].querySelector('.r-date').value) : '';
                        let lines = roles.length ? [...roles[0].querySelectorAll('.desc-line')].map(el=>el.value.trim()).filter(Boolean) : [];
                        latex += `  \\resumeSubheading{${comp}}{${cDate}}{${rTitle}}{${rDate}}\n` + (lines.length ? formatText(lines, roles[0].querySelector('.desc-format').value, activeTemplateId) + '\n' : '');
                    } else {
                        latex += `  \\resumeSubheadingCompany{${comp}}{${cDate}}{}\n`;
                        roles.forEach(rb => {
                            let rTitle=escapeLatex(rb.querySelector('.r-title').value), rDate=escapeLatex(rb.querySelector('.r-date').value);
                            let lines=[...rb.querySelectorAll('.desc-line')].map(el=>el.value.trim()).filter(Boolean);
                            if(rTitle) latex += `  \\resumeSubheadingRole{${rTitle}}{${rDate}}\n` + formatText(lines, rb.querySelector('.desc-format').value, activeTemplateId) + '\n';
                        });
                    }
                } else {
                    latex += `\\textbf{${comp}}\n\\hfill\\textcolor{Gray}{${cDate}}\n\n`;
                    roles.forEach(rb => {
                        let rTitle=escapeLatex(rb.querySelector('.r-title').value), rDate=escapeLatex(rb.querySelector('.r-date').value);
                        let lines=[...rb.querySelectorAll('.desc-line')].map(el=>el.value.trim()).filter(Boolean);
                        if(rTitle) latex += `\\vspace{2pt}\n\\textbf{\\textit{${rTitle}}}\\hfill\\textcolor{Gray}{\\small ${rDate}}\n${formatText(lines, rb.querySelector('.desc-format').value, activeTemplateId)}\n\n`;
                    });
                }
            });
            bodyLatex += activeTemplateId === 'tpl-professional' ? `\\section{${title}}\n\\resumeSubHeadingList\n${latex}\\resumeSubHeadingListEnd\n\n` : `\\Section{${title.toUpperCase()}}\n${latex}\n`;
        }
        else if(type === 'project') {
            let latex = '';
            block.querySelectorAll('.proj-item').forEach(i => {
                let pTitle = escapeLatex(i.querySelector('.p-title').value), link = escapeLatex(i.querySelector('.p-link').value);
                if(!pTitle) return;
                let lines=[...i.querySelectorAll('.desc-line')].map(el=>el.value.trim()).filter(Boolean);
                if (activeTemplateId === 'tpl-professional') {
                    latex += `  \\resumeSubheading{${pTitle}}{}{${link}}{}\n` + (lines.length ? formatText(lines, i.querySelector('.desc-format').value, activeTemplateId) + '\n' : '');
                } else {
                    latex += `\\textbf{${pTitle}}${link ? ` | \\href{${link}}{\\underline{\\textcolor{#0056b3}{Link}}}` : ''}\n${formatText(lines, i.querySelector('.desc-format').value, activeTemplateId)}\n\n`;
                }
            });
            bodyLatex += activeTemplateId === 'tpl-professional' ? `\\section{${title}}\n\\resumeSubHeadingList\n${latex}\\resumeSubHeadingListEnd\n\n` : `\\Section{${title.toUpperCase()}}\n${latex}\n`;
        }
        else if(type === 'skill') {
            let s1=escapeLatex(block.querySelector('#sk1').value), s2=escapeLatex(block.querySelector('#sk2').value), s3=escapeLatex(block.querySelector('#sk3').value);
            if(s1||s2||s3) {
                if (activeTemplateId === 'tpl-professional') {
                    let s = `\\section{${title}}\n\\resumeSubHeadingList\n`;
                    if(s1) s += `  \\item[] \\small\\textbf{Languages/Tools:} ${s1}\n`;
                    if(s2) s += `  \\item[] \\small\\textbf{Frameworks:} ${s2}\n`;
                    if(s3) s += `  \\item[] \\small\\textbf{Other:} ${s3}\n`;
                    bodyLatex += s + `\\resumeSubHeadingListEnd\n\n`;
                } else {
                    bodyLatex += `\\Section{${title.toUpperCase()}}\n\\begin{tabularx}{\\linewidth}{|>{\\centering\\arraybackslash\\small}X|>{\\centering\\arraybackslash\\small}X|>{\\centering\\arraybackslash\\small}X|}\n  \\hline\n  ${s1} & ${s2} & ${s3} \\\\\n  \\hline\n\\end{tabularx}\n\n`;
                }
            }
        }
    });
    return activeTemplateLatex.replace('{{RESUME_BODY}}', bodyLatex.trim()).replace(/\n\s*\n/g, '\n\n').trim();
}