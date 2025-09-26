import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { analyzeRepository, extractRepoInfo } from './githubService.js';
import { generatePitchDeckPPT, getProjectStructure } from './presentationService.js';
import { User, Project, Mentor, Review, ContributionRequest } from './models.js';
import { 
    createMentor, 
    getMentorById, 
    getMentorByEmail, 
    getAllMentors, 
    updateMentor, 
    loginMentor 
} from './mentorService.js';
import { 
    createReview, 
    getProjectReviews, 
    getReviewById, 
    updateReview, 
    deleteReview, 
    getMentorReviews 
} from './reviewService.js';
import {
    sendContributionRequest,
    getProjectContributionRequests,
    approveContributionRequest,
    rejectContributionRequest,
    getContributionRequest
} from './contributionService.js';
import {
    getUserStats,
    getLeaderboard
} from './gamificationService.js';
import {
    getProjectRecommendations
} from './recommendationService.js';

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
// Middleware to check if user is authenticated via JWT
const isAuthenticated = async (req, res, next) => {
    // Check for JWT token in Authorization header
    const token = req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
                  ? req.headers.authorization.split(' ')[1] 
                  : null;
    
    if (token) {
        try {
            // Check if token exists in database and get the associated user
            const user = await User.findOne({ jwtToken: token });
            
            if (user) {
                req.user = {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    githubId: user.githubId
                };
                return next();
            }
            
            return res.status(401).json({ 
                success: false,
                error: 'Invalid token'
            });
        } catch (error) {
            return res.status(401).json({ 
                success: false,
                error: 'Authentication error',
                details: error.message 
            });
        }
    }
    
    res.status(401).json({ 
        success: false,
        error: 'Authentication required',
        message: 'Please provide a valid JWT token via Authorization header: Bearer <token>'
    });
};

// Helper function to save project data to database
const saveProjectToDatabase = async (analysisData, userId = null) => {
    try {
        const { repository, metadata, analysis } = analysisData;
        
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
                stars: metadata.stars || 0,
                forks: metadata.forks || 0,
                language: metadata.language || 'Unknown',
                topics: metadata.topics || []
            },
            analysis: {
                project_summary: {
                    title: analysis?.projectSummary?.title || repository.repo,
                    description: analysis?.projectSummary?.description || metadata.description
                }
            },
            technology_stack: [metadata.language].filter(Boolean),
            last_analyzed: new Date(),
            created_by: userId
        };
        
        if (project) {
            Object.assign(project, projectData);
            await project.save();
        } else {
            project = new Project(projectData);
            await project.save();
        }
        
        return project;
    } catch (error) {
        console.error('Database save error:', error.message);
        throw error;
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
            // User exists, return stored token
            return res.json({
                success: true,
                message: 'User already exists, logged in successfully',
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
            github_profile: `https://github.com/${githubId}`,
            jwtToken: `test-token-${githubId}`
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
    const userId = req.user._id;
    
    if (!repoUrl) {
        return res.status(400).json({
            success: false,
            error: 'Repository URL is required in request body'
        });
    }
    
    try {
        const { owner, repo } = extractRepoInfo(repoUrl);
        const result = await analyzeRepository(owner, repo);
        
        result.repository.url = repoUrl;
        
        // Save to database
        const savedProject = await saveProjectToDatabase(result, userId);
        
        return res.json({
            success: true,
            message: 'Project analyzed and saved successfully',
            project: {
                _id: savedProject._id,
                name: savedProject.name,
                description: savedProject.description,
                repo_link: savedProject.repo_link,
                owner: savedProject.owner,
                repo: savedProject.repo
            },
            analysis: result
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Manual project creation endpoint
app.post('/projects', async (req, res) => {
    const { name, description, repo_link, owner, repo, technology_stack, created_by } = req.body;
    
    // Validate required fields
    if (!name || !description || !repo_link) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields: name, description, repo_link'
        });
    }
    
    try {
        // Use provided created_by or create a default ObjectId
        const createdById = created_by || new mongoose.Types.ObjectId();
        
        // Create new project
        const newProject = new Project({
            name,
            description,
            repo_link,
            owner: owner || 'unknown',
            repo: repo || name,
            technology_stack: technology_stack || [],
            github_data: {
                stars: 0,
                forks: 0,
                language: 'Unknown'
            },
            analysis: {
                project_summary: {
                    title: name,
                    description: description
                }
            },
            last_analyzed: new Date(),
            created_by: createdById
        });
        
        const savedProject = await newProject.save();
        
        res.status(201).json({
            success: true,
            message: 'Project created successfully',
            project: {
                _id: savedProject._id,
                name: savedProject.name,
                description: savedProject.description,
                repo_link: savedProject.repo_link,
                owner: savedProject.owner,
                repo: savedProject.repo,
                technology_stack: savedProject.technology_stack,
                last_analyzed: savedProject.last_analyzed
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to create project',
            details: error.message
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

// Get all users
app.get('/users', async (req, res) => {
    try {
        const users = await User.find({});
        
        return res.json({
            success: true,
            users: users
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create a new user (for testing purposes)
app.post('/users', async (req, res) => {
    try {
        const { name, githubId, bio, tech_stack, email, avatar_url, github_profile } = req.body;

        // Basic validation
        if (!name || !githubId) {
            return res.status(400).json({
                success: false,
                error: 'Name and githubId are required'
            });
        }

        // Check if user already exists
        let user = await User.findOne({ githubId });
        
        if (user) {
            // Update existing user
            user.name = name;
            user.bio = bio || user.bio;
            user.tech_stack = tech_stack || user.tech_stack;
            user.email = email || user.email;
            user.avatar_url = avatar_url || user.avatar_url;
            user.github_profile = github_profile || user.github_profile;
            
            await user.save();
            
            return res.json({
                success: true,
                message: 'User updated successfully',
                data: user
            });
        } else {
            // Generate JWT token in the format test-token-<username>
            const jwtToken = `test-token-${githubId}`;
            
            // Create new user
            user = new User({
                name,
                githubId,
                bio: bio || '',
                tech_stack: tech_stack || [],
                email: email || '',
                avatar_url: avatar_url || '',
                github_profile: github_profile || '',
                jwtToken: jwtToken
            });

            await user.save();

            return res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: user
            });
        }

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// User login endpoint (simple login to get JWT)
app.post('/users/login', async (req, res) => {
    try {
        const { githubId, email } = req.body;

        if (!githubId && !email) {
            return res.status(400).json({
                success: false,
                error: 'Either githubId or email is required'
            });
        }

        // Find user by githubId or email
        const user = await User.findOne({
            $or: [
                { githubId: githubId },
                { email: email }
            ]
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Return the stored JWT token
        return res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    githubId: user.githubId,
                    email: user.email
                }
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

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

// Gamification endpoints
app.get('/users/:githubId/stats', getUserStats);
app.get('/leaderboard', getLeaderboard);

// Recommendations endpoint
app.get('/users/:githubId/recommendations', isAuthenticated, async (req, res) => {
    try {
        const { githubId } = req.params;
        
        // Find the user to get their ID
        const user = await User.findOne({ githubId });
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // Get recommendations using the recommendation service
        const recommendations = await getProjectRecommendations(user._id.toString());
        
        return res.json({
            success: true,
            ...recommendations
        });
        
    } catch (error) {
        console.error('Error getting recommendations:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get recommendations',
            details: error.message
        });
    }
});

// Project management endpoints
app.get('/projects', async (req, res) => {
    try {
        const projects = await Project.find({})
            .select('_id name description repo_link owner repo technology_stack last_analyzed')
            .sort({ last_analyzed: -1 });
        
        return res.json({
            success: true,
            projects: projects
        });
        
    } catch (error) {
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

// ==================== MENTOR MANAGEMENT ROUTES ====================

// Mentor authentication and management
app.post('/mentors/login', loginMentor);
app.post('/mentors', createMentor);
app.get('/mentors/:mentorId', getMentorById);
app.get('/mentors/email/:email', getMentorByEmail);
app.get('/mentors', getAllMentors);
app.put('/mentors/:mentorId', updateMentor);

// ==================== MENTOR REVIEW ROUTES ====================

// Review management
app.post('/projects/:projectId/reviews', createReview);
app.get('/projects/:projectId/reviews', getProjectReviews);
app.get('/reviews/:reviewId', getReviewById);
app.put('/reviews/:reviewId', updateReview);
app.delete('/reviews/:reviewId', deleteReview);
app.get('/mentors/:mentorId/reviews', getMentorReviews);

// Contribution request endpoints
app.post('/projects/:projectId/contribution-requests', isAuthenticated, sendContributionRequest);
app.get('/projects/:projectId/contribution-requests', isAuthenticated, getProjectContributionRequests);
app.put('/contribution-requests/:requestId/approve', isAuthenticated, approveContributionRequest);
app.put('/contribution-requests/:requestId/reject', isAuthenticated, rejectContributionRequest);
app.get('/contribution-requests/:requestId', isAuthenticated, getContributionRequest);

// Fix project ownership endpoint (for testing)
// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});