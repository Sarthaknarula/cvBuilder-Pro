let activeTemplateId = '';
let activeTemplateLatex = '';
let removedCoreSections = [];
let customSectionCounter = 0; 
let isUserLoggedIn = false; 

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', async () => {
    const authSection = document.getElementById('auth-section');
    const dashboardTabs = document.getElementById('dashboard-tabs');
    const saveCloudBtn = document.getElementById('btn-save-cloud');

    // 1. AUTHENTICATION CHECK
    if (authSection) {
        try {
            const authRes = await fetch('/api/user');
            const authData = await authRes.json();

            if (authData.loggedIn) {
                isUserLoggedIn = true;
                
                authSection.innerHTML = `
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <span style="font-size: 0.9rem; color: #555;">Logged in: <strong>${authData.user.email}</strong></span>
                        <a href="/logout" style="color: #d9534f; text-decoration: none; font-weight: bold; font-size: 0.85rem; border: 1px solid #d9534f; padding: 5px 10px; border-radius: 4px;">Logout</a>
                    </div>
                `;
                dashboardTabs.style.display = 'flex'; 
                if (saveCloudBtn) saveCloudBtn.style.display = 'block'; 
                
                fetchMyResumes(); // Load saved resumes into dashboard
                
            } else {
                authSection.innerHTML = `<a href="/auth/google" class="btn-google-login">Login with Google</a>`;
            }
        } catch (err) {
            console.error("Auth check failed:", err);
            authSection.innerHTML = `<a href="/auth/google" class="btn-google-login">Login with Google</a>`;
        }
    }

    // 2. TEMPLATE LOADING
    const grid = document.getElementById('template-grid');
    if (grid) {
        grid.innerHTML = '<p>Loading templates from database...</p>';
        try {
            const response = await fetch('/api/templates');
            const dbTemplates = await response.json();
            
            window.resumeTemplates = dbTemplates;
            grid.innerHTML = ''; 

            if (window.resumeTemplates.length === 0) {
                grid.innerHTML = `<p style="color:red;">No templates found in the database.</p>`;
                return;
            }

            window.resumeTemplates.forEach(template => {
                const cardHTML = `
                    <div class="template-card" onclick="openBuilder('${template.id}')">
                        <div class="preview-wrapper">${template.preview_html}</div>
                        <div class="template-title">${template.title}</div>
                        <div class="template-desc">${template.description}</div>
                        <button class="btn-primary" style="margin-top:0; padding: 10px; width: 80%;">Select Template</button>
                    </div>
                `;
                grid.insertAdjacentHTML('beforeend', cardHTML);
            });
        } catch (error) {
            console.error("Database fetch error:", error);
            grid.innerHTML = `<p style="color:red; text-align:center; font-weight:bold;">Error: Could not connect to the database.</p>`;
        }
    }

    // 3. DUMMY DATA FOR GUESTS
    if (document.getElementById('education-container') && !isUserLoggedIn) {
        addEducation(true, 'B.S. Computer Science', '2019 - 2023', 'Delhi Technological University', '9.15 CGPA');
        addWorkExperience('Tech Solutions Inc.', '2023 - Present', false); 
        addRole('work-exp-1', 'Software Engineer', 'June 2023 - Present', 'Developed and maintained scalable web applications.');
        addProject('E-Commerce Platform | React, Firebase', '', 'Architected a full-stack e-commerce solution.');
    }
});

// --- NAVIGATION & UI LOGIC ---
function openTab(evt, tabId) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(content => content.style.display = 'none');

    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabId).style.display = 'block';
    evt.currentTarget.classList.add('active');
}

async function fetchMyResumes() {
    const container = document.getElementById('tab-my-resumes');
    
    try {
        const response = await fetch('/api/my-resumes');
        if (!response.ok) return; 
        
        const saves = await response.json();
        if (saves.length === 0) return;

        let html = `
            <h1 style="color: #333; margin-top: 20px;">Your Workspace</h1>
            <p style="color: #666; font-size: 16px;">Pick up right where you left off.</p>
            <div class="template-grid">
        `;

        saves.forEach(save => {
            const dateStr = new Date(save.updated_at).toLocaleDateString(undefined, { 
                year: 'numeric', month: 'short', day: 'numeric' 
            });
            
            html += `
                <div class="template-card" onclick="openBuilder('${save.template_id}')">
                    <div class="preview-wrapper">${save.preview_html}</div>
                    <div class="template-title">${save.title}</div>
                    <div class="template-desc" style="color: #0056b3; font-weight: bold;">
                        Last edited: ${dateStr}
                    </div>
                    <button class="btn-success" style="margin-top:0; padding: 10px; width: 80%;">Continue Editing</button>
                </div>
            `;
        });
        
        html += `</div>`;
        container.innerHTML = html;

    } catch (err) {
        console.error("Error fetching saves:", err);
    }
}

async function openBuilder(templateId) {
    activeTemplateId = templateId; 
    activeTemplateLatex = window.resumeTemplates.find(t => t.id === templateId).latex_code; 
    
    document.getElementById('selection-screen').style.display = 'none';
    document.getElementById('builder-screen').style.display = 'flex';
    document.getElementById('output').value = '';

    const canvas = document.getElementById('builder-canvas');
    
    if (isUserLoggedIn) {
        canvas.style.opacity = '0.5';
        canvas.style.pointerEvents = 'none';

        try {
            const response = await fetch(`/api/load-resume/${templateId}`);
            
            if (response.ok) {
                const data = await response.json();
                if (data.resumeData && data.resumeData.html) {
                    canvas.innerHTML = data.resumeData.html;
                    console.log("☁ Resume successfully hydrated from cloud.");
                    
                    const customBlocks = canvas.querySelectorAll('[data-type="custom"]');
                    customSectionCounter = customBlocks.length;
                    const workBlocks = canvas.querySelectorAll('.work-item');
                    window.workCounter = workBlocks.length;
                }
            } else {
                console.log("No previous save found. Using default canvas.");
                if(document.getElementById('education-container').children.length === 0) {
                     addEducation(true, 'B.Tech Computer Science', '2023 - 2027', 'Delhi Technological University', '9.15 CGPA');
                }
            }
        } catch (err) {
            console.error("Hydration Error:", err);
        } finally {
            canvas.style.opacity = '1';
            canvas.style.pointerEvents = 'auto';
        }
    }
}

function goBackToSelection() {
    document.getElementById('builder-screen').style.display = 'none';
    document.getElementById('selection-screen').style.display = 'block';
}

function toggleSection(element) {
    const section = element.closest('.draggable-section');
    section.classList.toggle('collapsed');
}

// --- CLOUD SAVING ---
async function saveToCloud() {
    const saveBtn = document.getElementById('btn-save-cloud');
    if (!saveBtn) return;

    const originalText = saveBtn.innerText;
    saveBtn.innerText = "☁ Saving...";
    saveBtn.style.opacity = "0.7";
    saveBtn.disabled = true;

    try {
        document.querySelectorAll('#builder-canvas input, #builder-canvas textarea, #builder-canvas select').forEach(el => {
            if (el.tagName === 'INPUT') el.setAttribute('value', el.value);
            else if (el.tagName === 'TEXTAREA') el.innerHTML = el.value;
            else if (el.tagName === 'SELECT') {
                Array.from(el.options).forEach(opt => {
                    if (opt.value === el.value) opt.setAttribute('selected', 'selected');
                    else opt.removeAttribute('selected');
                });
            }
        });

        const canvasHTML = document.getElementById('builder-canvas').innerHTML;

        const response = await fetch('/api/save-resume', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                templateId: activeTemplateId,
                resumeData: { html: canvasHTML }
            })
        });

        if (!response.ok) throw new Error("Failed to save");

        saveBtn.innerText = "✔ Saved!";
        saveBtn.style.backgroundColor = "#28a745"; 
        
        setTimeout(() => {
            saveBtn.innerText = originalText;
            saveBtn.style.backgroundColor = ""; 
            saveBtn.style.opacity = "1";
            saveBtn.disabled = false;
        }, 3000);

    } catch (err) {
        console.error("Save Error:", err);
        saveBtn.innerText = "✖ Save Failed";
        saveBtn.style.backgroundColor = "#da3633"; 
        
        setTimeout(() => {
            saveBtn.innerText = originalText;
            saveBtn.style.backgroundColor = "";
            saveBtn.style.opacity = "1";
            saveBtn.disabled = false;
        }, 3000);
    }
}

// --- DRAG AND DROP ---
document.addEventListener('dragstart', e => {
    if (e.target.classList && e.target.classList.contains('draggable-section')) {
        e.target.classList.add('dragging');
    }
});

document.addEventListener('dragend', e => {
    if (e.target.classList && e.target.classList.contains('draggable-section')) {
        e.target.classList.remove('dragging');
        e.target.removeAttribute('draggable'); 
    }
});

const canvas = document.getElementById('builder-canvas');
if (canvas) {
    canvas.addEventListener('dragover', e => {
        e.preventDefault();
        const draggable = document.querySelector('.dragging');
        if (draggable) {
            const afterElement = getDragAfterElement(canvas, e.clientY);
            if (afterElement == null) canvas.appendChild(draggable);
            else canvas.insertBefore(draggable, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.draggable-section:not(.dragging):not(#core-header)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
        else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// --- ITEM MANAGEMENT ---
function toggleDate(btn, show) {
    const item = btn.closest('.custom-item');
    const wrapper = item.querySelector('.date-wrapper');
    const addBtn = item.querySelector('.add-date-btn');
    const input = item.querySelector('.c-date');
    if (show) { wrapper.style.display = 'block'; addBtn.style.display = 'none'; } 
    else { wrapper.style.display = 'none'; addBtn.style.display = 'inline'; input.value = ''; }
}

function removeCoreSection(sectionId, sectionName) {
    const section = document.getElementById(sectionId);
    section.style.display = 'none';
    if (!removedCoreSections.find(s => s.id === sectionId)) removedCoreSections.push({id: sectionId, name: sectionName});
}

function removeCustomSection(btn) { btn.closest('.draggable-section').remove(); }

function toggleAddMenu(event, btn) {
    if (event) event.stopPropagation(); 
    document.querySelectorAll('.add-menu').forEach(m => m.style.display = 'none');
    const menu = btn.nextElementSibling;
    menu.innerHTML = '';
    removedCoreSections.forEach(sec => {
        menu.innerHTML += `<button type="button" onclick="restoreCoreSection('${sec.id}')">Restore: ${sec.name}</button>`;
    });
    menu.innerHTML += `<button type="button" class="custom-add-btn" onclick="spawnCustomBlock()">+ Create New Custom Section</button>`;
    menu.style.display = 'flex';
}

function restoreCoreSection(sectionId) {
    const section = document.getElementById(sectionId);
    document.getElementById('builder-canvas').appendChild(section);
    section.style.display = 'block';
    removedCoreSections = removedCoreSections.filter(s => s.id !== sectionId);
    document.querySelectorAll('.add-menu').forEach(m => m.style.display = 'none');
}

document.addEventListener('click', function(e) {
    if (!e.target.closest('.bottom-action-area')) document.querySelectorAll('.add-menu').forEach(m => m.style.display = 'none');
});

function addDescLine(btn) {
    const container = btn.previousElementSibling;
    const html = `
        <div class="desc-line-item">
            <textarea class="desc-line" placeholder="Action or achievement..."></textarea>
            <button type="button" class="btn-remove-line" onclick="this.parentElement.remove()" title="Remove point">✖</button>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
}

// --- ADDING SPECIFIC CONTENT BLOCKS ---
function addEducation(isCompulsory = false, deg='', yr='', inst='', score='') {
    const container = document.getElementById('education-container');
    if (!container) return;
    const removeBtn = isCompulsory ? '' : `<button type="button" class="btn-remove" onclick="this.parentElement.remove()">Remove Item</button>`;
    const html = `
        <div class="section-block edu-item">
            ${removeBtn}
            <div class="flex-row">
                <div><label>Degree/Cert</label><input type="text" class="e-deg" value="${deg}"></div>
                <div><label>Year</label><input type="text" class="e-yr" value="${yr}"></div>
            </div>
            <div class="flex-row">
                <div><label>Institution</label><input type="text" class="e-inst" value="${inst}"></div>
                <div><label>Score/CGPA</label><input type="text" class="e-score" value="${score}"></div>
            </div>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);
}

function addProject(title='', link='', desc='') {
    const container = document.getElementById('project-container');
    if (!container) return;
    let lines = desc.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) lines = [''];
    let linesHtml = lines.map(l => `
        <div class="desc-line-item">
            <textarea class="desc-line" placeholder="Action or achievement...">${l}</textarea>
            <button type="button" class="btn-remove-line" onclick="this.parentElement.remove()" title="Remove point">✖</button>
        </div>
    `).join('');

    const html = `
        <div class="section-block proj-item">
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()">Remove Item</button>
            <div class="flex-row">
                <div><label>Project Name & Tech</label><input type="text" class="p-title" value="${title}"></div>
                <div><label>Link (Optional)</label><input type="text" class="p-link" value="${link}"></div>
            </div>
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <label style="margin:0;">Description Format</label>
                <select class="desc-format format-select">
                    <option value="bullets">Bullets</option>
                    <option value="numbers">Numbers</option>
                    <option value="paragraph">Paragraph</option>
                </select>
            </div>
            <div class="desc-lines-container">${linesHtml}</div>
            <button type="button" class="btn-add-line" onclick="addDescLine(this)">+ Add Point</button>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);
}

function addWorkExperience(company='', date='', autoRole=true) {
    const container = document.getElementById('work-container');
    if (!container) return;
    window.workCounter = (window.workCounter || 0) + 1;
    const workId = `work-exp-${window.workCounter}`;
    const html = `
        <div class="section-block work-item" id="${workId}">
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()">Remove Company</button>
            <div class="flex-row">
                <div><label>Company / Organization</label><input type="text" class="w-company" value="${company}" placeholder="e.g., Google, Inc."></div>
                <div><label>Total Duration</label><input type="text" class="w-date" value="${date}" placeholder="e.g., 2021 - Present"></div>
            </div>
            <div class="roles-container"></div>
            <button type="button" class="btn-add" style="margin-top: 10px; background: #fff;" onclick="addRole('${workId}')">+ Add Role under this Company</button>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);
    if(autoRole) addRole(workId);
}

function addRole(workId, title='', rDate='', rDesc='') {
    const container = document.querySelector(`#${workId} .roles-container`);
    if (!container) return;
    let lines = rDesc.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length === 0) lines = [''];
    let linesHtml = lines.map(l => `
        <div class="desc-line-item">
            <textarea class="desc-line" placeholder="Action or achievement...">${l}</textarea>
            <button type="button" class="btn-remove-line" onclick="this.parentElement.remove()" title="Remove point">✖</button>
        </div>
    `).join('');

    const html = `
        <div class="role-item">
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()">X</button>
            <div class="flex-row">
                <div><label>Role Title</label><input type="text" class="r-title" value="${title}" placeholder="e.g., Software Engineering Intern"></div>
                <div><label>Role Duration</label><input type="text" class="r-date" value="${rDate}" placeholder="e.g., May 2021 - July 2021"></div>
            </div>
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <label style="margin:0;">Description Format</label>
                <select class="desc-format format-select">
                    <option value="bullets">Bullets</option>
                    <option value="numbers">Numbers</option>
                    <option value="paragraph">Paragraph</option>
                </select>
            </div>
            <div class="desc-lines-container">${linesHtml}</div>
            <button type="button" class="btn-add-line" onclick="addDescLine(this)">+ Add Point</button>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);
}

function spawnCustomBlock(targetElement = null) {
    customSectionCounter++;
    const blockId = `custom-sec-${customSectionCounter}`;
    const html = `
        <div class="draggable-section" id="${blockId}" data-type="custom">
            <div class="section-header-flex" style="margin-top: 0;">
                <div style="display:flex; align-items:center; width:60%;">
                    <span class="toggle-icon" onclick="toggleSection(this)" style="cursor:pointer; padding:5px;">▼</span>
                    <input type="text" class="custom-sec-title custom-sec-title-input" placeholder="e.g., POSITIONS OF RESPONSIBILITY">
                </div>
                <div class="section-controls">
                    <span class="drag-handle" title="Drag to reorder" onmousedown="this.closest('.draggable-section').setAttribute('draggable', 'true')" onmouseup="this.closest('.draggable-section').removeAttribute('draggable')">☰</span>
                    <button type="button" class="btn-remove-section" onclick="removeCustomSection(this)">✖ Remove</button>
                </div>
            </div>
            <div class="custom-items-container"></div>
            <button type="button" class="btn-add" style="margin-top: 10px; background: #fff;" onclick="addCustomItem('${blockId}')">+ Add Item to this Section</button>
        </div>`;
    
    if (targetElement) targetElement.insertAdjacentHTML('afterend', html);
    else document.getElementById('builder-canvas').insertAdjacentHTML('beforeend', html);
    
    addCustomItem(blockId);
    document.querySelectorAll('.add-menu').forEach(m => m.style.display = 'none');
}

function addCustomItem(blockId) {
    const container = document.querySelector(`#${blockId} .custom-items-container`);
    const html = `
        <div class="section-block custom-item">
            <button type="button" class="btn-remove" onclick="this.parentElement.remove()">Remove Item</button>
            <div class="form-group">
                <label>Item Heading (Optional) <span class="add-date-btn" style="color:#0056b3; cursor:pointer; font-size:10px; margin-left:10px; display:none;" onclick="toggleDate(this, true)">[+ Add Date]</span></label>
                <input type="text" class="c-heading" placeholder="e.g., Coordinator, Tech Fest">
            </div>
            <div class="form-group date-wrapper">
                <label>Duration (Optional)<span style="color:#da3633; cursor:pointer; font-size:10px; float:right;" onclick="toggleDate(this, false)">✖ Remove Date</span></label>
                <input type="text" class="c-date" placeholder="e.g., 2021 - 2022">
            </div>
            <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <label style="margin:0;">Description Format</label>
                <select class="desc-format format-select"><option value="bullets">Bullets</option><option value="numbers">Numbers</option><option value="paragraph">Paragraph</option></select>
            </div>
            <div class="desc-lines-container">
                <div class="desc-line-item">
                    <textarea class="desc-line" placeholder="Action or achievement..."></textarea>
                    <button type="button" class="btn-remove-line" onclick="this.parentElement.remove()" title="Remove point">✖</button>
                </div>
            </div>
            <button type="button" class="btn-add-line" onclick="addDescLine(this)">+ Add Point</button>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);
}

// --- LATEX GENERATION LOGIC ---
function formatText(linesArray, formatType, templateId) {
    if (!linesArray || linesArray.length === 0) return '';
    if (linesArray.length === 1 || formatType === 'paragraph') {
        let joinedText = linesArray.map(l => escapeLatex(l)).join(' \\\\[3pt]\n');
        return templateId === 'tpl-professional' 
            ? `\\begin{itemize}[leftmargin=0in, label={}, itemsep=0pt, topsep=3pt, parsep=0pt, partopsep=0pt]\n  \\item \\small{${joinedText}}\n\\end{itemize}`
            : `\\vspace{2pt}\n${joinedText}`;
    }
    if (formatType === 'numbers') {
        return templateId === 'tpl-professional'
            ? '\\begin{enumerate}[leftmargin=0.20in,itemsep=0pt,topsep=3pt,parsep=0pt,partopsep=0pt]\n' + linesArray.map(l => `  \\item \\small{${escapeLatex(l)}}`).join('\n') + '\n\\end{enumerate}'
            : '\\begin{enumerate}\n' + linesArray.map(l => `  \\item ${escapeLatex(l)}`).join('\n') + '\n\\end{enumerate}';
    } else { 
        return templateId === 'tpl-professional'
            ? '\\resumeItemListStart\n' + linesArray.map(l => `  \\resumeItem{${escapeLatex(l)}}`).join('\n') + '\n\\resumeItemListEnd'
            : '\\begin{itemize}\n' + linesArray.map(l => `  \\item ${escapeLatex(l)}`).join('\n') + '\n\\end{itemize}';
    }
}

function escapeLatex(str) {
    if (!str) return '';
    return str.replace(/%/g, '\\%').replace(/&/g, '\\&').replace(/\$/g, '\\$').replace(/#/g, '\\#');
}

function getHeaderLatex(block) {
    let name = escapeLatex(block.querySelector('#name').value).toUpperCase();
    let phone = escapeLatex(block.querySelector('#phone').value);
    let email = escapeLatex(block.querySelector('#email').value);
    let linksStr = block.querySelector('#links').value ? escapeLatex(block.querySelector('#links').value) : '';
    
    if (activeTemplateId === 'tpl-professional') {
        let cl = `${phone} $|$ \\href{mailto:${email}}{${email}}`;
        if (linksStr) cl += ` $|$ ${linksStr}`;
        return `\\begin{center}\n  \\textbf{\\Huge ${name}} \\\\\n  \\vspace{4pt}\n  \\small\n  ${cl}\n\\end{center}\n\n`;
    } else {
        let cl = `  ${phone} & \\href{mailto:${email}}{${email}} \\\\`;
        if (linksStr) cl += `\n  \\multicolumn{2}{c}{${linksStr}} \\\\`;
        return `\\begin{center}\n  {\\color{black}\\LARGE\\bfseries ${name}}\n\\end{center}\n\\vspace{-4pt}\n\\noindent\n\\begin{tabular*}{\\linewidth}{@{\\extracolsep{\\fill}} l r}\n${cl}\n\\end{tabular*}\n\n`;
    }
}

function getEducationLatex(block) {
    let secTitle = escapeLatex(block.querySelector('.core-sec-title').value) || 'Education';
    let eduRows = [];
    block.querySelectorAll('.edu-item').forEach(item => {
        const deg = escapeLatex(item.querySelector('.e-deg').value);
        const yr = escapeLatex(item.querySelector('.e-yr').value);
        const inst = escapeLatex(item.querySelector('.e-inst').value);
        const score = escapeLatex(item.querySelector('.e-score').value);
        if (deg || inst) {
            if (activeTemplateId === 'tpl-professional') eduRows.push(`  \\resumeSubheading{${inst}}{${yr}}{${deg}}{${score}}`);
            else eduRows.push(`  \\textbf{${deg}} & ${yr} & ${inst} & ${score} \\\\`);
        }
    });
    if (eduRows.length === 0) return '';
    return activeTemplateId === 'tpl-professional' 
        ? `%—— EDUCATION ——\n\\section{${secTitle}}\n\\resumeSubHeadingList\n` + eduRows.join('\n') + `\n\\resumeSubHeadingListEnd\n\n`
        : `%—— EDUCATION ——\n\\Section{${secTitle.toUpperCase()}}\n\\begin{tabularx}{\\linewidth}{|X|l|X|r|}\n  \\hline\n` + eduRows.join('\n  \\hhline{|====|}\n') + `\n  \\hline\n\\end{tabularx}\n\n`;
}

function getWorkLatex(block) {
    let secTitle = escapeLatex(block.querySelector('.core-sec-title').value) || 'Experience';
    let workLatex = '';
    block.querySelectorAll('.work-item').forEach(companyBlock => {
        const company = escapeLatex(companyBlock.querySelector('.w-company').value);
        if (company) {
            const cDate = escapeLatex(companyBlock.querySelector('.w-date').value);
            const roles = companyBlock.querySelectorAll('.role-item');
            if (activeTemplateId === 'tpl-professional') {
                if (roles.length <= 1) { 
                    let rTitle = roles.length ? escapeLatex(roles[0].querySelector('.r-title').value) : '';
                    let rDate = roles.length ? escapeLatex(roles[0].querySelector('.r-date').value) : '';
                    let descLines = roles.length ? Array.from(roles[0].querySelectorAll('.desc-line')).map(el => el.value.trim()).filter(v => v !== '') : [];
                    let format = roles.length ? roles[0].querySelector('.desc-format').value : 'bullets';
                    workLatex += `  \\resumeSubheading{${company}}{${cDate}}{${rTitle}}{${rDate}}\n`;
                    if (descLines.length > 0) workLatex += formatText(descLines, format, activeTemplateId) + '\n';
                } else { 
                    workLatex += `  \\resumeSubheadingCompany{${company}}{${cDate}}{}\n`;
                    roles.forEach(roleBlock => {
                        let rTitle = escapeLatex(roleBlock.querySelector('.r-title').value);
                        let rDate = escapeLatex(roleBlock.querySelector('.r-date').value);
                        let descLines = Array.from(roleBlock.querySelectorAll('.desc-line')).map(el => el.value.trim()).filter(v => v !== '');
                        if (rTitle) {
                            workLatex += `  \\resumeSubheadingRole{${rTitle}}{${rDate}}\n`;
                            workLatex += formatText(descLines, roleBlock.querySelector('.desc-format').value, activeTemplateId) + '\n';
                        }
                    });
                }
            } else { 
                let currentWork = `\\textbf{${company}}\n\\hfill\\textcolor{Gray}{${cDate}}\n\n`;
                roles.forEach(roleBlock => {
                    const rTitle = escapeLatex(roleBlock.querySelector('.r-title').value);
                    const rDate = escapeLatex(roleBlock.querySelector('.r-date').value);
                    let descLines = Array.from(roleBlock.querySelectorAll('.desc-line')).map(el => el.value.trim()).filter(v => v !== '');
                    if (rTitle) {
                        currentWork += `\\vspace{2pt}\n\\textbf{\\textit{${rTitle}}}\\hfill\\textcolor{Gray}{\\small ${rDate}}\n`;
                        currentWork += `${formatText(descLines, roleBlock.querySelector('.desc-format').value, activeTemplateId)}\n\n`;
                    }
                });
                workLatex += currentWork;
            }
        }
    });
    if (!workLatex) return '';
    return activeTemplateId === 'tpl-professional' 
        ? `%—— EXPERIENCE ——\n\\section{${secTitle}}\n\\resumeSubHeadingList\n` + workLatex + `\\resumeSubHeadingListEnd\n\n`
        : `%—— EXPERIENCE ——\n\\Section{${secTitle.toUpperCase()}}\n` + workLatex + `\n`;
}

function getProjectLatex(block) {
    let secTitle = escapeLatex(block.querySelector('.core-sec-title').value) || 'Projects';
    let projLatex = '';
    block.querySelectorAll('.proj-item').forEach(item => {
        const title = escapeLatex(item.querySelector('.p-title').value);
        if (title) {
            const link = escapeLatex(item.querySelector('.p-link').value);
            let descLines = Array.from(item.querySelectorAll('.desc-line')).map(el => el.value.trim()).filter(v => v !== '');
            if (activeTemplateId === 'tpl-professional') {
                projLatex += `  \\resumeSubheading{${title}}{}{${link}}{}\n`;
                if (descLines.length > 0) projLatex += formatText(descLines, item.querySelector('.desc-format').value, activeTemplateId) + '\n';
            } else {
                let titleLine = `\\textbf{${title}}` + (link ? ` | \\href{${link}}{\\underline{\\textcolor{Blue}{Link}}}` : '');
                projLatex += `${titleLine}\n${formatText(descLines, item.querySelector('.desc-format').value, activeTemplateId)}\n\n`;
            }
        }
    });
    if (!projLatex) return '';
    return activeTemplateId === 'tpl-professional' 
        ? `%—— PROJECTS ——\n\\section{${secTitle}}\n\\resumeSubHeadingList\n` + projLatex + `\\resumeSubHeadingListEnd\n\n`
        : `%—— PROJECTS ——\n\\Section{${secTitle.toUpperCase()}}\n` + projLatex + `\n`;
}

function getSkillLatex(block) {
    let secTitle = escapeLatex(block.querySelector('.core-sec-title').value) || 'Skills';
    let s1 = escapeLatex(block.querySelector('#sk1').value);
    let s2 = escapeLatex(block.querySelector('#sk2').value);
    let s3 = escapeLatex(block.querySelector('#sk3').value);
    if (!s1 && !s2 && !s3) return '';
    if (activeTemplateId === 'tpl-professional') {
        let sec = `%—— SKILLS ——\n\\section{${secTitle}}\n\\resumeSubHeadingList\n`;
        if(s1) sec += `  \\item[] \\small\\textbf{Languages/Tools:} ${s1}\n`;
        if(s2) sec += `  \\item[] \\small\\textbf{Frameworks:} ${s2}\n`;
        if(s3) sec += `  \\item[] \\small\\textbf{Other:} ${s3}\n`;
        return sec + `\\resumeSubHeadingListEnd\n\n`;
    } else {
        return `%—— SKILLS ——\n\\Section{${secTitle.toUpperCase()}}\n\\begin{tabularx}{\\linewidth}{|>{\\centering\\arraybackslash\\small}X|>{\\centering\\arraybackslash\\small}X|>{\\centering\\arraybackslash\\small}X|}\n  \\hline\n  ${s1} & ${s2} & ${s3} \\\\\n  \\hline\n\\end{tabularx}\n\n`;
    }
}

function getCustomLatex(block) {
    let secTitle = escapeLatex(block.querySelector('.custom-sec-title').value);
    if (!secTitle) return ''; 
    let latex = activeTemplateId === 'tpl-professional' 
        ? `%—— CUSTOM ——\n\\section{${secTitle}}\n\\resumeSubHeadingList\n` 
        : `%—— CUSTOM ——\n\\Section{${secTitle.toUpperCase()}}\n`;
    let hasValidItems = false;
    block.querySelectorAll('.custom-item').forEach(item => {
        let heading = escapeLatex(item.querySelector('.c-heading').value);
        let date = escapeLatex(item.querySelector('.c-date').value);
        let descLines = Array.from(item.querySelectorAll('.desc-line')).map(el => el.value.trim()).filter(v => v !== '');
        if (heading || descLines.length > 0 || date) {
            hasValidItems = true;
            if (activeTemplateId === 'tpl-professional') {
                latex += (heading || date) ? `  \\vspace{-1pt}\\item[]\n  \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}\n    \\textbf{${heading}} & ${date} \\\\\n  \\end{tabular*}\\vspace{-6pt}\n` : `  \\item[]\n`;
                latex += formatText(descLines, item.querySelector('.desc-format').value, activeTemplateId) + '\n';
            } else {
                if (heading || date) latex += `\\textbf{${heading}}\\hfill\\textcolor{Gray}{\\small ${date}}\n`;
                latex += `${formatText(descLines, item.querySelector('.desc-format').value, activeTemplateId)}\n\n`;
            }
        }
    });
    if (!hasValidItems) return '';
    return activeTemplateId === 'tpl-professional' ? latex + `\\resumeSubHeadingListEnd\n\n` : latex + `\n`;
}

function getCompiledLatex() {
    let bodyLatex = '';
    document.querySelectorAll('#builder-canvas .draggable-section').forEach(block => {
        if (block.style.display === 'none') return;
        let type = block.getAttribute('data-type');
        if(type === 'header') bodyLatex += getHeaderLatex(block);
        else if(type === 'education') bodyLatex += getEducationLatex(block);
        else if(type === 'work') bodyLatex += getWorkLatex(block);
        else if(type === 'project') bodyLatex += getProjectLatex(block);
        else if(type === 'skill') bodyLatex += getSkillLatex(block);
        else if(type === 'custom') bodyLatex += getCustomLatex(block);
    });
    return activeTemplateLatex.replace('{{RESUME_BODY}}', bodyLatex.trim()).replace(/\n\s*\n/g, '\n\n').trim();
}

// --- GLOBAL EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    const btnGenerate = document.getElementById('btn-generate');
    const btnDownload = document.getElementById('btn-download');
    const btnSaveCloud = document.getElementById('btn-save-cloud');

    if (btnGenerate) btnGenerate.addEventListener('click', () => document.getElementById('output').value = getCompiledLatex());
    if (btnSaveCloud) btnSaveCloud.addEventListener('click', saveToCloud);

    if (btnDownload) btnDownload.addEventListener('click', async () => {
        const compiledCode = getCompiledLatex();
        document.getElementById('output').value = compiledCode; 
        const originalBtnText = btnDownload.innerText;
        btnDownload.innerText = "Compiling PDF...";
        btnDownload.disabled = true;
        try {
            const response = await fetch('/api/compile-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ latex: compiledCode })
            });
            if (!response.ok) throw new Error('Failed to compile PDF');
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl; a.download = 'My_Resume.pdf';
            document.body.appendChild(a); a.click(); a.remove();
            window.URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error(error); alert("Error compiling PDF.");
        } finally {
            btnDownload.innerText = originalBtnText; btnDownload.disabled = false;
        }
    });
});