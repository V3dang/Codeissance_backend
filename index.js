import express from 'express';
import cors from 'cors';
import multer from 'multer';
import mongoose from 'mongoose';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { time } from 'console';

// Load environment variables
dotenv.config();

const app = express();

// Connect to MongoDB
const connectDB = async () => {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/codeissance';
        
        // Remove deprecated options
        await mongoose.connect(mongoUri);
        
        console.log('✅ MongoDB connected successfully');
        console.log('📍 Connected to:', mongoose.connection.name);
    } catch (error) {
        console.error('❌ MongoDB connection error:', error.message);
        console.error('💡 Make sure MongoDB is running on your system');
        console.error('🔧 Solutions:');
        console.error('   1. Install MongoDB from: https://www.mongodb.com/try/download/community');
        console.error('   2. Start MongoDB service');
        console.error('   3. Or use MongoDB Atlas (cloud): https://www.mongodb.com/atlas');
        // Don't exit in development, just log the error
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }
};

// Initialize MongoDB connection
connectDB();

// MongoDB connection event handlers
mongoose.connection.on('connected', () => {
    console.log('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️ Mongoose disconnected from MongoDB');
});

// Handle application termination
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('👋 Mongoose connection closed through app termination');
    process.exit(0);
});

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-here',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Passport configuration
app.use(passport.initialize());
app.use(passport.session());
app.use(cookieParser());

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true
}));
app.use(express.json());

// User Schema
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    githubId: {
        type: String,
        required: true,
        unique: true
    },
    bio: {
        type: String,
        trim: true,
        maxLength: 500,
        default: ''
    },
    tech_stack: [{
        type: String,
        trim: true
    }]
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// GitHub OAuth Strategy
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: process.env.GITHUB_CALLBACK_URL || "http://localhost:3000/auth/github/callback"
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user already exists with this GitHub ID
        let user = await User.findOne({ githubId: profile.id });
        
        if (user) {
            // User exists, update their info if needed
            if (profile.displayName && profile.displayName !== user.name) {
                user.name = profile.displayName;
            }
            if (profile.bio && profile.bio !== user.bio) {
                user.bio = profile.bio;
            }
            await user.save();
            return done(null, user);
        } else {
            // Create new user
            user = new User({
                githubId: profile.id,
                name: profile.displayName || profile.username || `User${profile.id}`,
                bio: profile._json.bio || '',
                tech_stack: []
            });
            
            await user.save();
            return done(null, user);
        }
    } catch (error) {
        return done(error, null);
    }
}));

// Passport serialization
passport.serializeUser((user, done) => {
    done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

// Project Schema
const projectSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxLength: 100
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxLength: 1000
    },
    repo_link: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                // Basic URL validation for repository links
                return /^https?:\/\/.+\..+/.test(v);
            },
            message: 'Please enter a valid repository URL'
        }
    },
    possible_modifications: [{
        type: String,
        trim: true
    }],
    // Additional useful fields
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['active', 'completed', 'on-hold', 'cancelled'],
        default: 'active'
    },
    tags: [{
        type: String,
        trim: true
    }],
    technology_stack: [{
        type: String,
        trim: true
    }]
}, { 
    timestamps: true,
    // Add index for better query performance
    indexes: [
        { name: 1 },
        { created_by: 1 },
        { status: 1 }
    ]
});

// Instance methods
projectSchema.methods.addModification = function(modification) {
    this.possible_modifications.push(modification);
    return this.save();
};

projectSchema.methods.removeModification = function(modification) {
    this.possible_modifications = this.possible_modifications.filter(
        mod => mod !== modification
    );
    return this.save();
};

// Static methods
projectSchema.statics.findByStatus = function(status) {
    return this.find({ status: status });
};

projectSchema.statics.findByUser = function(userId) {
    return this.find({ created_by: userId });
};

// Pre-save middleware to ensure repo_link starts with http/https
projectSchema.pre('save', function(next) {
    if (this.repo_link && !this.repo_link.startsWith('http')) {
        this.repo_link = 'https://' + this.repo_link;
    }
    next();
});

const Project = mongoose.model('Project', projectSchema);

// Middleware to check if user is authenticated
const isAuthenticated = (req, res, next) => {
    // Check session authentication first
    if (req.isAuthenticated()) {
        return next();
    }
    
    // Check for JWT token in cookies or Authorization header
    const token = req.cookies.token || 
                 (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
                  ? req.headers.authorization.split(' ')[1] 
                  : null);
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
            // Add user info to request object
            req.user = decoded;
            req.isJWTAuthenticated = true;
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
        message: 'Please provide a valid JWT token via Authorization header or login via GitHub OAuth'
    });
};

// Generate JWT token
const generateJWT = (user) => {
    return jwt.sign(
        { 
            _id: user._id, 
            githubId: user.githubId, 
            name: user.name 
        },
        process.env.JWT_SECRET || 'your-jwt-secret',
        { expiresIn: '7d' }
    );
};

app.get('/', (req, res) => {
    return res.json({ 
        message: 'Codeissance Backend API',
        authenticated: req.isAuthenticated(),
        user: req.user || null,
        githubLoginUrl: '/auth/github',
        environment: {
            hasGithubClientId: !!process.env.GITHUB_CLIENT_ID,
            hasGithubClientSecret: !!process.env.GITHUB_CLIENT_SECRET,
            callbackUrl: process.env.GITHUB_CALLBACK_URL,
            frontendUrl: process.env.FRONTEND_URL
        }
    });
});

// Authentication Routes
app.get('/auth/github', passport.authenticate('github', {
    scope: ['user:email', 'read:user']
}));

app.get('/auth/github/callback', 
    passport.authenticate('github', { failureRedirect: '/auth/failure' }),
    async (req, res) => {
        try {
            // Generate JWT token
            const token = generateJWT(req.user);
            
            // Set cookie
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
            
            // Redirect to frontend with success and user info
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
            const userParam = encodeURIComponent(JSON.stringify({
                id: req.user._id,
                name: req.user.name,
                githubId: req.user.githubId
            }));
            
            res.redirect(`${frontendUrl}/auth/success?token=${token}&user=${userParam}`);
        } catch (error) {
            console.error('Auth callback error:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
            res.redirect(`${frontendUrl}/auth/failure?error=${encodeURIComponent(error.message)}`);
        }
    }
);

app.get('/auth/failure', (req, res) => {
    res.status(401).json({ 
        error: 'Authentication failed',
        message: 'GitHub authentication was unsuccessful'
    });
});

app.get('/auth/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.clearCookie('token');
        res.json({ message: 'Logged out successfully' });
    });
});

// Get current user info
app.get('/auth/me', isAuthenticated, (req, res) => {
    res.json({
        user: req.user,
        authenticated: true
    });
});

// Check authentication status
app.get('/auth/status', (req, res) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
            res.json({ 
                authenticated: true, 
                user: decoded,
                token: token,
                tokenExpiry: new Date(decoded.exp * 1000)
            });
        } catch (error) {
            res.json({ 
                authenticated: false, 
                user: null,
                error: 'Invalid or expired token'
            });
        }
    } else if (req.isAuthenticated()) {
        res.json({ 
            authenticated: true, 
            user: req.user,
            authMethod: 'session'
        });
    } else {
        res.json({ 
            authenticated: false, 
            user: null 
        });
    }
});

// Manual JWT token generation endpoint (for testing)
app.post('/auth/generate-token', async (req, res) => {
    try {
        const { githubId } = req.body;
        
        if (!githubId) {
            return res.status(400).json({ error: 'githubId is required' });
        }
        
        // Find user by GitHub ID
        const user = await User.findOne({ githubId });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Generate JWT token
        const token = generateJWT(user);
        
        // Set cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });
        
        res.json({
            message: 'Token generated successfully',
            token: token,
            user: {
                _id: user._id,
                name: user.name,
                githubId: user.githubId,
                bio: user.bio,
                tech_stack: user.tech_stack
            },
            expiresIn: '7d'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Validate token endpoint
app.post('/auth/validate-token', (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({ error: 'Token is required' });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
        
        res.json({
            valid: true,
            user: decoded,
            expiresAt: new Date(decoded.exp * 1000),
            issuedAt: new Date(decoded.iat * 1000)
        });
    } catch (error) {
        res.status(401).json({
            valid: false,
            error: error.message
        });
    }
});

// User Routes
app.post('/users', async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        res.status(201).json({
            _id: user._id,
            name: user.name,
            githubId: user.githubId,
            bio: user.bio,
            tech_stack: user.tech_stack,
            createdAt: user.createdAt
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/users', async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user profile
app.put('/users/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all available user tech stacks
app.get('/users/tech-stacks/all', async (req, res) => {
    try {
        const techStacks = await User.distinct('tech_stack');
        const techCounts = await User.aggregate([
            { $unwind: '$tech_stack' },
            { $group: { _id: '$tech_stack', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        res.json({
            tech_stacks: techStacks.filter(tech => tech),
            techCounts: techCounts.filter(tech => tech._id)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get users by tech stack
app.get('/users/tech-stack/:tech', async (req, res) => {
    try {
        const { tech } = req.params;
        const { page = 1, limit = 10 } = req.query;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const users = await User.find({ tech_stack: { $in: [tech] } })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        const totalUsers = await User.countDocuments({ tech_stack: { $in: [tech] } });
        const totalPages = Math.ceil(totalUsers / parseInt(limit));
        
        res.json({
            tech_stack: tech,
            users,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalUsers,
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Find user by GitHub ID (useful for GitHub authentication)
app.get('/users/github/:githubId', async (req, res) => {
    try {
        const { githubId } = req.params;
        const user = await User.findOne({ githubId });
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Find or create user by GitHub ID (useful for GitHub authentication)
app.post('/users/github', async (req, res) => {
    try {
        const { githubId, name, bio, tech_stack } = req.body;
        
        // First try to find existing user
        let user = await User.findOne({ githubId });
        
        if (user) {
            // User exists, optionally update their info
            if (name) user.name = name;
            if (bio) user.bio = bio;
            if (tech_stack) user.tech_stack = tech_stack;
            await user.save();
            
            return res.json({
                message: 'User found and updated',
                user: user,
                isNew: false
            });
        } else {
            // Create new user
            user = new User({
                githubId,
                name: name || `User${githubId}`,
                bio: bio || '',
                tech_stack: tech_stack || []
            });
            
            await user.save();
            
            return res.status(201).json({
                message: 'New user created',
                user: user,
                isNew: true
            });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Project Routes
// Create project (authenticated users only)
app.post('/projects', isAuthenticated, async (req, res) => {
    try {
        const { name, description, repo_link, possible_modifications, tags, technology_stack } = req.body;
        
        // Get user ID from authenticated session/token
        const userId = req.user._id || req.user.id;
        
        const project = new Project({
            name,
            description,
            repo_link,
            possible_modifications: possible_modifications || [],
            tags: tags || [],
            technology_stack: technology_stack || [],
            created_by: userId
        });
        
        await project.save();
        
        // Populate the created_by field before sending response
        await project.populate('created_by', 'name githubId bio tech_stack');
        
        res.status(201).json(project);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Alternative: Create project with explicit user ID (for backwards compatibility)
app.post('/projects/with-user', async (req, res) => {
    try {
        const { name, description, repo_link, possible_modifications, tags, technology_stack, created_by } = req.body;
        
        // Validate that the user exists
        if (!created_by) {
            return res.status(400).json({ error: 'created_by (user ID) is required' });
        }
        
        const user = await User.findById(created_by);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const project = new Project({
            name,
            description,
            repo_link,
            possible_modifications: possible_modifications || [],
            tags: tags || [],
            technology_stack: technology_stack || [],
            created_by
        });
        
        await project.save();
        
        // Populate the created_by field before sending response
        await project.populate('created_by', 'name githubId bio tech_stack');
        
        res.status(201).json(project);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Create project for a specific user (alternative endpoint)
app.post('/users/:userId/projects', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Validate that the user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const project = new Project({
            ...req.body,
            created_by: userId
        });
        
        await project.save();
        await project.populate('created_by', 'name githubId bio tech_stack');
        
        res.status(201).json(project);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/projects', async (req, res) => {
    try {
        const { 
            search, 
            tags, 
            status, 
            technology_stack, 
            page = 1, 
            limit = 10,
            sort = 'createdAt',
            order = 'desc'
        } = req.query;

        // Build query object
        let query = {};

        // Text search in name and description
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ];
        }

        // Filter by tags (can be comma-separated)
        if (tags) {
            const tagArray = tags.split(',').map(tag => tag.trim());
            query.tags = { $in: tagArray };
        }

        // Filter by status
        if (status) {
            query.status = status;
        }

        // Filter by technology stack (can be comma-separated)
        if (technology_stack) {
            const techArray = technology_stack.split(',').map(tech => tech.trim());
            query.technology_stack = { $in: techArray };
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build sort object
        const sortObj = {};
        sortObj[sort] = order === 'desc' ? -1 : 1;

        // Execute query with pagination and sorting
        const projects = await Project.find(query)
            .populate('created_by', 'name githubId bio tech_stack')
            .sort(sortObj)
            .skip(skip)
            .limit(parseInt(limit));

        // Get total count for pagination info
        const totalProjects = await Project.countDocuments(query);
        const totalPages = Math.ceil(totalProjects / parseInt(limit));

        res.json({
            projects,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalProjects,
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1
            },
            filters: {
                search,
                tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
                status,
                technology_stack: technology_stack ? technology_stack.split(',').map(tech => tech.trim()) : []
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/projects/:id', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id).populate('created_by', 'name githubId bio tech_stack');
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json(project);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all projects by a specific user
app.get('/users/:userId/projects', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Validate that the user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const projects = await Project.find({ created_by: userId })
            .populate('created_by', 'name githubId bio tech_stack')
            .sort({ createdAt: -1 }); // Sort by newest first
        
        res.json({
            user: {
                _id: user._id,
                name: user.name,
                githubId: user.githubId
            },
            projects: projects,
            totalProjects: projects.length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/projects/:id', async (req, res) => {
    try {
        const project = await Project.findByIdAndUpdate(
            req.params.id, 
            req.body, 
            { new: true, runValidators: true }
        );
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json(project);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/projects/:id', async (req, res) => {
    try {
        const project = await Project.findByIdAndDelete(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add modification to project
app.post('/projects/:id/modifications', async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({ error: 'Project not found' });
        }
        
        await project.addModification(req.body.modification);
        res.json(project);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get all available tags
app.get('/projects/tags/all', async (req, res) => {
    try {
        const tags = await Project.distinct('tags');
        const tagCounts = await Project.aggregate([
            { $unwind: '$tags' },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        res.json({
            tags: tags.filter(tag => tag), // Remove empty tags
            tagCounts: tagCounts.filter(tag => tag._id) // Remove empty tags
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all available technology stacks
app.get('/projects/tech-stack/all', async (req, res) => {
    try {
        const techStacks = await Project.distinct('technology_stack');
        const techCounts = await Project.aggregate([
            { $unwind: '$technology_stack' },
            { $group: { _id: '$technology_stack', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        
        res.json({
            technology_stacks: techStacks.filter(tech => tech),
            technologyCounts: techCounts.filter(tech => tech._id)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get projects by specific tag
app.get('/projects/tags/:tag', async (req, res) => {
    try {
        const { tag } = req.params;
        const { page = 1, limit = 10 } = req.query;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const projects = await Project.find({ tags: { $in: [tag] } })
            .populate('created_by', 'name githubId bio tech_stack')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        const totalProjects = await Project.countDocuments({ tags: { $in: [tag] } });
        const totalPages = Math.ceil(totalProjects / parseInt(limit));
        
        res.json({
            tag,
            projects,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalProjects,
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Search projects (dedicated search endpoint)
app.get('/projects/search/:searchTerm', async (req, res) => {
    try {
        const { searchTerm } = req.params;
        const { page = 1, limit = 10 } = req.query;
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        
        const projects = await Project.find({
            $or: [
                { name: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } },
                { tags: { $in: [new RegExp(searchTerm, 'i')] } },
                { technology_stack: { $in: [new RegExp(searchTerm, 'i')] } }
            ]
        })
        .populate('created_by', 'name githubId bio tech_stack')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit));
        
        const totalProjects = await Project.countDocuments({
            $or: [
                { name: { $regex: searchTerm, $options: 'i' } },
                { description: { $regex: searchTerm, $options: 'i' } },
                { tags: { $in: [new RegExp(searchTerm, 'i')] } },
                { technology_stack: { $in: [new RegExp(searchTerm, 'i')] } }
            ]
        });
        const totalPages = Math.ceil(totalProjects / parseInt(limit));
        
        res.json({
            searchTerm,
            projects,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalProjects,
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/upload', multer().single('pdf'), (req, res) => {
    return res.json({message: 'Received'});
});

app.listen(3000, () => console.log('Server running on port 3000'));