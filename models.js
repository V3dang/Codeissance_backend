import mongoose from 'mongoose';

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
    }],
    email: {
        type: String,
        trim: true,
        lowercase: true
    },
    avatar_url: {
        type: String,
        trim: true
    },
    github_profile: {
        type: String,
        trim: true
    },
    contributionPoints: {
        type: Number,
        default: 0
    },
    title: {
        type: String,
        default: 'Newbie'
    },
    jwtToken: {
        type: String,
        unique: true
    }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

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
                return /^https?:\/\/.+\..+/.test(v);
            },
            message: 'Please enter a valid repository URL'
        }
    },
    owner: {
        type: String,
        required: true,
        trim: true
    },
    repo: {
        type: String,
        required: true,
        trim: true
    },
    // GitHub metadata
    github_data: {
        stars: { type: Number, default: 0 },
        forks: { type: Number, default: 0 },
        watchers: { type: Number, default: 0 },
        language: { type: String, trim: true },
        topics: [{ type: String, trim: true }],
        size: { type: Number, default: 0 },
        open_issues: { type: Number, default: 0 },
        license: { type: String, trim: true },
        created_at: { type: Date },
        updated_at: { type: Date }
    },
    // AI Analysis data
    analysis: {
        project_summary: {
            title: String,
            description: String,
            main_purpose: String,
            target_audience: String
        },
        health_report: {
            overall_health: { type: String, enum: ['Excellent', 'Good', 'Fair', 'Poor'] },
            completeness: String,
            activity_level: { type: String, enum: ['High', 'Medium', 'Low'] },
            community_engagement: String,
            potential_issues: [String],
            missing_components: [String]
        },
        roadmap: {
            next_steps: [String],
            improvements: [String],
            features: [String],
            priorities: [String]
        },
        pitch_deck: {
            problem_solved: String,
            solution: String,
            tech_stack: [String],
            unique_value: String,
            impact: String,
            market_potential: String,
            current_state: String,
            future_vision: String
        }
    },
    // Recent commits and issues
    recent_commits: [{
        sha: String,
        message: String,
        author: String,
        date: Date,
        url: String
    }],
    recent_issues: [{
        number: Number,
        title: String,
        body: String,
        labels: [String],
        created_at: Date,
        user: String,
        url: String
    }],
    // Project metadata
    status: {
        type: String,
        enum: ['active', 'completed', 'on-hold', 'cancelled'],
        default: 'active'
    },
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    technology_stack: [{
        type: String,
        trim: true
    }],
    possible_modifications: [{
        type: String,
        trim: true
    }],
    readme_length: {
        type: Number,
        default: 0
    },
    last_analyzed: {
        type: Date,
        default: Date.now
    },
    // User who created/analyzed this project
    created_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

// Add indexes for better query performance
projectSchema.index({ owner: 1, repo: 1 });
projectSchema.index({ 'github_data.language': 1 });
projectSchema.index({ status: 1 });
projectSchema.index({ created_by: 1 });
projectSchema.index({ last_analyzed: 1 });

const Project = mongoose.model('Project', projectSchema);

// Mentor Schema
const mentorSchema = new mongoose.Schema({
    // Basic Information
    name: {
        type: String,
        required: true,
        trim: true,
        maxLength: 100
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        validate: {
            validator: function(v) {
                return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
            },
            message: 'Please enter a valid email address'
        }
    },
    bio: {
        type: String,
        trim: true,
        maxLength: 500,
        default: ''
    },
    avatar_url: {
        type: String,
        trim: true
    },
    
    // Professional Information
    title: {
        type: String,
        required: true,
        trim: true,
        maxLength: 100
    },
    years_of_experience: {
        type: Number,
        required: true,
        min: 0,
        max: 50
    },
    expertise_areas: [{
        type: String,
        trim: true
    }],
    tech_stack: [{
        type: String,
        trim: true
    }],
    
    // Funding Information
    funding_capacity: {
        can_provide_funding: {
            type: Boolean,
            default: false
        },
        funding_range: {
            min: { type: Number, default: 0 },
            max: { type: Number, default: 0 }
        }
    },
    
    // Professional Links
    links: {
        linkedin: { type: String, trim: true },
        website: { type: String, trim: true },
        company_website: { type: String, trim: true }
    },
    
    // Ratings and Reviews
    ratings: {
        overall_rating: {
            type: Number,
            min: 0,
            max: 5,
            default: 0
        },
        total_reviews: {
            type: Number,
            default: 0
        }
    },
    
    // Status
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    }
}, { timestamps: true });

// Add indexes for better query performance
mentorSchema.index({ email: 1 });
mentorSchema.index({ expertise_areas: 1 });
mentorSchema.index({ status: 1 });
mentorSchema.index({ 'ratings.overall_rating': 1 });

const Mentor = mongoose.model('Mentor', mentorSchema);

// Review Schema (for mentor reviews on projects)
const reviewSchema = new mongoose.Schema({
    mentor_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mentor',
        required: true
    },
    project_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    
    // Review Content
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxLength: 100
    },
    feedback: {
        type: String,
        required: true,
        trim: true,
        maxLength: 2000
    },
    suggestions: {
        type: String,
        trim: true,
        maxLength: 1000,
        default: ''
    },
    
    // Categories of feedback
    strengths: [{
        type: String,
        trim: true
    }],
    improvements: [{
        type: String,
        trim: true
    }],
    
    // Funding interest (optional)
    funding_interest: {
        interested: {
            type: Boolean,
            default: false
        },
        potential_amount: {
            type: Number,
            min: 0
        },
        notes: {
            type: String,
            trim: true,
            maxLength: 500
        }
    }
}, { timestamps: true });

// Add indexes for better query performance
reviewSchema.index({ mentor_id: 1 });
reviewSchema.index({ project_id: 1 });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ createdAt: -1 });

const Review = mongoose.model('Review', reviewSchema);

// Contribution Request Schema
const contributionRequestSchema = new mongoose.Schema({
    project_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    requester_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    project_owner_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxLength: 1000
    },
    approved: {
        type: Boolean,
        default: false
    },
    owner_response: {
        type: String,
        trim: true,
        maxLength: 500,
        default: ''
    }
}, { timestamps: true });

// Add indexes
contributionRequestSchema.index({ project_id: 1 });
contributionRequestSchema.index({ requester_id: 1 });
contributionRequestSchema.index({ project_owner_id: 1 });
contributionRequestSchema.index({ approved: 1 });
contributionRequestSchema.index({ createdAt: -1 });

const ContributionRequest = mongoose.model('ContributionRequest', contributionRequestSchema);

export { User, Project, Mentor, Review, ContributionRequest };