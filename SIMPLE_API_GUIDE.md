# 📚 Simple API Testing Guide - GitHub Repository Analyzer

## 🚀 Quick Start

Your API now uses **JWT-only authentication** with no GitHub OAuth dependency.

### 1. Start Your Server
```bash
npm start
```

### 2. Create a Test User & Get JWT Token
```bash
curl -X POST http://localhost:3000/auth/create-user \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "githubId": "testuser123",
    "email": "test@example.com",
    "bio": "Test user for API testing",
    "tech_stack": ["JavaScript", "Node.js", "React"]
  }'
```

**Sample Response:**
```json
{
  "success": true,
  "message": "User created successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "670123456789abcdef012345",
    "name": "Test User",
    "githubId": "testuser123",
    "bio": "Test user for API testing",
    "tech_stack": ["JavaScript", "Node.js", "React"],
    "email": "test@example.com",
    "avatar_url": "https://github.com/identicons/testuser123.png",
    "github_profile": "https://github.com/testuser123"
  },
  "note": "Use this token in Authorization header: Bearer <token>"
}
```

### 3. Save Your Token
Copy the `token` value from the response and use it in all subsequent requests.

---

## 🔑 Using Your JWT Token

**Set as environment variable:**
```bash
# Windows CMD
set JWT_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Windows PowerShell
$env:JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Linux/Mac
export JWT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## 📋 API Endpoints

### 🔐 Authentication

#### 1. Create User / Login
```bash
POST /auth/create-user
Content-Type: application/json

{
  "name": "Your Name",
  "githubId": "your-github-username",
  "email": "your-email@example.com",
  "bio": "Your bio",
  "tech_stack": ["JavaScript", "Python", "React"]
}
```

#### 2. Get Profile
```bash
curl -H "Authorization: Bearer %JWT_TOKEN%" http://localhost:3000/auth/profile
```

### 📊 Repository Analysis (🔒 Auth Required)

#### 3. Analyze Repository by Owner/Repo
```bash
# Analyze React repository
curl -H "Authorization: Bearer %JWT_TOKEN%" http://localhost:3000/analyze/facebook/react

# Analyze Express.js (smaller, faster)
curl -H "Authorization: Bearer %JWT_TOKEN%" http://localhost:3000/analyze/expressjs/express

# Analyze VS Code
curl -H "Authorization: Bearer %JWT_TOKEN%" http://localhost:3000/analyze/microsoft/vscode
```

#### 4. Analyze Repository by URL
```bash
curl -X POST http://localhost:3000/analyze-url \
  -H "Authorization: Bearer %JWT_TOKEN%" \
  -H "Content-Type: application/json" \
  -d '{"repoUrl": "https://github.com/nodejs/node"}'
```

### 🏗️ Project Structure (No Auth Required)

#### 5. Get Project Structure
```bash
curl http://localhost:3000/structure/facebook/react
curl http://localhost:3000/structure/expressjs/express
```

### 📄 PowerPoint Download (No Auth Required)

#### 6. Download Pitch Deck
```bash
curl -O http://localhost:3000/download-ppt/facebook/react
# Downloads: facebook-react-pitch-deck.pptx
```

### 👤 User Management

#### 7. Update User Profile
```bash
curl -X PUT http://localhost:3000/users \
  -H "Authorization: Bearer %JWT_TOKEN%" \
  -H "Content-Type: application/json" \
  -d '{
    "bio": "Updated bio - Full-stack developer",
    "tech_stack": ["JavaScript", "TypeScript", "React", "Node.js", "MongoDB"]
  }'
```

#### 8. Get User by GitHub ID
```bash
curl http://localhost:3000/users/testuser123
```

### 📁 Project Management (🔒 Auth Required)

#### 9. List Projects
```bash
# List all projects
curl -H "Authorization: Bearer %JWT_TOKEN%" http://localhost:3000/projects

# List only your projects
curl -H "Authorization: Bearer %JWT_TOKEN%" "http://localhost:3000/projects?my_projects=true"

# Filter by language
curl -H "Authorization: Bearer %JWT_TOKEN%" "http://localhost:3000/projects?language=JavaScript&limit=5"
```

#### 10. Update Project
```bash
curl -X PUT http://localhost:3000/projects/PROJECT_ID \
  -H "Authorization: Bearer %JWT_TOKEN%" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "tags": ["react", "frontend", "production"],
    "possible_modifications": ["Add TypeScript", "Improve documentation"]
  }'
```

#### 11. Delete Project
```bash
curl -X DELETE http://localhost:3000/projects/PROJECT_ID \
  -H "Authorization: Bearer %JWT_TOKEN%"
```

---

## 🧪 Complete Testing Workflow

### Step 1: Create User and Get Token
```bash
curl -X POST http://localhost:3000/auth/create-user \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Tester",
    "githubId": "api-tester-123",
    "email": "tester@example.com",
    "bio": "Testing the GitHub analyzer API",
    "tech_stack": ["JavaScript", "Testing", "API"]
  }'
```

### Step 2: Test Authentication
```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" http://localhost:3000/auth/profile
```

### Step 3: Analyze a Repository
```bash
# Start with a smaller repo for faster testing
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" http://localhost:3000/analyze/expressjs/express
```

### Step 4: Check Your Projects
```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" "http://localhost:3000/projects?my_projects=true"
```

### Step 5: Get Project Structure (No Auth)
```bash
curl http://localhost:3000/structure/expressjs/express
```

---

## 📊 Postman Setup

### Environment Variables
```
BASE_URL: http://localhost:3000
JWT_TOKEN: (paste your token here)
```

### Authorization Setup
1. Go to **Authorization** tab
2. Type: **Bearer Token**
3. Token: `{{JWT_TOKEN}}`

### Sample Collection Structure
```
📁 GitHub Analyzer API
├── 🔐 Auth
│   ├── POST Create User
│   └── GET Profile
├── 📊 Repository Analysis
│   ├── GET Analyze facebook/react
│   ├── GET Analyze expressjs/express
│   └── POST Analyze by URL
├── 🏗️ Project Structure
│   └── GET Structure
├── 👤 User Management
│   ├── PUT Update Profile
│   └── GET User by GitHub ID
└── 📁 Project Management
    ├── GET List Projects
    ├── PUT Update Project
    └── DELETE Delete Project
```

---

## ⚡ Benefits of This Setup

✅ **No OAuth Issues** - No CloudFront or GitHub OAuth dependencies  
✅ **Simple Authentication** - Just JWT tokens  
✅ **Real Database** - MongoDB with full persistence  
✅ **All Features Work** - Complete API functionality  
✅ **Easy Testing** - One endpoint to get started  
✅ **Production Ready** - Same security as before, just simpler auth  

---

## 🔧 Error Handling

### Common Responses

**Success:**
```json
{
  "success": true,
  "data": "...",
  "message": "Operation completed"
}
```

**Authentication Error:**
```json
{
  "success": false,
  "error": "Authentication required",
  "message": "Please provide a valid JWT token via Authorization header: Bearer <token>"
}
```

**Validation Error:**
```json
{
  "success": false,
  "error": "Name and githubId are required"
}
```

Your API is now much simpler and easier to test while maintaining all the functionality!