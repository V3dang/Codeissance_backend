import pptx from 'pptxgenjs';
import { Octokit } from "@octokit/rest";
import dotenv from 'dotenv';

dotenv.config();

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
    request: {
        timeout: 15000,
        retries: 1,
    },
});

// Function to get project structure
export const getProjectStructure = async (owner, repo) => {
    try {
        console.log(`🔍 Fetching project structure for: ${owner}/${repo}`);
        
        // Get repository tree
        const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
        const { data: tree } = await octokit.rest.git.getTree({
            owner,
            repo,
            tree_sha: repoData.default_branch,
            recursive: true
        });

        // Process and organize the file structure
        const structure = processFileTree(tree.tree);
        
        // Get languages used
        const { data: languages } = await octokit.rest.repos.listLanguages({ owner, repo });
        
        // Get package.json if it exists (for Node.js projects)
        let packageInfo = null;
        try {
            const { data: packageData } = await octokit.rest.repos.getContent({
                owner,
                repo,
                path: 'package.json'
            });
            const packageContent = Buffer.from(packageData.content, 'base64').toString('utf-8');
            packageInfo = JSON.parse(packageContent);
        } catch (err) {
            // package.json doesn't exist, that's fine
        }

        return {
            success: true,
            repository: { owner, repo, url: `https://github.com/${owner}/${repo}` },
            structure: {
                files: structure.files,
                directories: structure.directories,
                totalFiles: tree.tree.filter(item => item.type === 'blob').length,
                totalDirectories: tree.tree.filter(item => item.type === 'tree').length,
                fileTypes: getFileTypes(tree.tree),
                languages,
                packageInfo: packageInfo ? {
                    name: packageInfo.name,
                    version: packageInfo.version,
                    description: packageInfo.description,
                    dependencies: packageInfo.dependencies,
                    devDependencies: packageInfo.devDependencies,
                    scripts: packageInfo.scripts
                } : null
            },
            generatedAt: new Date().toISOString()
        };
    } catch (error) {
        throw new Error(`Failed to fetch project structure: ${error.message}`);
    }
};

// Helper function to process file tree
const processFileTree = (tree) => {
    const files = [];
    const directories = [];
    
    tree.forEach(item => {
        if (item.type === 'blob') {
            files.push({
                path: item.path,
                name: item.path.split('/').pop(),
                size: item.size,
                extension: getFileExtension(item.path),
                url: item.url
            });
        } else if (item.type === 'tree') {
            directories.push({
                path: item.path,
                name: item.path.split('/').pop(),
                url: item.url
            });
        }
    });
    
    return { files, directories };
};

// Helper function to get file extension
const getFileExtension = (filename) => {
    const ext = filename.split('.').pop();
    return ext === filename ? '' : ext;
};

// Helper function to analyze file types
const getFileTypes = (tree) => {
    const fileTypes = {};
    
    tree.filter(item => item.type === 'blob').forEach(file => {
        const ext = getFileExtension(file.path);
        if (ext) {
            fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        }
    });
    
    return fileTypes;
};

// Function to generate PowerPoint presentation
export const generatePitchDeckPPT = async (analysisData) => {
    try {
        console.log(`🎨 Generating PowerPoint presentation for: ${analysisData.repository.repo}`);
        
        const pres = new pptx();
        
        // Slide 1: Title Slide
        const slide1 = pres.addSlide();
        slide1.addText(analysisData.analysis.projectSummary.title || analysisData.repository.repo, {
            x: 1, y: 2, w: 8, h: 1.5,
            fontSize: 44, bold: true, color: '363636', align: 'center'
        });
        slide1.addText(analysisData.analysis.projectSummary.description || "Project Analysis", {
            x: 1, y: 3.5, w: 8, h: 1,
            fontSize: 24, color: '666666', align: 'center'
        });
        slide1.addText(`Repository: ${analysisData.repository.url}`, {
            x: 1, y: 5, w: 8, h: 0.5,
            fontSize: 16, color: '888888', align: 'center'
        });
        slide1.addText(`Generated: ${new Date().toLocaleDateString()}`, {
            x: 1, y: 6, w: 8, h: 0.5,
            fontSize: 14, color: 'AAAAAA', align: 'center'
        });

        // Slide 2: Project Overview
        const slide2 = pres.addSlide();
        slide2.addText("Project Overview", {
            x: 0.5, y: 0.5, w: 9, h: 1,
            fontSize: 36, bold: true, color: '363636'
        });
        
        const overviewData = [
            ['Metric', 'Value'],
            ['⭐ Stars', analysisData.metadata.stars?.toString() || '0'],
            ['🍴 Forks', analysisData.metadata.forks?.toString() || '0'],
            ['👀 Watchers', analysisData.metadata.watchers?.toString() || '0'],
            ['📝 Language', analysisData.metadata.language || 'Mixed'],
            ['🐛 Open Issues', analysisData.metadata.open_issues?.toString() || '0'],
            ['📅 Created', new Date(analysisData.metadata.created_at).toLocaleDateString()]
        ];
        
        slide2.addTable(overviewData, {
            x: 1, y: 2, w: 8, h: 4,
            fontSize: 16,
            border: { pt: 1, color: 'CFCFCF' },
            fill: { color: 'F7F7F7' }
        });

        // Slide 3: Problem & Solution
        const slide3 = pres.addSlide();
        slide3.addText("Problem & Solution", {
            x: 0.5, y: 0.5, w: 9, h: 1,
            fontSize: 36, bold: true, color: '363636'
        });
        
        slide3.addText("🎯 Problem Solved", {
            x: 0.5, y: 1.8, w: 4, h: 0.6,
            fontSize: 20, bold: true, color: '444444'
        });
        slide3.addText(analysisData.analysis.pitchDeck.problemSolved || "Problem analysis not available", {
            x: 0.5, y: 2.4, w: 4, h: 2,
            fontSize: 16, color: '666666', wrap: true
        });
        
        slide3.addText("💡 Solution", {
            x: 5, y: 1.8, w: 4, h: 0.6,
            fontSize: 20, bold: true, color: '444444'
        });
        slide3.addText(analysisData.analysis.pitchDeck.solution || "Solution analysis not available", {
            x: 5, y: 2.4, w: 4, h: 2,
            fontSize: 16, color: '666666', wrap: true
        });

        // Slide 4: Tech Stack
        const slide4 = pres.addSlide();
        slide4.addText("Technology Stack", {
            x: 0.5, y: 0.5, w: 9, h: 1,
            fontSize: 36, bold: true, color: '363636'
        });
        
        const techStack = analysisData.analysis.pitchDeck.techStack || ['Not specified'];
        let techText = techStack.map(tech => `• ${tech}`).join('\n');
        
        slide4.addText(techText, {
            x: 1, y: 2, w: 8, h: 4,
            fontSize: 20, color: '444444', bullet: false
        });

        // Slide 5: Health Report
        const slide5 = pres.addSlide();
        slide5.addText("Project Health Report", {
            x: 0.5, y: 0.5, w: 9, h: 1,
            fontSize: 36, bold: true, color: '363636'
        });
        
        const healthData = [
            ['Aspect', 'Status'],
            ['Overall Health', analysisData.analysis.healthReport.overallHealth || 'Unknown'],
            ['Completeness', analysisData.analysis.healthReport.completeness || 'Unknown'],
            ['Activity Level', analysisData.analysis.healthReport.activityLevel || 'Unknown'],
            ['Community Engagement', analysisData.analysis.healthReport.communityEngagement || 'Unknown']
        ];
        
        slide5.addTable(healthData, {
            x: 1, y: 2, w: 8, h: 3,
            fontSize: 16,
            border: { pt: 1, color: 'CFCFCF' },
            fill: { color: 'F7F7F7' }
        });

        // Slide 6: Roadmap
        const slide6 = pres.addSlide();
        slide6.addText("Development Roadmap", {
            x: 0.5, y: 0.5, w: 9, h: 1,
            fontSize: 36, bold: true, color: '363636'
        });
        
        const nextSteps = analysisData.analysis.roadmap.nextSteps || ['No roadmap available'];
        let roadmapText = nextSteps.map((step, index) => `${index + 1}. ${step}`).join('\n\n');
        
        slide6.addText(roadmapText, {
            x: 1, y: 2, w: 8, h: 4,
            fontSize: 18, color: '444444'
        });

        // Slide 7: Market Impact
        const slide7 = pres.addSlide();
        slide7.addText("Market Impact & Vision", {
            x: 0.5, y: 0.5, w: 9, h: 1,
            fontSize: 36, bold: true, color: '363636'
        });
        
        slide7.addText("📈 Impact", {
            x: 0.5, y: 1.8, w: 4, h: 0.6,
            fontSize: 20, bold: true, color: '444444'
        });
        slide7.addText(analysisData.analysis.pitchDeck.impact || "Impact analysis not available", {
            x: 0.5, y: 2.4, w: 4, h: 1.5,
            fontSize: 16, color: '666666', wrap: true
        });
        
        slide7.addText("🚀 Future Vision", {
            x: 5, y: 1.8, w: 4, h: 0.6,
            fontSize: 20, bold: true, color: '444444'
        });
        slide7.addText(analysisData.analysis.pitchDeck.futureVision || "Vision analysis not available", {
            x: 5, y: 2.4, w: 4, h: 1.5,
            fontSize: 16, color: '666666', wrap: true
        });

        console.log(`✅ PowerPoint presentation generated successfully`);
        return pres;
        
    } catch (error) {
        throw new Error(`Failed to generate PowerPoint: ${error.message}`);
    }
};