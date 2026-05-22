require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

const templates = [
    {
        id: 'tpl-modern',
        title: 'The Original Grid',
        desc: 'Modern format with structured gray headers and defined table grid lines.',
        preview_html: `
            <div class="resume-paper t1-paper">
                <div class="t1-name">Alex Johnson</div>
                <div class="t1-contact">+1 234 567 8900 | alex.johnson@email.com | linkedin.com/in/alexj</div>
                <div class="t1-sec-head">Education</div>
                <table class="t1-table">
                    <tr><td class="pv-bold" style="width: 30%;">B.S. Computer Science</td><td style="width: 15%;">2019 - 2023</td><td style="width: 40%;">University of Technology</td><td style="text-align: right;">3.90 GPA</td></tr>
                    <tr><td class="pv-bold">High School Diploma</td><td>2015 - 2019</td><td>Springfield High School</td><td style="text-align: right;">98%</td></tr>
                </table>
                <div class="t1-sec-head">Work Experience</div>
                <div class="pv-flex"><span class="pv-bold">Tech Solutions Inc.</span> <span style="color:#666;">2023 - Present</span></div>
                <div class="pv-flex"><span class="pv-bold" style="font-style: italic;">Software Engineer</span> <span style="color:#666; font-size:12px;">June 2023 - Present</span></div>
                <ul class="pv-bullets">
                    <li>Developed and maintained scalable web applications using React and Node.js.</li>
                </ul>
                <div class="t1-sec-head">Academic Projects</div>
                <div class="pv-bold">E-Commerce Platform | React, Firebase</div>
                <ul class="pv-bullets">
                    <li>Architected a full-stack e-commerce solution with real-time inventory management.</li>
                </ul>
                <div class="t1-sec-head">Achievements</div>
                <ul class="pv-bullets">
                    <li>First place winner at the National Collegiate Hackathon 2022.</li>
                </ul>
                <div class="t1-sec-head">Technical Skills</div>
                <table class="t1-table" style="text-align: center;">
                    <tr><td style="width: 33%;">Python, Java, C++, JavaScript</td><td style="width: 33%;">React, Node.js, Express, Django</td><td>Git, Docker, AWS, SQL</td></tr>
                </table>
            </div>`,
        latex_code: String.raw`\documentclass[9pt]{article}
\usepackage[margin=0.6in]{geometry}
\usepackage[sfdefault]{roboto}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage[svgnames]{xcolor}
\definecolor{SectionGray}{gray}{0.8}
\definecolor{BodyGray}{HTML}{333333}
\usepackage[hidelinks]{hyperref}
\usepackage{array,hhline,tabularx}
\usepackage{enumitem}
\setlist[itemize]{noitemsep, topsep=2pt, leftmargin=*}
\setlength\parindent{0pt}
\setlength\parskip{0pt}
\renewcommand{\arraystretch}{1.1}

\newcommand{\Section}[1]{%
  \vspace{4pt}%
  \noindent
  \fcolorbox{black}{SectionGray}{%
    \parbox{\dimexpr\linewidth-2\fboxsep-2\fboxrule}{%
      \color{black}\small\bfseries #1%
    }%
  }%
  \vspace{3pt}%
}

\begin{document}
\color{BodyGray} 
\sffamily

{{RESUME_BODY}}

\end{document}`
    },
    {
        id: 'tpl-professional',
        title: 'Professional ATS',
        desc: 'Clean, minimalist format optimized for software engineering applicant tracking systems.',
        preview_html: `
            <div class="resume-paper t2-paper">
                <div class="t2-name">Alex Johnson</div>
                <div class="t2-contact">+1 234 567 8900 &nbsp;|&nbsp; alex.johnson@email.com &nbsp;|&nbsp; linkedin.com/in/alexj</div>
                <div class="t2-sec-head">Education</div>
                <div class="t2-subhead"><span>University of Technology</span> <span>2019 - 2023</span></div>
                <div class="t2-subhead-role"><span>B.S. Computer Science</span> <span>3.90 GPA</span></div>
                <div class="t2-subhead" style="margin-top: 6px;"><span>Springfield High School</span> <span>2015 - 2019</span></div>
                <div class="t2-subhead-role"><span>High School Diploma</span> <span>98%</span></div>
                <div class="t2-sec-head">Experience</div>
                <div class="t2-subhead"><span>Tech Solutions Inc.</span> <span>2023 - Present</span></div>
                <div class="t2-subhead-role"><span>Software Engineer</span> <span>June 2023 - Present</span></div>
                <ul class="t2-bullets">
                    <li>• Developed and maintained scalable web applications using React and Node.js.</li>
                </ul>
                <div class="t2-sec-head">Projects</div>
                <div class="t2-subhead"><span>E-Commerce Platform</span> <span>React, Firebase</span></div>
                <ul class="t2-bullets">
                    <li>• Architected a full-stack e-commerce solution.</li>
                </ul>
                <div class="t2-sec-head">Achievements</div>
                <ul class="t2-bullets">
                    <li>• First place winner at the National Collegiate Hackathon 2022.</li>
                </ul>
                <div class="t2-sec-head">Skills</div>
                <div style="font-size: 14px; margin-top: 6px; line-height: 1.4;">
                    <b>Languages/Tools:</b> Python, Java, C++, JavaScript<br>
                    <b>Frameworks:</b> React, Node.js, Express, Django<br>
                    <b>Other:</b> Git, Docker, AWS, SQL
                </div>
            </div>`,
        latex_code: String.raw`\documentclass{article}
\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{marvosym}
\usepackage[usenames,dvipsnames]{color}
\usepackage{verbatim}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\setlength{\footskip}{30.60004pt}
\usepackage[english]{babel}
\usepackage{tabularx}
\input{glyphtounicode}

\usepackage[T1]{fontenc}
\usepackage[scaled]{helvet}
\renewcommand\familydefault{\sfdefault}

\pagestyle{fancy}
\fancyhf{}
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}

\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-0.5in}
\addtolength{\textheight}{1.0in}

\urlstyle{same}
\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}

\titleformat{\section}{\Large\bfseries\raggedright}{}{0em}{}[\titlerule]
\pdfgentounicode=1

\newcommand{\resumeItem}[1]{\item[\textbullet]\small{#1}}

\newcommand{\resumeItemListStart}{%
  \begin{itemize}[leftmargin=0.20in,itemsep=0pt,topsep=3pt,parsep=0pt,partopsep=0pt,label=\textbullet]}
\newcommand{\resumeItemListEnd}{\end{itemize}}

\newcommand{\resumeSubheading}[4]{%
  \vspace{-1pt}\item[]
  \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
    \textbf{#1} & #2 \\
    \textit{\small#3} & \textit{\small #4} \\
  \end{tabular*}\vspace{-6pt}}

\newcommand{\resumeSubheadingRole}[2]{%
  \vspace{-10pt}\item[]
  \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
    \textit{\small#1} & \textit{\small #2} \\
  \end{tabular*}\vspace{-6pt}}

\newcommand{\resumeSubheadingCompany}[3]{%
  \vspace{-1pt}\item[]
  \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
    \textbf{#1} & #2 \\
    \multicolumn{2}{r}{\textit{\small #3}} \\
  \end{tabular*}\vspace{-6pt}}

\newcommand{\resumeSubHeadingList}{\begin{itemize}[leftmargin=0in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}

\begin{document}

{{RESUME_BODY}}

\end{document}`
    }
];

async function seedDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS templates (
                id VARCHAR(50) PRIMARY KEY,
                title VARCHAR(100) NOT NULL,
                description TEXT,
                preview_html TEXT NOT NULL,
                latex_code TEXT NOT NULL
            );
        `);
        console.log("✅ Table 'templates' created/verified.");

        await pool.query('DELETE FROM templates;');

        for (const tpl of templates) {
            await pool.query(
                `INSERT INTO templates (id, title, description, preview_html, latex_code) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [tpl.id, tpl.title, tpl.desc, tpl.preview_html, tpl.latex_code]
            );
            console.log(`Inserted template: ${tpl.title}`);
        }
        
        console.log("Seeding complete! You can now safely delete your old 'templates' folder.");
    } catch (err) {
        console.error("Seeding error:", err);
    } finally {
        pool.end();
    }
}

seedDatabase();