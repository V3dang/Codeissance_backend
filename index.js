import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { analyzeRepository, extractRepoInfo, getPopularityData } from './githubService.js';
import { generatePitchDeckPPT, getProjectStructure } from './presentationService.js';
import { createProjectPreview, stopPreview, listActivePreviews, stopAllPreviews, cleanupDockerResources } from './previewService.js';
import { User, Project } from './models.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection
const uri = "mongodb+srv://kulkarnivedang005_db_user:cc8Ee8wK9oZAyOXC@cluster0.lxeu1jb.mongodb.net/codeissance?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri)
.then(() => console.log('✅ Connected to MongoDB successfully!'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Helper function to save project data to database
const saveProjectToDatabase = async (analysisData, userId = null) => {
    try {
        const { repository, metadata, commits, issues, analysis, readmeLength } = analysisData;
        
        // Check if project already exists
        let project = await Project.findOne({
            owner: repository.owner,
            repo: repository.repo
        });
        
        const projectData = {
            name: repository.repo,
            description: metadata.description || 'No description available',
            repo_link: repository.url,
            owner: repository.owner,
            repo: repository.repo,
            github_data: {
                stars: metadata.stars,
                forks: metadata.forks,
                watchers: metadata.watchers,
                language: metadata.language,
                topics: metadata.topics || [],
                size: metadata.size,
                open_issues: metadata.open_issues,
                license: metadata.license,
                created_at: metadata.created_at,
                updated_at: metadata.updated_at
            },
            analysis: {
                project_summary: {
                    title: analysis.projectSummary?.title,
                    description: analysis.projectSummary?.description,
                    main_purpose: analysis.projectSummary?.mainPurpose,
                    target_audience: analysis.projectSummary?.targetAudience
                },
                health_report: {
                    overall_health: analysis.healthReport?.overallHealth,
                    completeness: analysis.healthReport?.completeness,
                    activity_level: analysis.healthReport?.activityLevel,
                    community_engagement: analysis.healthReport?.communityEngagement,
                    potential_issues: analysis.healthReport?.potentialIssues || [],
                    missing_components: analysis.healthReport?.missingComponents || []
                },
                roadmap: {
                    next_steps: analysis.roadmap?.nextSteps || [],
                    improvements: analysis.roadmap?.improvements || [],
                    features: analysis.roadmap?.features || [],
                    priorities: analysis.roadmap?.priorities || []
                },
                pitch_deck: {
                    problem_solved: analysis.pitchDeck?.problemSolved,
                    solution: analysis.pitchDeck?.solution,
                    tech_stack: analysis.pitchDeck?.techStack || [],
                    unique_value: analysis.pitchDeck?.uniqueValue,
                    impact: analysis.pitchDeck?.impact,
                    market_potential: analysis.pitchDeck?.marketPotential,
                    current_state: analysis.pitchDeck?.currentState,
                    future_vision: analysis.pitchDeck?.futureVision
                }
            },
            recent_commits: commits.map(commit => ({
                sha: commit.sha,
                message: commit.message,
                author: commit.author,
                date: new Date(commit.date),
                url: commit.url
            })),
            recent_issues: issues.map(issue => ({
                number: issue.number,
                title: issue.title,
                body: issue.body,
                labels: issue.labels,
                created_at: new Date(issue.created_at),
                user: issue.user,
                url: issue.url
            })),
            technology_stack: analysis.pitchDeck?.techStack || [metadata.language].filter(Boolean),
            readme_length: readmeLength,
            last_analyzed: new Date(),
            created_by: userId
        };
        
        if (project) {
            // Update existing project
            Object.assign(project, projectData);
            await project.save();
            console.log(`✅ Updated existing project in database: ${repository.owner}/${repository.repo}`);
        } else {
            // Create new project
            project = new Project(projectData);
            await project.save();
            console.log(`✅ Saved new project to database: ${repository.owner}/${repository.repo}`);
        }
        
        return project;
    } catch (error) {
        console.error('❌ Database save error:', error.message);
        throw new Error(`Failed to save project to database: ${error.message}`);
    }
};

// Middleware
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'],
    credentials: true
}));
app.use(express.json());

// Request timeout middleware
app.use((req, res, next) => {
    req.setTimeout(45000); // 45 second request timeout
    next();
});

// Routes
app.get('/', (req, res) => {
    return res.json({ 
        message: 'GitHub Repository Analyzer API - Public Access',
        endpoints: {
            // Analysis endpoints (All Public Now)
            analyze: '/analyze/:owner/:repo - Full analysis + save to DB',
            analyzeByUrl: '/analyze-url (POST) - Analysis with URL + save to DB',
            projectStructure: '/structure/:owner/:repo - Project structure',
            popularityData: '/popularity/:owner/:repo - Popularity graph data',
            downloadPPT: '/download-ppt/:owner/:repo - Download PowerPoint',
            
            // User management (All Public Now)
            createUser: '/users (POST) - Create new user',
            updateUser: '/users/:id (PUT) - Update user by ID',
            getUser: '/users/:githubId (GET) - Get user by GitHub ID',
            
            // Project management (All Public Now)
            listProjects: '/projects - List all projects with filters',
            getProject: '/projects/:id (GET) - Get specific project',
            updateProject: '/projects/:id (PUT) - Update project',
            deleteProject: '/projects/:id (DELETE) - Delete project',
            
            // Preview system (All Public Now)
            createPreview: '/preview/:owner/:repo (POST) - Create Docker preview',
            listPreviews: '/previews (GET) - List active previews',
            stopPreview: '/preview/:projectId (DELETE) - Stop preview',
            stopAllPreviews: '/previews/all (DELETE) - Stop all previews',
            cleanupDocker: '/previews/cleanup (POST) - Clean Docker resources'
        },
        authentication: {
            status: 'Disabled - All endpoints are now public',
            note: 'No authentication required for any endpoint'
        },
        database: {
            status: 'Connected to MongoDB',
            collections: ['users', 'projects']
        }
    });
});

// Main analysis route using owner/repo parameters (NOW PUBLIC)
app.get('/analyze/:owner/:repo', async (req, res) => {
    const { owner, repo } = req.params;
    const { userId } = req.query; // Optional user ID from query params
    
    try {
        const result = await analyzeRepository(owner, repo);
        
        // Save to database (with optional user association)
        try {
            const savedProject = await saveProjectToDatabase(result, userId);
            result.databaseId = savedProject._id;
            result.savedToDatabase = true;
            if (userId) {
                result.savedWithUserId = userId;
            }
        } catch (dbError) {
            console.warn('⚠️ Failed to save to database:', dbError.message);
            result.savedToDatabase = false;
            result.databaseError = dbError.message;
        }
        
        return res.json(result);
    } catch (error) {
        console.error('❌ Analysis error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message,
            repository: { owner, repo },
            suggestion: 'Try again in a few moments. GitHub API might be experiencing issues.'
        });
    }
});

// Alternative route that accepts GitHub URL in request body (NOW PUBLIC)
app.post('/analyze-url', async (req, res) => {
    const { repoUrl, userId } = req.body; // Optional user ID from request body
    
    if (!repoUrl) {
        return res.status(400).json({
            success: false,
            error: 'Repository URL is required in request body'
        });
    }
    
    try {
        const { owner, repo } = extractRepoInfo(repoUrl);
        const result = await analyzeRepository(owner, repo);
        
        // Update the repository URL in the response
        result.repository.url = repoUrl;
        
        // Save to database (with optional user association)
        try {
            const savedProject = await saveProjectToDatabase(result, userId);
            result.databaseId = savedProject._id;
            result.savedToDatabase = true;
            if (userId) {
                result.savedWithUserId = userId;
            }
        } catch (dbError) {
            console.warn('⚠️ Failed to save to database:', dbError.message);
            result.savedToDatabase = false;
            result.databaseError = dbError.message;
        }
        
        return res.json(result);
        
    } catch (error) {
        console.error('❌ Analysis error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message,
            providedUrl: repoUrl,
            suggestion: 'Try again in a few moments. GitHub API might be experiencing issues.'
        });
    }
});

// Project structure endpoint (Already public)
app.get('/structure/:owner/:repo', async (req, res) => {
    const { owner, repo } = req.params;
    
    try {
        console.log(`🏗️ Fetching project structure for: ${owner}/${repo}`);
        const structure = await getProjectStructure(owner, repo);
        return res.json(structure);
    } catch (error) {
        console.error('❌ Structure fetch error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message,
            repository: { owner, repo },
            suggestion: 'Try again in a few moments. GitHub API might be experiencing issues.'
        });
    }
});

// Popularity graph data endpoint (Already public)
app.get('/popularity/:owner/:repo', async (req, res) => {
    const { owner, repo } = req.params;
    
    try {
        console.log(`📈 Fetching popularity data for: ${owner}/${repo}`);
        const popularityData = await getPopularityData(owner, repo);
        return res.json(popularityData);
    } catch (error) {
        console.error('❌ Popularity data fetch error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message,
            repository: { owner, repo },
            suggestion: 'Repository might be private or API limits reached. Try again later.'
        });
    }
});

// Download PowerPoint presentation endpoint (Already public)
app.get('/download-ppt/:owner/:repo', async (req, res) => {
    const { owner, repo } = req.params;
    
    try {
        console.log(`📊 Generating PowerPoint for: ${owner}/${repo}`);
        
        // First get the analysis data
        const analysisData = await analyzeRepository(owner, repo);
        
        // Generate PowerPoint
        const pres = await generatePitchDeckPPT(analysisData);
        
        // Set headers for file download
        const filename = `${owner}-${repo}-pitch-deck.pptx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // Write presentation to response
        await pres.writeFile({ fileName: filename, stream: res });
        
        console.log(`✅ PowerPoint generated and sent: ${filename}`);
        
    } catch (error) {
        console.error('❌ PowerPoint generation error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message,
            repository: { owner, repo },
            suggestion: 'Failed to generate PowerPoint. Try again later.'
        });
    }
});

// User management endpoints (NOW ALL PUBLIC)

// Create new user (NOW PUBLIC)
app.post('/users', async (req, res) => {
    try {
        const { name, githubId, email, bio = '', tech_stack = [] } = req.body;
        
        if (!name || !githubId) {
            return res.status(400).json({
                success: false,
                error: 'Name and githubId are required'
            });
        }
        
        // Check if user already exists
        let user = await User.findOne({ githubId });
        
        if (user) {
            return res.status(409).json({
                success: false,
                error: 'User with this GitHub ID already exists',
                existingUser: {
                    _id: user._id,
                    name: user.name,
                    githubId: user.githubId,
                    email: user.email
                }
            });
        }
        
        // Create new user
        user = new User({
            name,
            githubId,
            email,
            bio,
            tech_stack,
            avatar_url: `https://github.com/identicons/${githubId}.png`,
            github_profile: `https://github.com/${githubId}`
        });
        
        await user.save();
        
        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user: {
                _id: user._id,
                name: user.name,
                githubId: user.githubId,
                bio: user.bio,
                tech_stack: user.tech_stack,
                email: user.email,
                avatar_url: user.avatar_url,
                github_profile: user.github_profile
            }
        });
        
    } catch (error) {
        console.error('User creation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create user',
            details: error.message
        });
    }
});

// Update user by ID (NOW PUBLIC)
app.put('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, bio, tech_stack, email } = req.body;
        
        const user = await User.findById(id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // Update allowed fields
        if (name !== undefined) user.name = name;
        if (bio !== undefined) user.bio = bio;
        if (tech_stack !== undefined) user.tech_stack = tech_stack;
        if (email !== undefined) user.email = email;
        
        await user.save();
        console.log(`✅ Updated user profile: ${user.githubId}`);
        
        return res.json({
            success: true,
            user: user,
            message: 'Profile updated successfully'
        });
        
    } catch (error) {
        console.error('❌ User update error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get user by GitHub ID (Already public)
app.get('/users/:githubId', async (req, res) => {
    try {
        const { githubId } = req.params;
        const user = await User.findOne({ githubId });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        return res.json({
            success: true,
            user: user
        });
        
    } catch (error) {
        console.error('❌ User fetch error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Project management endpoints (NOW ALL PUBLIC)

// List projects (NOW PUBLIC)
app.get('/projects', async (req, res) => {
    try {
        const { page = 1, limit = 10, status, language, userId } = req.query;
        const skip = (page - 1) * limit;
        
        // Build query
        const query = {};
        if (status) query.status = status;
        if (language) query['github_data.language'] = language;
        if (userId) query.created_by = userId;
        
        const projects = await Project.find(query)
            .populate('created_by', 'name githubId avatar_url')
            .sort({ last_analyzed: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        const total = await Project.countDocuments(query);
        
        return res.json({
            success: true,
            projects: projects,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(total / limit),
                total_projects: total,
                has_next: skip + projects.length < total,
                has_prev: page > 1
            }
        });
        
    } catch (error) {
        console.error('❌ Projects fetch error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get specific project (Already public)
app.get('/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const project = await Project.findById(id).populate('created_by', 'name githubId avatar_url');
        
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }
        
        return res.json({
            success: true,
            project: project
        });
        
    } catch (error) {
        console.error('❌ Project fetch error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update project (NOW PUBLIC - with optional ownership verification)
app.put('/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, ...updates } = req.body; // Optional userId for ownership check
        
        // First check if project exists
        const existingProject = await Project.findById(id);
        if (!existingProject) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }
        
        // Optional ownership check
        if (userId && existingProject.created_by && existingProject.created_by.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. You can only update your own projects.',
                note: 'Remove userId from request body to update any project'
            });
        }
        
        // Remove fields that shouldn't be updated directly
        delete updates._id;
        delete updates.createdAt;
        delete updates.updatedAt;
        delete updates.created_by;
        delete updates.github_data;
        delete updates.analysis;
        
        const project = await Project.findByIdAndUpdate(
            id, 
            { ...updates, last_analyzed: new Date() }, 
            { new: true, runValidators: true }
        ).populate('created_by', 'name githubId avatar_url');
        
        return res.json({
            success: true,
            project: project,
            message: 'Project updated successfully'
        });
        
    } catch (error) {
        console.error('❌ Project update error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Delete project (NOW PUBLIC - with optional ownership verification)
app.delete('/projects/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body; // Optional userId for ownership check
        
        // First check if project exists
        const project = await Project.findById(id);
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }
        
        // Optional ownership check
        if (userId && project.created_by && project.created_by.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. You can only delete your own projects.',
                note: 'Remove userId from request body to delete any project'
            });
        }
        
        await Project.findByIdAndDelete(id);
        console.log(`✅ Deleted project: ${project.name}`);
        
        return res.json({
            success: true,
            message: 'Project deleted successfully',
            deletedProject: {
                _id: project._id,
                name: project.name,
                repo_link: project.repo_link
            }
        });
        
    } catch (error) {
        console.error('❌ Project delete error:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 🎬 PROJECT PREVIEW ENDPOINTS (NOW ALL PUBLIC)

// Create project preview (NOW PUBLIC)
app.post('/preview/:owner/:repo', async (req, res) => {
    const { owner, repo } = req.params;
    const { projectType, dockerConfig } = req.body;
    
    try {
        console.log(`🎬 Creating preview for ${owner}/${repo}`);
        
        const preview = await createProjectPreview(owner, repo, {
            projectType,
            dockerConfig
        });
        
        res.json(preview);
        
    } catch (error) {
        console.error('❌ Preview creation error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            repository: { owner, repo },
            suggestion: 'Check if Docker is running and repository is accessible'
        });
    }
});

// List active previews (NOW PUBLIC)
app.get('/previews', async (req, res) => {
    try {
        const previews = await listActivePreviews();
        res.json(previews);
    } catch (error) {
        console.error('❌ List previews error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Stop specific preview (NOW PUBLIC)
app.delete('/preview/:projectId', async (req, res) => {
    const { projectId } = req.params;
    
    try {
        const result = await stopPreview(projectId);
        res.json(result);
    } catch (error) {
        console.error('❌ Stop preview error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Stop all preview containers (NOW PUBLIC)
app.delete('/previews/all', async (req, res) => {
    try {
        const result = await stopAllPreviews();
        res.json(result);
    } catch (error) {
        console.error('❌ Stop all previews error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Clean up Docker resources (NOW PUBLIC)
app.post('/previews/cleanup', async (req, res) => {
    try {
        const result = await cleanupDockerResources();
        res.json(result);
    } catch (error) {
        console.error('❌ Docker cleanup error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Legacy upload route (keep for compatibility)
app.post('/upload', multer().single('pdf'), (req, res) => {
    return res.json({message: 'Received'});
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

app.listen(port, () => {
    console.log(`🚀 GitHub Repository Analyzer API - PUBLIC ACCESS running on port ${port}`);
    console.log(`📝 Analysis Endpoints (All Public):`);
    console.log(`   GET  /analyze/:owner/:repo - Full analysis + save to DB`);
    console.log(`   POST /analyze-url - Analysis with URL + save to DB`);
    console.log(`   GET  /structure/:owner/:repo - Project structure`);
    console.log(`   GET  /popularity/:owner/:repo - Popularity graph data`);
    console.log(`   GET  /download-ppt/:owner/:repo - Download PowerPoint`);
    console.log(`📝 User Management (All Public):`);
    console.log(`   POST /users - Create new user`);
    console.log(`   PUT  /users/:id - Update user by ID`);
    console.log(`   GET  /users/:githubId - Get user by GitHub ID`);
    console.log(`📝 Project Management (All Public):`);
    console.log(`   GET  /projects - List all projects (with filters)`);
    console.log(`   GET  /projects/:id - Get specific project`);
    console.log(`   PUT  /projects/:id - Update project`);
    console.log(`   DELETE /projects/:id - Delete project`);
    console.log(`🎬 Preview System (All Public):`);
    console.log(`   POST /preview/:owner/:repo - Create Docker preview`);
    console.log(`   GET  /previews - List active previews`);
    console.log(`   DELETE /preview/:projectId - Stop specific preview`);
    console.log(`   DELETE /previews/all - Stop all previews`);
    console.log(`🔧 Make sure to set GITHUB_TOKEN and GOOGLE_AI_API_KEY in .env file`);
    console.log(`💾 Database: MongoDB connected successfully`);
    console.log(`🌐 Authentication: DISABLED - All endpoints are now public!`);
});