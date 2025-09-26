import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { analyzeRepository, extractRepoInfo, getPopularityData } from './githubService.js';
import { generatePitchDeckPPT, getProjectStructure } from './presentationService.js';
import { User, Project } from './models.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection
const uri = "mongodb+srv://kulkarnivedang005_db_user:cc8Ee8wK9oZAyOXC@cluster0.lxeu1jb.mongodb.net/codeissance?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB successfully!'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Generate JWT token
const generateJWT = (user) => {
    return jwt.sign(
        { 
            _id: user._id, 
            githubId: user.githubId, 
            name: user.name,
            email: user.email,
            avatar_url: user.avatar_url
        },
        process.env.JWT_SECRET || 'your-jwt-secret',
        { expiresIn: '7d' }
    );
};

// Middleware to check if user is authenticated via JWT
const isAuthenticated = (req, res, next) => {
    // Check for JWT token in Authorization header
    const token = req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
                  ? req.headers.authorization.split(' ')[1] 
                  : null;
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
            // Add user info to request object
            req.user = decoded;
            return next();
        } catch (error) {
            return res.status(401).json({ 
                error: 'Invalid or expired token',
                details: error.message 
            });
        }
    }
    
    res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please provide a valid JWT token via Authorization header: Bearer <token>'
    });
};

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
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'], // Add your frontend URLs
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
        message: 'GitHub Repository Analyzer API with Authentication',
        endpoints: {
            // Authentication endpoints
            login: '/auth/github - GitHub OAuth login',
            loginCallback: '/auth/github/callback - OAuth callback',
            logout: '/auth/logout - Logout user',
            profile: '/auth/profile - Get current user profile',
            
            // Analysis endpoints (🔒 = Auth Required)
            analyze: '/analyze/:owner/:repo - 🔒 Full analysis + save to DB',
            analyzeByUrl: '/analyze-url (POST) - 🔒 Analysis with URL + save to DB',
            projectStructure: '/structure/:owner/:repo - Project structure',
            downloadPPT: '/download-ppt/:owner/:repo - Download PowerPoint',
            
            // User management (🔒 = Auth Required)
            updateUser: '/users (PUT) - 🔒 Update current user',
            getUser: '/users/:githubId (GET) - Get user by GitHub ID',
            
            // Project management (🔒 = Auth Required)
            listProjects: '/projects - 🔒 List projects with filters',
            getProject: '/projects/:id (GET) - Get specific project',
            updateProject: '/projects/:id (PUT) - 🔒 Update project',
            deleteProject: '/projects/:id (DELETE) - 🔒 Delete project'
        },
        authentication: {
            method: 'GitHub OAuth + JWT',
            tokenHeader: 'Authorization: Bearer <token>',
            cookieAuth: 'token cookie also supported'
        },
        database: {
            status: 'Connected to MongoDB',
            collections: ['users', 'projects']
        }
    });
});

// Simple Authentication Routes (JWT only)

app.get('/auth/profile', isAuthenticated, async (req, res) => {
    try {
        // Get full user data from database
        const user = await User.findById(req.user._id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        res.json({
            success: true,
            user: {
                _id: user._id,
                name: user.name,
                githubId: user.githubId,
                bio: user.bio,
                tech_stack: user.tech_stack,
                email: user.email,
                avatar_url: user.avatar_url,
                github_profile: user.github_profile,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch profile'
        });
    }
});

// Simple user creation/login endpoint for testing
app.post('/auth/create-user', async (req, res) => {
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
            // User exists, generate token and return
            const token = generateJWT(user);
            return res.json({
                success: true,
                message: 'User already exists, logged in successfully',
                token,
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
        
        // Generate JWT token
        const token = generateJWT(user);
        
        res.status(201).json({
            success: true,
            message: 'User created successfully',
            token,
            user: {
                _id: user._id,
                name: user.name,
                githubId: user.githubId,
                bio: user.bio,
                tech_stack: user.tech_stack,
                email: user.email,
                avatar_url: user.avatar_url,
                github_profile: user.github_profile
            },
            note: 'Use this token in Authorization header: Bearer <token>'
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

// Main analysis route using owner/repo parameters (🔒 Auth Required)
app.get('/analyze/:owner/:repo', isAuthenticated, async (req, res) => {
    const { owner, repo } = req.params;
    const userId = req.user._id; // Get user ID from authenticated user
    
    try {
        const result = await analyzeRepository(owner, repo);
        
        // Save to database with authenticated user
        try {
            const savedProject = await saveProjectToDatabase(result, userId);
            result.databaseId = savedProject._id;
            result.savedToDatabase = true;
            result.analyzedBy = {
                _id: req.user._id,
                name: req.user.name,
                githubId: req.user.githubId
            };
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

// Alternative route that accepts GitHub URL in request body (🔒 Auth Required)
app.post('/analyze-url', isAuthenticated, async (req, res) => {
    const { repoUrl } = req.body;
    const userId = req.user._id; // Get user ID from authenticated user
    
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
        
        // Save to database with authenticated user
        try {
            const savedProject = await saveProjectToDatabase(result, userId);
            result.databaseId = savedProject._id;
            result.savedToDatabase = true;
            result.analyzedBy = {
                _id: req.user._id,
                name: req.user.name,
                githubId: req.user.githubId
            };
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

// Project structure endpoint
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

// Popularity graph data endpoint (for frontend charts)
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

// Download PowerPoint presentation endpoint
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

// User management endpoints
app.put('/users', isAuthenticated, async (req, res) => {
    try {
        const { bio, tech_stack } = req.body;
        const userId = req.user._id;
        
        // Update current authenticated user
        const user = await User.findById(userId);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // Update allowed fields
        if (bio !== undefined) user.bio = bio;
        if (tech_stack !== undefined) user.tech_stack = tech_stack;
        
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

// Project management endpoints
app.get('/projects', isAuthenticated, async (req, res) => {
    try {
        const { page = 1, limit = 10, status, language, my_projects } = req.query;
        const skip = (page - 1) * limit;
        
        // Build query
        const query = {};
        if (status) query.status = status;
        if (language) query['github_data.language'] = language;
        
        // If my_projects=true, only show current user's projects
        if (my_projects === 'true') {
            query.created_by = req.user._id;
        }
        
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
            },
            requestedBy: {
                _id: req.user._id,
                name: req.user.name,
                githubId: req.user.githubId
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

app.put('/projects/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        
        // First check if project exists and user owns it
        const existingProject = await Project.findById(id);
        if (!existingProject) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }
        
        // Check ownership
        if (existingProject.created_by.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. You can only update your own projects.'
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

app.delete('/projects/:id', isAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        
        // First check if project exists and user owns it
        const project = await Project.findById(id);
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }
        
        // Check ownership
        if (project.created_by.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Access denied. You can only delete your own projects.'
            });
        }
        
        await Project.findByIdAndDelete(id);
        console.log(`✅ Deleted project: ${project.name} by user: ${req.user.githubId}`);
        
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
    console.log(`🚀 GitHub Repository Analyzer API with Database running on port ${port}`);
    console.log(`📝 Analysis Endpoints:`);
    console.log(`   GET  /analyze/:owner/:repo?userId=ID - Full analysis + save to DB`);
    console.log(`   POST /analyze-url - Analysis with URL + save to DB`);
    console.log(`   GET  /structure/:owner/:repo - Project structure`);
    console.log(`   GET  /download-ppt/:owner/:repo - Download PowerPoint`);
    console.log(`📝 Database Endpoints:`);
    console.log(`   POST /users - Create/update user`);
    console.log(`   GET  /users/:githubId - Get user by GitHub ID`);
    console.log(`   GET  /projects - List all projects (with filters)`);
    console.log(`   GET  /projects/:id - Get specific project`);
    console.log(`   PUT  /projects/:id - Update project`);
    console.log(`🔧 Make sure to set GITHUB_TOKEN and GOOGLE_AI_API_KEY in .env file`);
    console.log(`💾 Database: MongoDB connected successfully`);
});