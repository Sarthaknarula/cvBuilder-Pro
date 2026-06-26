let activeTemplateId = '';
let activeTemplateLatex = '';
let activeResumeName = ''; 
let removedCoreSections = [];
let customSectionCounter = 0; 
let isUserLoggedIn = false;
let mySavedResumes = [];
let currentWorkspaceView = 'grid';
let defaultCanvasHTML = '';

let lastCompiledLatex = '';
let lastCompiledBlobUrl = null;

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function showToast(message, type = 'success') {
    const container = $('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? '✔' : type === 'error' ? '✖' : 'ℹ';
    toast.innerHTML = `<span style="font-size: 18px;">${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

document.addEventListener('DOMContentLoaded', async () => {
    defaultCanvasHTML = document.getElementById('builder-canvas').innerHTML;

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

    initResizer();
    await checkAuthStatus();
    await fetchTemplates();
    initDefaultCanvas();

    document.getElementById('btn-generate')?.addEventListener('click', () => {
        document.getElementById('output').value = getCompiledLatex();
        switchRightPane('latex');
    });
    
    document.getElementById('btn-switch-template')?.addEventListener('click', openSwitchTemplateModal);
    document.getElementById('btn-preview-pdf')?.addEventListener('click', previewPDF);
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

function openSwitchTemplateModal() {
    const grid = document.getElementById('switch-template-grid');
    grid.innerHTML = '';
    
    if (!window.resumeTemplates || window.resumeTemplates.length === 0) {
        grid.innerHTML = '<p style="color:red;">No templates available.</p>';
    } else {
        window.resumeTemplates.forEach(t => {
            const isCurrent = t.id === activeTemplateId;
            grid.insertAdjacentHTML('beforeend', `
                <div class="template-card" style="flex: 0 0 280px; padding: 20px; display: flex; flex-direction: column; align-items: center; ${isCurrent ? 'border: 2px solid var(--brand-blue);' : ''}" onclick="applyNewTemplate('${t.id}')">
                    <div class="preview-wrapper" style="transform: scale(0.9); transform-origin: top center; margin-bottom: -30px; cursor:pointer; ${isCurrent ? 'opacity: 0.7;' : ''}">
                        ${t.preview_html}
                    </div>
                    <div class="template-title" style="font-size: 18px; margin: 10px 0;">${t.title}</div>
                    <button class="btn-primary" style="margin-top:auto; padding: 10px; width: 100%; font-size: 14px; ${isCurrent ? 'background-color: var(--text-muted); cursor: default;' : ''}">${isCurrent ? 'Currently Active' : 'Apply Template'}</button>
                </div>
            `);
        });
    }
    document.getElementById('switch-template-modal').style.display = 'flex';
}

function closeSwitchTemplateModal() {
    document.getElementById('switch-template-modal').style.display = 'none';
}

function applyNewTemplate(newTemplateId) {
    if (newTemplateId === activeTemplateId) {
        closeSwitchTemplateModal();
        return; 
    }
    
    const selectedTemplate = window.resumeTemplates.find(t => t.id === newTemplateId);
    if (selectedTemplate) {
        activeTemplateId = selectedTemplate.id;
        activeTemplateLatex = selectedTemplate.latex_code;
        
        lastCompiledLatex = ''; 
        document.getElementById('output').value = getCompiledLatex();
        
        showToast("Template switched successfully!", "success");
        closeSwitchTemplateModal();
    }
}

let resumeIdToDelete = null;

function deleteResume(id) {
    resumeIdToDelete = id;
    document.getElementById('delete-modal').style.display = 'flex';
}

function closeDeleteModal() {
    document.getElementById('delete-modal').style.display = 'none';
    resumeIdToDelete = null;
}

async function confirmDelete() {
    if (!resumeIdToDelete) return;
    
    try {
        const res = await fetch(`/api/delete-resume/${resumeIdToDelete}`, { method: 'DELETE' });
        if (res.ok) { 
            showToast("Resume deleted.", "success"); 
            fetchMyResumes(); 
        } else {
            throw new Error();
        }
    } catch (err) { 
        showToast("Failed to delete.", "error"); 
    } finally {
        closeDeleteModal();
    }
}

function switchRightPane(tab) {
    document.getElementById('tab-latex').classList.toggle('active', tab === 'latex');
    document.getElementById('tab-pdf').classList.toggle('active', tab === 'pdf');
    document.getElementById('content-latex').style.display = tab === 'latex' ? 'flex' : 'none';
    document.getElementById('content-pdf').style.display = tab === 'pdf' ? 'flex' : 'none';
}

function base64ToBlob(base64, mimeType = 'application/pdf') {
    const byteCharacters = atob(base64);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
        const slice = byteCharacters.slice(offset, offset + 512);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: mimeType });
}

async function previewPDF() {
    switchRightPane('pdf');
    const btn = document.getElementById('btn-preview-pdf');
    const compiledCode = getCompiledLatex();
    document.getElementById('output').value = compiledCode; 
    
    if (compiledCode === lastCompiledLatex && lastCompiledBlobUrl) {
        document.getElementById('pdf-empty-state').style.display = 'none';
        const iframe = document.getElementById('pdf-iframe');
        iframe.style.display = 'block';
        iframe.src = lastCompiledBlobUrl + '#toolbar=0&navpanes=0&scrollbar=0&view=Fit';
        return;
    }

    const origText = btn.innerText; 
    btn.innerText = "Queuing..."; 
    btn.disabled = true;

    try {
        const response = await fetch('/api/compile-pdf', {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ latex: compiledCode })
        });
        
        if (!response.ok) throw new Error("Failed to queue job");
        const { jobId } = await response.json();
        
        const pollJobStatus = async () => {
            try {
                const statusRes = await fetch(`/api/job-status/${jobId}`);
                const contentType = statusRes.headers.get("content-type");

                if (contentType && contentType.includes("application/pdf")) {
                    const blob = await statusRes.blob();
                    if (lastCompiledBlobUrl) window.URL.revokeObjectURL(lastCompiledBlobUrl);
                    lastCompiledBlobUrl = window.URL.createObjectURL(blob);
                    lastCompiledLatex = compiledCode;

                    document.getElementById('pdf-empty-state').style.display = 'none';
                    const iframe = document.getElementById('pdf-iframe');
                    iframe.style.display = 'block';
                    iframe.src = lastCompiledBlobUrl + '#toolbar=0&navpanes=0&scrollbar=0&view=Fit';

                    btn.innerText = origText;
                    btn.disabled = false;
                } else {
                    const statusData = await statusRes.json();
                    if (statusData.status === 'failed') {
                        showToast("LaTeX Error: Check your formatting for invalid characters.", "error");
                        btn.innerText = origText;
                        btn.disabled = false;
                    } else {
                        btn.innerText = statusData.status === 'active' ? "Compiling..." : "In Queue...";
                        setTimeout(pollJobStatus, 500);
                    }
                }
            } catch (pollError) {
                showToast("Network error while checking status.", "error");
                btn.innerText = origText;
                btn.disabled = false;
            }
        };

        pollJobStatus();
        
    } catch (error) { 
        showToast("Error queuing PDF.", "error"); 
        btn.innerText = origText; 
        btn.disabled = false; 
    }
}

async function downloadPDF() {
    const btn = document.getElementById('btn-download');
    const compiledCode = getCompiledLatex();
    document.getElementById('output').value = compiledCode; 

    if (compiledCode === lastCompiledLatex && lastCompiledBlobUrl) {
        triggerDownload(lastCompiledBlobUrl);
        return;
    }

    const origText = btn.innerText; 
    btn.innerText = "Queuing..."; 
    btn.disabled = true;
    
    try {
        const response = await fetch('/api/compile-pdf', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latex: compiledCode })
        });
        
        if (!response.ok) throw new Error("Failed to queue job");
        const { jobId } = await response.json();

        const pollJobStatus = async () => {
            try {
                const statusRes = await fetch(`/api/job-status/${jobId}`);
                const contentType = statusRes.headers.get("content-type");

                if (contentType && contentType.includes("application/pdf")) {
                    const blob = await statusRes.blob();
                    if (lastCompiledBlobUrl) window.URL.revokeObjectURL(lastCompiledBlobUrl);
                    lastCompiledBlobUrl = window.URL.createObjectURL(blob);
                    lastCompiledLatex = compiledCode;

                    triggerDownload(lastCompiledBlobUrl);

                    btn.innerText = origText;
                    btn.disabled = false;
                } else {
                    const statusData = await statusRes.json();
                    if (statusData.status === 'failed') {
                        showToast("LaTeX Error: Check your formatting for invalid characters.", "error");
                        btn.innerText = origText;
                        btn.disabled = false;
                    } else {
                        btn.innerText = statusData.status === 'active' ? "Compiling PDF..." : "In Queue...";
                        setTimeout(pollJobStatus, 500);
                    }
                }
            } catch (pollError) {
                showToast("Network error while checking status.", "error");
                btn.innerText = origText;
                btn.disabled = false;
            }
        };

        pollJobStatus();
        
    } catch (error) { 
        showToast("Error queuing PDF.", "error"); 
        btn.innerText = origText; 
        btn.disabled = false; 
    }
}

function triggerDownload(url) {
    const a = document.createElement('a'); 
    a.href = url; 
    a.download = (activeResumeName ? activeResumeName.replace(/\s+/g, '_') : 'My_Resume') + '.pdf'; 
    document.body.appendChild(a); 
    a.click(); 
    a.remove(); 
}

function initResizer() {
    const resizer = document.getElementById('dragMe');
    const leftPane = document.getElementById('left-pane');
    const rightPane = document.getElementById('right-pane');
    if(!resizer) return;
    let x = 0; let leftWidth = 0;
    
    const mouseMove = (e) => {
        const newLeftWidth = ((leftWidth + e.clientX - x) * 100) / resizer.parentNode.getBoundingClientRect().width;
        if(newLeftWidth > 20 && newLeftWidth < 80) { 
            leftPane.style.flex = `0 0 ${newLeftWidth}%`; 
            rightPane.style.flex = `1 1 0%`; 
        }
    };
    
    const mouseUp = () => {
        resizer.classList.remove('resizing');
        document.body.style.userSelect = '';
        leftPane.style.pointerEvents = '';
        rightPane.style.pointerEvents = '';
        document.removeEventListener('mousemove', mouseMove);
        document.removeEventListener('mouseup', mouseUp);
    };
    
    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault(); 
        x = e.clientX; 
        leftWidth = leftPane.getBoundingClientRect().width;
        resizer.classList.add('resizing');
        
        document.body.style.userSelect = 'none';
        leftPane.style.pointerEvents = 'none';
        rightPane.style.pointerEvents = 'none';
        
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
    
    lastCompiledLatex = '';
    if (lastCompiledBlobUrl) window.URL.revokeObjectURL(lastCompiledBlobUrl);
    lastCompiledBlobUrl = null;
    document.getElementById('pdf-iframe').style.display = 'none';
    document.getElementById('pdf-empty-state').style.display = 'flex';
    
    switchScreen('builder');
    
    document.getElementById('builder-canvas').innerHTML = defaultCanvasHTML;
    customSectionCounter = 0; window.workCounter = 0;
    
    document.getElementById('header-links-container').innerHTML = '';
    document.getElementById('education-container').innerHTML = '';
    document.getElementById('work-container').innerHTML = '';
    document.getElementById('project-container').innerHTML = '';
    document.getElementById('skill-container').innerHTML = '';
    
    document.getElementById('name').value = 'Alex Johnson';
    addHeaderLink('Phone', '+1 234 567 8900');
    addHeaderLink('Email', 'alex.johnson@email.com');
    addHeaderLink('LinkedIn', 'linkedin.com/in/alexj');
    
    addEducation(true, 'B.S. Computer Science', '2019 - 2023', 'University of Technology', '3.90 GPA');
    addWorkExperience('Tech Solutions Inc.', '2023 - Present', false); 
    addRole('work-exp-1', 'Software Engineer', 'June 2023 - Present', 'Developed and maintained scalable web applications.');
    addProject('E-Commerce Platform | React, Firebase', 'Live Demo', 'https://github.com', 'Architected a full-stack e-commerce solution.');
    addSkill('Languages / Tools', 'Python, Java, C++, React, Node.js');
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

function initDefaultCanvas() {
    if (!isUserLoggedIn && document.getElementById('education-container')) {
        document.getElementById('name').value = 'Alex Johnson';
        addHeaderLink('Phone', '+1 234 567 8900');
        addHeaderLink('Email', 'alex.johnson@email.com');
        addHeaderLink('LinkedIn', 'linkedin.com/in/alexj');
        
        addEducation(true, 'B.S. Computer Science', '2019 - 2023', 'University of Technology', '3.90 GPA');
        addWorkExperience('Tech Solutions Inc.', '2023 - Present', false); 
        addRole('work-exp-1', 'Software Engineer', 'June 2023 - Present', 'Developed and maintained scalable web applications.');
        addProject('E-Commerce Platform | React, Firebase', 'Live Demo', 'https://github.com', 'Architected a full-stack e-commerce solution.');
        addSkill('Languages / Tools', 'Python, Java, C++, React, Node.js');
    }
}

function addHeaderLink(linkName = '', linkUrl = '') {
    const html = `
        <div class="flex-row header-link-item" style="margin-top: 10px; align-items: flex-end;">
            <div style="flex: 1;"><label>Display Text</label><input type="text" class="h-link-name" placeholder="e.g. GitHub" value="${linkName}"></div>
            <div style="flex: 2;"><label>URL / Action (Optional)</label><input type="text" class="h-link-url" placeholder="https://..." value="${linkUrl}"></div>
            <button type="button" class="btn-remove-line" style="margin-bottom: 2px; padding: 6px 10px; cursor: pointer;" onclick="this.closest('.header-link-item').remove()" title="Remove Item">✖</button>
        </div>
    `;
    document.getElementById('header-links-container')?.insertAdjacentHTML('beforeend', html);
}

function getItemLinkHTML(linkName = '', linkUrl = '') {
    return `
        <div class="flex-row item-link-row" style="margin-top: 5px; align-items: flex-end;">
            <div style="flex: 1;"><label>Link Text</label><input type="text" class="i-link-name" placeholder="e.g. GitHub" value="${linkName}"></div>
            <div style="flex: 2;"><label>URL</label><input type="text" class="i-link-url" placeholder="https://..." value="${linkUrl}"></div>
            <button type="button" class="btn-remove-line" style="margin-bottom: 2px; padding: 6px 10px; cursor: pointer;" onclick="this.closest('.item-link-row').remove()" title="Remove Link">✖</button>
        </div>
    `;
}

function addItemLink(btn) {
    btn.previousElementSibling.insertAdjacentHTML('beforeend', getItemLinkHTML('', ''));
}

function addSkill(heading = '', details = '') {
    const html = `
        <div class="flex-row skill-item" style="margin-top: 10px; align-items: flex-end;">
            <div style="flex: 1;"><label>Category Heading</label><input type="text" class="s-heading" placeholder="e.g. Languages" value="${heading}"></div>
            <div style="flex: 2;"><label>Skills</label><input type="text" class="s-details" placeholder="e.g. C++, Java" value="${details}"></div>
            <button type="button" class="btn-remove-line" style="margin-bottom: 2px; padding: 6px 10px; cursor: pointer;" onclick="this.closest('.skill-item').remove()" title="Remove Item">✖</button>
        </div>
    `;
    document.getElementById('skill-container')?.insertAdjacentHTML('beforeend', html);
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
            ${isCompulsory ? '' : `<button type="button" class="btn-remove" onclick="this.parentElement.remove()">✖ Remove</button>`}
            <div class="flex-row"><div><label>Degree</label><input type="text" class="e-deg" value="${deg}"></div><div><label>Year</label><input type="text" class="e-yr" value="${yr}"></div></div>
            <div class="flex-row"><div><label>Institution</label><input type="text" class="e-inst" value="${inst}"></div><div><label>Score/CGPA</label><input type="text" class="e-score" value="${score}"></div></div>
        </div>`;
    document.getElementById('education-container')?.insertAdjacentHTML('beforeend', html);
}

function addProject(title='', linkName='', linkUrl='', desc='') {
    const linesHtml = getDescHTML(desc.split('\n').map(l => l.trim()).filter(l => l).length ? desc.split('\n') : ['']);
    const linkHtml = (linkName || linkUrl) ? getItemLinkHTML(linkName, linkUrl) : '';
    const html = `
        <div class="section-block proj-item">
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()">✖ Remove</button>
            <div class="flex-row">
                <div style="width: 100%;"><label>Project Name & Tech</label><input type="text" class="p-title" value="${title}"></div>
            </div>
            <div class="item-links-container">${linkHtml}</div>
            <button type="button" class="btn-add-line" style="color:var(--brand-blue); background:none; padding:0; margin-bottom:8px; font-size:12px;" onclick="addItemLink(this)">+ Add Link</button>
            <div class="desc-lines-container">${linesHtml}</div>
            <button type="button" class="btn-add-line" onclick="addDescLine(this)">+ Add Point</button>
        </div>`;
    document.getElementById('project-container')?.insertAdjacentHTML('beforeend', html);
}

function addWorkExperience(company='', date='', autoRole=true) {
    window.workCounter = (window.workCounter || 0) + 1; const workId = `work-exp-${window.workCounter}`;
    const html = `
        <div class="section-block work-item" id="${workId}">
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()">✖ Remove</button>
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
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()">✖</button>
            <div class="flex-row"><div><label>Role</label><input type="text" class="r-title" value="${title}"></div><div><label>Duration</label><input type="text" class="r-date" value="${rDate}"></div></div>
            <div class="item-links-container"></div>
            <button type="button" class="btn-add-line" style="color:var(--brand-blue); background:none; padding:0; margin-bottom:8px; font-size:12px;" onclick="addItemLink(this)">+ Add Link</button>
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
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()" title="Remove this item">✖ Remove</button>
            <div class="form-group">
                <label>Heading <button type="button" class="tiny-bold-btn active" onclick="this.classList.toggle('active')" title="Toggle Bold">B</button> <span class="add-date-btn" style="color:var(--brand-blue); cursor:pointer; font-size:10px; margin-left:10px; display:none;" onclick="toggleDate(this, true)">[+ Date]</span></label>
                <input type="text" class="c-heading" placeholder="e.g. Winner, Smart India Hackathon">
            </div>
            <div class="form-group date-wrapper"><label>Duration <span style="color:var(--danger-text); cursor:pointer; font-size:10px; float:right;" onclick="toggleDate(this, false)">✖ Remove Date</span></label><input type="text" class="c-date"></div>
            <div class="item-links-container"></div>
            <button type="button" class="btn-add-line" style="color:var(--brand-blue); background:none; padding:0; margin-bottom:8px; font-size:12px;" onclick="addItemLink(this)">+ Add Link</button>
            <div class="desc-lines-container"></div>
            <button type="button" class="btn-add-line" onclick="addDescLine(this)">+ Add Point</button>
        </div>`;
    document.querySelector(`#${blockId} .custom-items-container`)?.insertAdjacentHTML('beforeend', html);
}

function escapeLatex(str) { 
    return str ? str.replace(/%/g, '\\%').replace(/&/g, '\\&').replace(/\$/g, '\\$').replace(/#/g, '\\#').replace(/_/g, '\\_') : ''; 
}

function formatText(linesArray, templateId) {
    if (!linesArray || linesArray.length === 0) return '';
    const isPro = templateId === 'tpl-professional';
    
    if (linesArray.length === 1) {
        let text = escapeLatex(linesArray[0]);
        return isPro 
            ? `\\begin{itemize}[leftmargin=0in, label={}, itemsep=0pt, topsep=3pt, parsep=0pt, partopsep=0pt]\n  \\item \\small{${text}}\n\\end{itemize}` 
            : `\\\\\n\\vspace{2pt}\n${text}`; 
    }

    return isPro 
        ? '\\resumeItemListStart\n' + linesArray.map(l => `  \\resumeItem{${escapeLatex(l)}}`).join('\n') + '\n\\resumeItemListEnd' 
        : '\\begin{itemize}\n' + linesArray.map(l => `  \\item ${escapeLatex(l)}`).join('\n') + '\n\\end{itemize}';
}

function getProSubheading(primary, dateRow1, secondary, dateRow2) {
    if (!secondary && !dateRow2) {
        return `  \\vspace{-1pt}\\item[]\n  \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}\n    \\textbf{${primary}} & ${dateRow1} \\\\\n  \\end{tabular*}\\vspace{-4pt}`;
    }
    return `  \\resumeSubheading{${primary}}{${dateRow1}}{${secondary}}{${dateRow2}}`;
}

function extractItemLinks(itemElement) {
    let links = [];
    itemElement.querySelectorAll('.item-link-row').forEach(row => {
        let lName = escapeLatex(row.querySelector('.i-link-name').value);
        let lUrl = row.querySelector('.i-link-url').value.trim();
        if (lName && lUrl) links.push(`\\href{${lUrl}}{${lName}}`);
        else if (lUrl) links.push(`\\href{${lUrl}}{Link}`);
        else if (lName) links.push(lName);
    });
    return links;
}

function getHeaderLatex(block) {
    let name = escapeLatex(block.querySelector('#name').value).toUpperCase();
    
    let links = [];
    block.querySelectorAll('.header-link-item').forEach(item => {
        let lName = escapeLatex(item.querySelector('.h-link-name').value);
        let lUrl = item.querySelector('.h-link-url').value.trim();
        
        if (lName && lUrl) links.push(`\\href{${lUrl}}{${lName}}`);
        else if (lUrl) links.push(`\\href{${lUrl}}{Link}`);
        else if (lName) links.push(lName);
    });

    if (activeTemplateId === 'tpl-professional') {
        let contactString = links.join(' $|$ ');
        return `\\begin{center}\n  \\textbf{\\Huge ${name}} \\\\\n  \\vspace{4pt}\n  \\small\n  ${contactString}\n\\end{center}\n\n`;
    } 
    
    let latex = `\\begin{center}\n  {\\color{black}\\LARGE\\bfseries ${name}}\n\\end{center}\n\\vspace{-4pt}\n\\noindent\n`;
    if (links.length > 0) latex += `\\begin{center}\n  ${links.join(' \\ $|$ \\ ')}\n\\end{center}\n\n`;
    else latex += `\n`;
    return latex;
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
                if(deg||inst) rows.push(activeTemplateId === 'tpl-professional' ? getProSubheading(inst, yr, deg, sc) : `  \\textbf{${deg}} & ${yr} & ${inst} & ${sc} \\\\`);
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
                        
                        let links = roles.length ? extractItemLinks(roles[0]) : [];
                        let linkString = links.join(' $|$ ');
                        let fullSecondary = rTitle + (rTitle && linkString ? ` $|$ ` : '') + linkString;

                        let lines = roles.length ? [...roles[0].querySelectorAll('.desc-line')].map(el=>el.value.trim()).filter(Boolean) : [];
                        latex += getProSubheading(comp, cDate, fullSecondary, rDate) + '\n' + (lines.length ? formatText(lines, activeTemplateId) + '\n' : '');
                    } else {
                        latex += getProSubheading(comp, cDate, '', '') + '\n';
                        roles.forEach(rb => {
                            let rTitle=escapeLatex(rb.querySelector('.r-title').value), rDate=escapeLatex(rb.querySelector('.r-date').value);
                            
                            let links = extractItemLinks(rb);
                            let linkString = links.join(' $|$ ');
                            let fullSecondary = rTitle + (rTitle && linkString ? ` $|$ ` : '') + linkString;

                            let lines=[...rb.querySelectorAll('.desc-line')].map(el=>el.value.trim()).filter(Boolean);
                            if(fullSecondary || rDate) latex += `  \\resumeSubheadingRole{${fullSecondary}}{${rDate}}\n` + formatText(lines, activeTemplateId) + '\n';
                        });
                    }
                } else {
                    latex += `\\textbf{${comp}}\n\\hfill\\textcolor{Gray}{${cDate}}\n\n`;
                    roles.forEach(rb => {
                        let rTitle=escapeLatex(rb.querySelector('.r-title').value), rDate=escapeLatex(rb.querySelector('.r-date').value);
                        
                        let links = extractItemLinks(rb);
                        let linkString = links.join(' | ');
                        let fullSecondary = rTitle + (rTitle && linkString ? ` | ` : '') + linkString;

                        let lines=[...rb.querySelectorAll('.desc-line')].map(el=>el.value.trim()).filter(Boolean);
                        if(fullSecondary || rDate) latex += `\\vspace{2pt}\n\\textbf{\\textit{${fullSecondary}}}\\hfill\\textcolor{Gray}{\\small ${rDate}}\n${formatText(lines, activeTemplateId)}\n\n`;
                    });
                }
            });
            bodyLatex += activeTemplateId === 'tpl-professional' ? `\\section{${title}}\n\\resumeSubHeadingList\n${latex}\\resumeSubHeadingListEnd\n\n` : `\\Section{${title.toUpperCase()}}\n${latex}\n`;
        }
        
        else if(type === 'project') {
            let latex = '';
            block.querySelectorAll('.proj-item').forEach(i => {
                let pTitle = escapeLatex(i.querySelector('.p-title').value);
                if(!pTitle) return;

                let links = extractItemLinks(i);
                let lines=[...i.querySelectorAll('.desc-line')].map(el=>el.value.trim()).filter(Boolean);

                if (activeTemplateId === 'tpl-professional') {
                    let linkString = links.join(' $|$ ');
                    latex += getProSubheading(pTitle, '', linkString, '') + '\n' + (lines.length ? formatText(lines, activeTemplateId) + '\n' : '');
                } else {
                    let linkStrMod = links.join(' | ');
                    latex += `\\textbf{${pTitle}}${linkStrMod ? ` | ${linkStrMod}` : ''}\n${formatText(lines, activeTemplateId)}\n\n`;
                }
            });
            bodyLatex += activeTemplateId === 'tpl-professional' ? `\\section{${title}}\n\\resumeSubHeadingList\n${latex}\\resumeSubHeadingListEnd\n\n` : `\\Section{${title.toUpperCase()}}\n${latex}\n`;
        }
        
        else if(type === 'skill') {
            let latexLines = [];
            block.querySelectorAll('.skill-item').forEach(item => {
                let sHead = escapeLatex(item.querySelector('.s-heading').value);
                let sDet = escapeLatex(item.querySelector('.s-details').value);
                if (sHead || sDet) {
                    latexLines.push({head: sHead, det: sDet});
                }
            });
            
            if (latexLines.length > 0) {
                if (activeTemplateId === 'tpl-professional') {
                    let combinedLines = latexLines.map(l => `\\textbf{${l.head}:} ${l.det}`).join(' \\\\\n    ');
                    bodyLatex += `\\section{${title}}\n\\resumeSubHeadingList\n  \\item[] \\small{\n    ${combinedLines}\n  }\\vspace{-4pt}\n\\resumeSubHeadingListEnd\n\n`;
                } else {
                    let combinedLines = latexLines.map(l => `\\textbf{${l.head}:} ${l.det}`).join(' \\\\\n');
                    bodyLatex += `\\Section{${title.toUpperCase()}}\n${combinedLines}\n\n`;
                }
            }
        }
        
        else if(type === 'custom') {
            let latex = '';
            block.querySelectorAll('.custom-item').forEach(i => {
                let cHeading = escapeLatex(i.querySelector('.c-heading').value);
                let cDate = escapeLatex(i.querySelector('.c-date').value);
                let isBold = i.querySelector('.tiny-bold-btn') ? i.querySelector('.tiny-bold-btn').classList.contains('active') : true;
                
                if(!cHeading) return;
                
                let links = extractItemLinks(i);
                let lines=[...i.querySelectorAll('.desc-line')].map(el=>el.value.trim()).filter(Boolean);
                
                if (activeTemplateId === 'tpl-professional') {
                    let linkString = links.join(' $|$ ');
                    let formattedHeading = isBold ? cHeading : `\\textnormal{${cHeading}}`;
                    latex += getProSubheading(formattedHeading, cDate, linkString, '') + '\n' + (lines.length ? formatText(lines, activeTemplateId) + '\n' : '');
                } else {
                    let linkStrMod = links.join(' | ');
                    let formattedHeading = isBold ? `\\textbf{${cHeading}}` : cHeading;
                    let headText = `${formattedHeading}` + (linkStrMod ? ` | ${linkStrMod}` : '');
                    latex += `${headText}${cDate ? `\\hfill\\textcolor{Gray}{${cDate}}` : ''}\n${formatText(lines, activeTemplateId)}\n\n`;
                }
            });
            
            if(latex) {
                bodyLatex += activeTemplateId === 'tpl-professional' ? `\\section{${title}}\n\\resumeSubHeadingList\n${latex}\\resumeSubHeadingListEnd\n\n` : `\\Section{${title.toUpperCase()}}\n${latex}\n`;
            }
        }
    });
    return activeTemplateLatex.replace('{{RESUME_BODY}}', bodyLatex.trim()).replace(/\n\s*\n/g, '\n\n').trim();
}