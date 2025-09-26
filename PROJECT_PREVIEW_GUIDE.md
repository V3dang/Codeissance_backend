# 🎬 **Project Preview System - Complete Guide**

## 🚀 **Overview**

The Project Preview System allows you to:
- Fetch any GitHub repository
- Automatically detect project type (React, Next.js, Python, etc.)
- Generate appropriate Dockerfile
- Build and run the project in Docker container
- Access live preview via URL
- Manage multiple previews simultaneously

---

## 📋 **Prerequisites**

### 1. **Docker Installation**

**Windows:**
```bash
# Download Docker Desktop from docker.com
# Or use winget
winget install Docker.DockerDesktop
```

**macOS:**
```bash
# Using Homebrew
brew install --cask docker
```

**Linux (Ubuntu):**
```bash
sudo apt update
sudo apt install docker.io docker-compose
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER
```

### 2. **Required Dependencies**

```bash
npm install archiver uuid
```

### 3. **Environment Setup**

Add to your `.env`:
```env
GITHUB_TOKEN=your_github_token_here
DOCKER_HOST=unix:///var/run/docker.sock  # Linux/Mac
# DOCKER_HOST=npipe:////./pipe/docker_engine  # Windows
```

---

## 🎯 **Supported Project Types**

| Type | Detection | Port | Features |
|------|-----------|------|----------|
| **React** | `package.json` + `react` | 3000 | Dev server with hot reload |
| **Next.js** | `package.json` + `next` | 3000 | Production build + server |
| **Vue.js** | `package.json` + `vue` | 8080 | Dev server |
| **Node.js** | `package.json` + `express` | 8000 | Express/Fastify apps |
| **Python** | `requirements.txt` + `.py` | 8000 | Python web apps |
| **Flask** | `app.py` + `flask` imports | 5000 | Flask applications |
| **Static** | `index.html` | 80 | HTML/CSS/JS sites |

---

## 🔧 **API Endpoints**

### 1. **Create Preview**
```http
POST /preview/:owner/:repo
Authorization: Bearer <JWT_TOKEN>
```

**Request Body:**
```json
{
  "projectType": "react",  // Optional: auto-detected if not provided
  "dockerConfig": {        // Optional: custom Docker configuration
    "port": 3000,
    "dockerfile": "custom dockerfile content",
    "buildCommand": "npm run build",
    "startCommand": "npm start"
  }
}
```

**Response:**
```json
{
  "success": true,
  "projectId": "a1b2c3d4",
  "repository": {
    "owner": "facebook",
    "repo": "react"
  },
  "projectType": "react",
  "preview": {
    "url": "http://localhost:3000",
    "port": 3000,
    "containerId": "docker_container_id",
    "containerName": "preview-a1b2c3d4",
    "healthy": true
  },
  "files": {
    "count": 245,
    "types": [".js", ".json", ".md", ".css"]
  },
  "workspace": "/path/to/workspace",
  "createdAt": "2025-09-26T16:30:00.000Z",
  "expiresAt": "2025-09-26T18:30:00.000Z"
}
```

### 2. **List Active Previews**
```http
GET /previews
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "previews": [
    {
      "projectId": "a1b2c3d4",
      "containerName": "preview-a1b2c3d4",
      "port": 3000,
      "url": "http://localhost:3000",
      "status": "Up 5 minutes",
      "previewUrl": "http://localhost:3000"
    }
  ],
  "count": 1
}
```

### 3. **Stop Preview**
```http
DELETE /preview/:projectId
Authorization: Bearer <JWT_TOKEN>
```

**Response:**
```json
{
  "success": true,
  "message": "Preview stopped and cleaned up"
}
```

---

## 🧪 **Testing Examples**

### 1. **Create User & Get Token**
```bash
curl -X POST http://localhost:3000/auth/create-user \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Preview Tester",
    "githubId": "preview-tester",
    "email": "test@preview.com"
  }'
```

### 2. **Create React App Preview**
```bash
curl -X POST http://localhost:3000/preview/facebook/create-react-app \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectType": "react"
  }'
```

### 3. **Create Next.js Preview**
```bash
curl -X POST http://localhost:3000/preview/vercel/next.js \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "projectType": "nextjs"
  }'
```

### 4. **List Active Previews**
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3000/previews
```

### 5. **Stop Preview**
```bash
curl -X DELETE http://localhost:3000/preview/a1b2c3d4 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎨 **Frontend Integration**

### **React Component Example**
```jsx
import React, { useState, useEffect } from 'react';

const ProjectPreview = ({ owner, repo, token }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const createPreview = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/preview/${owner}/${repo}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectType: 'auto' // Let it auto-detect
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setPreview(result);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const stopPreview = async () => {
    if (!preview) return;
    
    try {
      await fetch(`/preview/${preview.projectId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPreview(null);
    } catch (err) {
      console.error('Failed to stop preview:', err);
    }
  };

  return (
    <div className="project-preview">
      <h3>Preview: {owner}/{repo}</h3>
      
      {!preview && (
        <button 
          onClick={createPreview} 
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Creating Preview...' : 'Create Preview'}
        </button>
      )}
      
      {error && (
        <div className="error">
          Error: {error}
        </div>
      )}
      
      {preview && (
        <div className="preview-info">
          <div className="preview-header">
            <span className={`status ${preview.preview.healthy ? 'healthy' : 'unhealthy'}`}>
              {preview.preview.healthy ? '✅ Healthy' : '⚠️ Starting...'}
            </span>
            <button onClick={stopPreview} className="btn-danger">
              Stop Preview
            </button>
          </div>
          
          <div className="preview-details">
            <p><strong>Project Type:</strong> {preview.projectType}</p>
            <p><strong>Port:</strong> {preview.preview.port}</p>
            <p><strong>Files:</strong> {preview.files.count}</p>
            <p><strong>Created:</strong> {new Date(preview.createdAt).toLocaleString()}</p>
          </div>
          
          <div className="preview-frame">
            <iframe 
              src={preview.preview.url}
              width="100%" 
              height="600px"
              title={`Preview of ${owner}/${repo}`}
            />
          </div>
          
          <div className="preview-actions">
            <a 
              href={preview.preview.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              Open in New Tab
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
```

### **CSS Styling**
```css
.project-preview {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.status.healthy { color: #28a745; }
.status.unhealthy { color: #ffc107; }

.preview-frame {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  margin: 15px 0;
}

.preview-details {
  background: #f8f9fa;
  padding: 10px;
  border-radius: 4px;
  margin: 10px 0;
}

.btn-primary, .btn-secondary, .btn-danger {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin: 0 5px;
}

.btn-primary { background: #007bff; color: white; }
.btn-secondary { background: #6c757d; color: white; }
.btn-danger { background: #dc3545; color: white; }
```

---

## 🛡️ **Security & Best Practices**

### **1. Resource Limits**
```javascript
// Add to Docker run command
docker run --memory="512m" --cpus="0.5" ...
```

### **2. Network Isolation**
```javascript
// Create custom Docker network
docker network create preview-network
```

### **3. Cleanup Automation**
```javascript
// Auto-cleanup after 2 hours
setTimeout(() => {
  stopPreview(projectId);
}, 2 * 60 * 60 * 1000);
```

### **4. Rate Limiting**
```javascript
// Limit preview creation per user
const previewLimits = new Map();
// Max 3 concurrent previews per user
```

---

## 🚨 **Troubleshooting**

### **Common Issues:**

**1. Docker not running:**
```bash
# Check Docker status
docker --version
docker ps

# Start Docker service (Linux)
sudo systemctl start docker
```

**2. Port conflicts:**
```bash
# Check what's using port
netstat -an | findstr :3000  # Windows
lsof -i :3000               # Mac/Linux
```

**3. Container build fails:**
```bash
# Check Docker logs
docker logs preview-projectId

# Clean up Docker
docker system prune -f
```

**4. GitHub API limits:**
```bash
# Check rate limit
curl -H "Authorization: token YOUR_TOKEN" \
     https://api.github.com/rate_limit
```

---

## 🎯 **Advanced Features Ideas**

### **1. Multi-Stage Previews**
- Development preview (hot reload)
- Production preview (optimized build)
- Testing preview (with test data)

### **2. Custom Domains**
- Subdomain generation: `project-id.preview.yourdomain.com`
- SSL certificates with Let's Encrypt
- Custom domain mapping

### **3. Collaboration Features**
- Share preview links with expiration
- Real-time collaboration cursors
- Comment system on previews

### **4. Analytics & Monitoring**
- Preview usage analytics
- Performance monitoring
- Error tracking and logs

### **5. Advanced Docker Features**
- Multi-container setups (database + app)
- Environment variable injection
- Volume mounting for persistent data

This system gives you a complete GitHub repository preview platform! 🚀