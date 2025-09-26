import { Octokit } from "@octokit/rest";
import { execSync, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
    request: {
        timeout: 30000,
        retries: 2,
    },
});

// import { execSync, spawn } from 'child_process';
// import fs from 'fs/promises';
// import path from 'path';
// import { v4 as uuidv4 } from 'uuid';
import net from 'net';

// Port range for dynamic allocation
const PORT_RANGE_START = 3001;
const PORT_RANGE_END = 9000;

// Find available port
const findAvailablePort = async (startPort = PORT_RANGE_START) => {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        
        server.on('error', async (err) => {
            if (err.code === 'EADDRINUSE') {
                if (startPort < PORT_RANGE_END) {
                    try {
                        const nextPort = await findAvailablePort(startPort + 1);
                        resolve(nextPort);
                    } catch (error) {
                        reject(error);
                    }
                } else {
                    reject(new Error('No available ports in range'));
                }
            } else {
                reject(err);
            }
        });
    });
};

// Project type configurations
const PROJECT_CONFIGS = {
    'react': {
        dockerfile: `
# Multi-stage build for Vite + React
FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm cache clean --force
COPY . .
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
        `,
        buildCommand: 'npm ci && npm run build',
        startCommand: 'nginx -g "daemon off;"',
        port: 80,
        healthCheck: '/'
    },
    'nextjs': {
        dockerfile: `
# Multi-stage build for Next.js
FROM node:20-alpine as builder
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm cache clean --force
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
EXPOSE 3000
CMD ["npm", "start"]
        `,
        buildCommand: 'npm ci && npm run build',
        startCommand: 'npm start',
        port: 3000,
        healthCheck: '/'
    },
    'vue': {
        dockerfile: `
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8080
CMD ["npm", "run", "serve"]
        `,
        buildCommand: 'npm install',
        startCommand: 'npm run serve',
        port: 8080,
        healthCheck: '/'
    },
    'nodejs': {
        dockerfile: `
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8000
CMD ["node", "index.js"]
        `,
        buildCommand: 'npm install',
        startCommand: 'node index.js',
        port: 8000,
        healthCheck: '/health'
    },
    'python': {
        dockerfile: `
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "app.py"]
        `,
        buildCommand: 'pip install -r requirements.txt',
        startCommand: 'python app.py',
        port: 8000,
        healthCheck: '/health'
    },
    'flask': {
        dockerfile: `
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
ENV FLASK_APP=app.py
CMD ["flask", "run", "--host=0.0.0.0"]
        `,
        buildCommand: 'pip install -r requirements.txt',
        startCommand: 'flask run --host=0.0.0.0',
        port: 5000,
        healthCheck: '/'
    },
    'static': {
        dockerfile: `
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
        `,
        buildCommand: 'echo "Static site - no build needed"',
        startCommand: 'nginx -g "daemon off;"',
        port: 80,
        healthCheck: '/'
    }
};

// Detect project type based on files
const detectProjectType = (files) => {
    const fileNames = files.map(file => file.name.toLowerCase());
    
    // Check for Vite config files first
    const hasViteConfig = fileNames.some(name => 
        name === 'vite.config.js' || 
        name === 'vite.config.ts' || 
        name === 'vite.config.mjs'
    );
    
    // Check for specific frameworks/technologies
    if (fileNames.includes('package.json')) {
        const packageJsonFile = files.find(f => f.name.toLowerCase() === 'package.json');
        if (packageJsonFile && packageJsonFile.content) {
            try {
                const packageJson = JSON.parse(packageJsonFile.content);
                const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
                
                if (dependencies.next || dependencies['@next/core']) return 'nextjs';
                // Prioritize Vite + React projects
                if (hasViteConfig && (dependencies.react || dependencies['react-dom'])) return 'react';
                if (dependencies.vite && (dependencies.react || dependencies['react-dom'])) return 'react';
                if (dependencies.vue || dependencies['@vue/cli']) return 'vue';
                if (dependencies.express || dependencies.fastify) return 'nodejs';
            } catch (error) {
                console.warn('Could not parse package.json');
            }
        }
        return 'nodejs'; // Default for Node.js projects
    }
    
    if (fileNames.includes('requirements.txt') || fileNames.some(f => f.endsWith('.py'))) {
        if (fileNames.includes('app.py') && files.find(f => f.name === 'app.py' && f.content.includes('flask'))) {
            return 'flask';
        }
        return 'python';
    }
    
    if (fileNames.includes('index.html')) {
        return 'static';
    }
    
    return 'static'; // Default fallback
};

// Fetch repository files
export const fetchRepositoryFiles = async (owner, repo, path = '') => {
    try {
        console.log(`📁 Fetching files from ${owner}/${repo}${path ? `/${path}` : ''}`);
        
        const { data: contents } = await octokit.rest.repos.getContent({
            owner,
            repo,
            path: path
        });
        
        const files = [];
        
        for (const item of Array.isArray(contents) ? contents : [contents]) {
            if (item.type === 'file') {
                // Fetch file content
                const { data: fileData } = await octokit.rest.repos.getContent({
                    owner,
                    repo,
                    path: item.path
                });
                
                files.push({
                    name: item.name,
                    path: item.path,
                    content: Buffer.from(fileData.content, 'base64').toString('utf-8'),
                    size: item.size,
                    type: 'file'
                });
            } else if (item.type === 'dir' && item.name !== '.git' && item.name !== 'node_modules') {
                // Recursively fetch directory contents (limit depth to avoid infinite recursion)
                const nestedFiles = await fetchRepositoryFiles(owner, repo, item.path);
                files.push(...nestedFiles);
            }
        }
        
        return files;
    } catch (error) {
        throw new Error(`Failed to fetch repository files: ${error.message}`);
    }
};

// Create project workspace
const createProjectWorkspace = async (projectId, files) => {
    const workspaceDir = path.join(process.cwd(), 'previews', projectId);
    
    try {
        // Create workspace directory
        await fs.mkdir(workspaceDir, { recursive: true });
        
        // Write all files to workspace
        for (const file of files) {
            const filePath = path.join(workspaceDir, file.path);
            const fileDir = path.dirname(filePath);
            
            // Create directory if it doesn't exist
            await fs.mkdir(fileDir, { recursive: true });
            
            // Write file content
            await fs.writeFile(filePath, file.content, 'utf-8');
        }
        
        return workspaceDir;
    } catch (error) {
        throw new Error(`Failed to create workspace: ${error.message}`);
    }
};

// Generate Dockerfile
const generateDockerfile = async (workspaceDir, projectType, customConfig = {}) => {
    const config = { ...PROJECT_CONFIGS[projectType], ...customConfig };
    const dockerfilePath = path.join(workspaceDir, 'Dockerfile');
    
    await fs.writeFile(dockerfilePath, config.dockerfile.trim(), 'utf-8');
    
    return config;
};

// Build Docker image
const buildDockerImage = async (workspaceDir, imageName) => {
    return new Promise((resolve, reject) => {
        console.log(`🏗️ Building Docker image: ${imageName}`);
        
        const buildProcess = spawn('docker', ['build', '-t', imageName, '.'], {
            cwd: workspaceDir,
            stdio: ['pipe', 'pipe', 'pipe']
        });
        
        let output = '';
        let error = '';
        
        buildProcess.stdout.on('data', (data) => {
            output += data.toString();
            console.log(data.toString());
        });
        
        buildProcess.stderr.on('data', (data) => {
            error += data.toString();
            console.error(data.toString());
        });
        
        buildProcess.on('close', (code) => {
            if (code === 0) {
                console.log(`✅ Docker image built successfully: ${imageName}`);
                resolve({ success: true, output });
            } else {
                console.error(`❌ Docker build failed with code ${code}`);
                reject(new Error(`Docker build failed: ${error}`));
            }
        });
    });
};

// Run Docker container with dynamic port allocation
const runDockerContainer = async (imageName, containerName, defaultPort) => {
    // Find available port
    const availablePort = await findAvailablePort(defaultPort || PORT_RANGE_START);
    
    return new Promise((resolve, reject) => {
        console.log(`🚀 Starting container: ${containerName} on port ${availablePort} (internal: ${defaultPort || 80})`);
        
        const runProcess = spawn('docker', [
            'run', '-d', '--name', containerName,
            '-p', `${availablePort}:${defaultPort || 80}`,
            '--rm', // Auto-remove when stopped
            imageName
        ]);
        
        let output = '';
        let error = '';
        
        runProcess.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        runProcess.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        runProcess.on('close', (code) => {
            if (code === 0) {
                const containerId = output.trim();
                console.log(`✅ Container started: ${containerId} on port ${availablePort}`);
                resolve({ 
                    success: true, 
                    containerId,
                    url: `http://localhost:${availablePort}`,
                    port: availablePort
                });
            } else {
                console.error(`❌ Container failed to start: ${error}`);
                reject(new Error(`Container start failed: ${error}`));
            }
        });
    });
};

// Check container health
const checkContainerHealth = async (containerId, port, healthPath = '/') => {
    const maxRetries = 30;
    const retryDelay = 2000;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(`http://localhost:${port}${healthPath}`);
            if (response.ok) {
                return { healthy: true, url: `http://localhost:${port}` };
            }
        } catch (error) {
            // Container might still be starting
        }
        
        await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    
    return { healthy: false, error: 'Health check timeout' };
};

// Clean up old containers on the same port
const cleanupPortConflicts = async (port) => {
    try {
        // Find containers using this port
        const result = execSync(`docker ps --format "{{.Names}} {{.Ports}}"`, { encoding: 'utf-8' });
        const lines = result.split('\n').filter(line => line.includes(`:${port}->`));
        
        for (const line of lines) {
            const containerName = line.split(' ')[0];
            console.log(`🧹 Stopping conflicting container: ${containerName}`);
            execSync(`docker stop ${containerName}`, { stdio: 'ignore' });
        }
    } catch (error) {
        // Ignore errors - containers might not exist
    }
};

// Stop and cleanup container
export const stopPreview = async (projectId) => {
    try {
        const containerName = `preview-${projectId}`;
        
        // Stop container
        execSync(`docker stop ${containerName}`, { stdio: 'ignore' });
        
        // Remove image
        execSync(`docker rmi preview-${projectId}`, { stdio: 'ignore' });
        
        // Cleanup workspace
        const workspaceDir = path.join(process.cwd(), 'previews', projectId);
        await fs.rm(workspaceDir, { recursive: true, force: true });
        
        return { success: true, message: 'Preview stopped and cleaned up' };
    } catch (error) {
        throw new Error(`Failed to stop preview: ${error.message}`);
    }
};

// Stop all preview containers
export const stopAllPreviews = async () => {
    try {
        // Get all preview containers
        const result = execSync(`docker ps --filter "name=preview-" --format "{{.Names}}"`, { encoding: 'utf-8' });
        const containerNames = result.split('\n').filter(name => name.trim());
        
        const stopped = [];
        for (const containerName of containerNames) {
            try {
                execSync(`docker stop ${containerName}`, { stdio: 'ignore' });
                const projectId = containerName.replace('preview-', '');
                
                // Also remove the image
                execSync(`docker rmi preview-${projectId}`, { stdio: 'ignore' });
                
                stopped.push(projectId);
            } catch (error) {
                console.warn(`Failed to stop container ${containerName}:`, error.message);
            }
        }
        
        return { 
            success: true, 
            message: `Stopped ${stopped.length} preview containers`,
            stopped 
        };
    } catch (error) {
        throw new Error(`Failed to stop all previews: ${error.message}`);
    }
};

// Clean up old Docker images and containers
export const cleanupDockerResources = async () => {
    try {
        console.log('🧹 Cleaning up Docker resources...');
        
        // Remove stopped containers
        execSync('docker container prune -f', { stdio: 'ignore' });
        
        // Remove unused images
        execSync('docker image prune -f', { stdio: 'ignore' });
        
        // Remove unused build cache
        execSync('docker builder prune -f', { stdio: 'ignore' });
        
        // Get space saved
        const result = execSync('docker system df', { encoding: 'utf-8' });
        
        return {
            success: true,
            message: 'Docker cleanup completed',
            details: result
        };
    } catch (error) {
        throw new Error(`Docker cleanup failed: ${error.message}`);
    }
};

// Main preview function
export const createProjectPreview = async (owner, repo, options = {}) => {
    const projectId = uuidv4().substring(0, 8);
    const imageName = `preview-${projectId}`;
    const containerName = `preview-${projectId}`;
    
    try {
        console.log(`🎬 Starting preview for ${owner}/${repo}`);
        
        // Step 1: Fetch repository files
        const files = await fetchRepositoryFiles(owner, repo);
        console.log(`📁 Fetched ${files.length} files`);
        
        // Step 2: Detect project type
        const projectType = options.projectType || detectProjectType(files);
        console.log(`🔍 Detected project type: ${projectType}`);
        
        // Step 3: Create workspace
        const workspaceDir = await createProjectWorkspace(projectId, files);
        console.log(`📂 Created workspace: ${workspaceDir}`);
        
        // Step 4: Generate Dockerfile
        const config = await generateDockerfile(workspaceDir, projectType, options.dockerConfig);
        console.log(`🐳 Generated Dockerfile for ${projectType}`);
        
        // Step 5: Build Docker image
        await buildDockerImage(workspaceDir, imageName);
        
        // Step 6: Run container
        const containerInfo = await runDockerContainer(imageName, containerName, config.port);
        
        // Step 7: Health check
        console.log(`🏥 Checking container health...`);
        const healthCheck = await checkContainerHealth(
            containerInfo.containerId, 
            config.port, 
            config.healthCheck
        );
        
        const result = {
            success: true,
            projectId,
            repository: { owner, repo },
            projectType,
            preview: {
                url: `http://localhost:${config.port}`,
                port: config.port,
                containerId: containerInfo.containerId,
                containerName,
                healthy: healthCheck.healthy
            },
            files: {
                count: files.length,
                types: [...new Set(files.map(f => path.extname(f.name)).filter(Boolean))]
            },
            workspace: workspaceDir,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // 2 hours
        };
        
        if (!healthCheck.healthy) {
            result.warning = 'Container started but health check failed. Preview might not be ready yet.';
        }
        
        console.log(`✅ Preview created successfully: ${result.preview.url}`);
        return result;
        
    } catch (error) {
        // Cleanup on failure
        try {
            await stopPreview(projectId);
        } catch (cleanupError) {
            console.error('Cleanup failed:', cleanupError.message);
        }
        
        throw new Error(`Preview creation failed: ${error.message}`);
    }
};

// List active previews
export const listActivePreviews = async () => {
    try {
        const output = execSync('docker ps --filter "name=preview-" --format "{{.Names}}\t{{.Ports}}\t{{.Status}}"', 
            { encoding: 'utf-8' });
        
        const previews = output.trim().split('\n')
            .filter(line => line.trim())
            .map(line => {
                const [name, ports, status] = line.split('\t');
                const projectId = name.replace('preview-', '');
                const port = ports.match(/:(\d+)->/)?.[1] || 'unknown';
                
                return {
                    projectId,
                    containerName: name,
                    port: parseInt(port),
                    url: `http://localhost:${port}`,
                    status,
                    previewUrl: `http://localhost:${port}`
                };
            });
        
        return {
            success: true,
            previews,
            count: previews.length
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            previews: []
        };
    }
};