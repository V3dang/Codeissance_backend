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

export { User, Project };