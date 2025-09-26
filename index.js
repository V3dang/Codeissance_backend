import express from 'express';
import axios from 'axios';
import cors from 'cors';
import multer from 'multer';
import { GoogleGenAI } from "@google/genai";
import { Octokit } from "@octokit/rest";
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const ai = new GoogleGenAI({});
const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
    request: {
        timeout: 20000, // 20 second timeout
        retries: 2,     // Retry failed requests
    },
});

// Simple in-memory cache
const cache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Cache helper functions
const getCacheKey = (owner, repo) => `${owner}/${repo}`;
const getCachedData = (key) => {
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.data;
    }
    cache.delete(key);
    return null;
};
const setCachedData = (key, data) => {
    cache.set(key, { data, timestamp: Date.now() });
};

app.use(cors());
app.use(express.json());

// Request timeout middleware
app.use((req, res, next) => {
    req.setTimeout(45000); // 45 second request timeout
    next();
});

// Utility function to extract owner and repo from GitHub URL
const extractRepoInfo = (repoUrl) => {
    const regex = /github\.com\/([^\/]+)\/([^\/]+)/;
    const match = repoUrl.match(regex);
    if (!match) {
        throw new Error('Invalid GitHub URL format');
    }
    return { owner: match[1], repo: match[2] };
};

// Function to fetch repository metadata
const fetchRepoData = async (owner, repo) => {
    try {
        const { data } = await octokit.rest.repos.get({
            owner,
            repo,
        });
        
        return {
            name: data.name,
            description: data.description,
            stars: data.stargazers_count,
            forks: data.forks_count,
            watchers: data.watchers_count,
            language: data.language,
            topics: data.topics,
            created_at: data.created_at,
            updated_at: data.updated_at,
            size: data.size,
            open_issues: data.open_issues_count,
            license: data.license?.name,
            default_branch: data.default_branch,
        };
    } catch (error) {
        throw new Error(`Failed to fetch repository data: ${error.message}`);
    }
};

// Function to fetch latest commits
const fetchLatestCommits = async (owner, repo, limit = 5) => {
    try {
        const { data } = await octokit.rest.repos.listCommits({
            owner,
            repo,
            per_page: limit,
        });
        
        return data.map(commit => ({
            sha: commit.sha.substring(0, 7),
            message: commit.commit.message,
            author: commit.commit.author.name,
            date: commit.commit.author.date,
            url: commit.html_url,
        }));
    } catch (error) {
        throw new Error(`Failed to fetch commits: ${error.message}`);
    }
};

// Function to fetch open issues
const fetchOpenIssues = async (owner, repo, limit = 5) => {
    try {
        const { data } = await octokit.rest.issues.listForRepo({
            owner,
            repo,
            state: 'open',
            per_page: limit,
        });
        
        return data.map(issue => ({
            number: issue.number,
            title: issue.title,
            body: issue.body?.substring(0, 200) + (issue.body?.length > 200 ? '...' : ''),
            labels: issue.labels.map(label => label.name),
            created_at: issue.created_at,
            user: issue.user.login,
            url: issue.html_url,
        }));
    } catch (error) {
        throw new Error(`Failed to fetch issues: ${error.message}`);
    }
};

// Function to fetch README content
const fetchReadme = async (owner, repo) => {
    try {
        const { data } = await octokit.rest.repos.getReadme({
            owner,
            repo,
        });
        
        // Decode base64 content
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return content;
    } catch (error) {
        console.warn(`README not found: ${error.message}`);
        return 'No README file found';
    }
};

// Function to generate AI insights using Gemini (optimized for speed)
const generateAiInsights = async (repoData, commits, issues, readme) => {
    try {
        // Shortened prompt for faster response
        const prompt = `Analyze GitHub repo "${repoData.name}" (${repoData.language}) with ${repoData.stars} stars, ${repoData.forks} forks.
Description: ${repoData.description || 'No description'}
${commits.length} recent commits, ${issues.length} open issues
README: ${readme.substring(0, 1000)}

Return ONLY this JSON structure:
{"projectSummary":{"title":"${repoData.name}","description":"Brief 1-sentence description","mainPurpose":"Main purpose","targetAudience":"Target users"},"healthReport":{"overallHealth":"Good/Fair/Poor","completeness":"Complete/Partial/Basic","activityLevel":"High/Medium/Low","communityEngagement":"Active/Moderate/Low","potentialIssues":["Issue 1","Issue 2"],"missingComponents":["Missing 1"]},"roadmap":{"nextSteps":["Step 1","Step 2","Step 3"],"improvements":["Improvement 1"],"features":["Feature 1"],"priorities":["Priority 1"]},"pitchDeck":{"problemSolved":"Problem solved","solution":"How it solves","techStack":["${repoData.language || 'Unknown'}"],"uniqueValue":"Unique value","impact":"Impact","marketPotential":"Market","currentState":"Current state","futureVision":"Future vision"}}`;
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        
        // Try to parse the JSON response
        try {
            const cleanedResponse = response.text.replace(/```json|```/g, '').trim();
            return JSON.parse(cleanedResponse);
        } catch (parseError) {
            // Quick fallback without AI if parsing fails
            return {
                projectSummary: { 
                    title: repoData.name, 
                    description: repoData.description || "GitHub repository",
                    mainPurpose: `${repoData.language} development project`,
                    targetAudience: "Developers"
                },
                healthReport: { 
                    overallHealth: repoData.stars > 100 ? "Good" : "Fair", 
                    completeness: "Unable to assess quickly",
                    activityLevel: commits.length > 3 ? "High" : "Medium",
                    communityEngagement: `${repoData.stars} stars indicates ${repoData.stars > 500 ? 'high' : 'moderate'} engagement`,
                    potentialIssues: [`${issues.length} open issues to resolve`],
                    missingComponents: ["Full analysis requires manual review"]
                },
                roadmap: { 
                    nextSteps: ["Review recent commits", "Address open issues", "Update documentation"], 
                    improvements: ["Code optimization", "Better documentation"], 
                    features: ["Community requested features"], 
                    priorities: ["Bug fixes", "Performance improvements"] 
                },
                pitchDeck: { 
                    problemSolved: repoData.description || "See repository for details", 
                    solution: `${repoData.language} based solution`,
                    techStack: [repoData.language || "Multiple technologies"],
                    uniqueValue: `${repoData.stars} developers find this valuable`,
                    impact: `Serves ${repoData.forks} forks and ${repoData.watchers} watchers`,
                    marketPotential: "Open source developer community",
                    currentState: "Active development",
                    futureVision: "Continued community growth"
                }
            };
        }
    } catch (error) {
        throw new Error(`Failed to generate AI insights: ${error.message}`);
    }
};

// Routes
app.get('/', (req, res) => {
    return res.json({ 
        message: 'GitHub Repository Analyzer API',
        endpoints: {
            analyze: '/analyze/:owner/:repo',
            analyzeByUrl: '/analyze-url'
        }
    });
});

// Main analysis route using owner/repo parameters
app.get('/analyze/:owner/:repo', async (req, res) => {
    const { owner, repo } = req.params;
    const cacheKey = getCacheKey(owner, repo);
    
    try {
        // Check cache first
        const cachedResult = getCachedData(cacheKey);
        if (cachedResult) {
            console.log(`✅ Returning cached result for: ${owner}/${repo}`);
            return res.json({
                ...cachedResult,
                cached: true,
                cacheAge: Math.floor((Date.now() - cachedResult.timestamp) / 1000) + 's ago'
            });
        }
        
        console.log(`🔍 Analyzing repository: ${owner}/${repo}`);
        
        // Fetch all repository data with individual error handling
        const dataPromises = [
            fetchRepoData(owner, repo).catch(err => ({ error: `Repo data: ${err.message}` })),
            fetchLatestCommits(owner, repo, 3).catch(err => ({ error: `Commits: ${err.message}` })),
            fetchOpenIssues(owner, repo, 3).catch(err => ({ error: `Issues: ${err.message}` })),
            fetchReadme(owner, repo).catch(err => 'README fetch failed')
        ];
        
        const [repoData, commits, issues, readme] = await Promise.all(dataPromises);
        
        // Check if critical data (repo info) failed
        if (repoData.error) {
            throw new Error(`Failed to fetch repository: ${repoData.error}`);
        }
        
        console.log('✅ Repository data fetched successfully');
        
        // Generate AI insights
        const aiInsights = await generateAiInsights(
            repoData, 
            commits.error ? [] : commits, 
            issues.error ? [] : issues, 
            typeof readme === 'string' ? readme : 'No README available'
        );
        
        console.log('✅ AI insights generated successfully');
        
        // Prepare response
        const result = {
            success: true,
            repository: {
                owner,
                repo,
                url: `https://github.com/${owner}/${repo}`
            },
            metadata: repoData,
            commits: commits.error ? [] : commits,
            issues: issues.error ? [] : issues,
            readmeLength: typeof readme === 'string' ? readme.length : 0,
            analysis: aiInsights,
            generatedAt: new Date().toISOString(),
            cached: false,
            warnings: [
                ...(commits.error ? [`Commits: ${commits.error}`] : []),
                ...(issues.error ? [`Issues: ${issues.error}`] : []),
                ...(typeof readme !== 'string' ? ['README could not be fetched'] : [])
            ]
        };
        
        // Cache the result
        setCachedData(cacheKey, result);
        
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

// Alternative route that accepts GitHub URL in request body
app.post('/analyze-url', async (req, res) => {
    const { repoUrl } = req.body;
    
    if (!repoUrl) {
        return res.status(400).json({
            success: false,
            error: 'Repository URL is required in request body'
        });
    }
    
    try {
        const { owner, repo } = extractRepoInfo(repoUrl);
        const cacheKey = getCacheKey(owner, repo);
        
        // Check cache first
        const cachedResult = getCachedData(cacheKey);
        if (cachedResult) {
            console.log(`✅ Returning cached result for URL: ${repoUrl}`);
            return res.json({
                ...cachedResult,
                repository: { ...cachedResult.repository, url: repoUrl },
                cached: true
            });
        }
        
        console.log(`🔍 Analyzing repository from URL: ${repoUrl} -> ${owner}/${repo}`);
        
        // Fetch all repository data with error handling
        const dataPromises = [
            fetchRepoData(owner, repo).catch(err => ({ error: `Repo data: ${err.message}` })),
            fetchLatestCommits(owner, repo, 3).catch(err => ({ error: `Commits: ${err.message}` })),
            fetchOpenIssues(owner, repo, 3).catch(err => ({ error: `Issues: ${err.message}` })),
            fetchReadme(owner, repo).catch(err => 'README fetch failed')
        ];
        
        const [repoData, commits, issues, readme] = await Promise.all(dataPromises);
        
        // Check if critical data failed
        if (repoData.error) {
            throw new Error(`Failed to fetch repository: ${repoData.error}`);
        }
        
        console.log('✅ Repository data fetched successfully');
        
        // Generate AI insights
        const aiInsights = await generateAiInsights(
            repoData, 
            commits.error ? [] : commits, 
            issues.error ? [] : issues, 
            typeof readme === 'string' ? readme : 'No README available'
        );
        
        console.log('✅ AI insights generated successfully');
        
        // Prepare response
        const result = {
            success: true,
            repository: {
                owner,
                repo,
                url: repoUrl
            },
            metadata: repoData,
            commits: commits.error ? [] : commits,
            issues: issues.error ? [] : issues,
            readmeLength: typeof readme === 'string' ? readme.length : 0,
            analysis: aiInsights,
            generatedAt: new Date().toISOString(),
            cached: false,
            warnings: [
                ...(commits.error ? [`Commits: ${commits.error}`] : []),
                ...(issues.error ? [`Issues: ${issues.error}`] : []),
                ...(typeof readme !== 'string' ? ['README could not be fetched'] : [])
            ]
        };
        
        // Cache the result
        setCachedData(cacheKey, result);
        
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
    console.log(`🚀 GitHub Repository Analyzer API running on port ${port}`);
    console.log(`📝 Endpoints:`);
    console.log(`   GET  /analyze/:owner/:repo`);
    console.log(`   POST /analyze-url (with JSON body: {"repoUrl": "..."})`);
    console.log(`🔧 Make sure to set GITHUB_TOKEN and GOOGLE_AI_API_KEY in .env file`);
});