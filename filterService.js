import { Project } from './models.js';

/**
 * Filter projects based on tags
 * 
 * @param {string[]} tags - Array of tags to filter by
 * @param {string} userId - User ID to exclude user's own projects (optional)
 * @returns {Promise<Object>} - Filtered projects
 */
const filterProjectsByTags = async (tags, userId = null) => {
    try {
        // Build the base query
        let query = {};
        if (userId) {
            query.created_by = { $ne: userId };
        }

        // Get all projects
        const projects = await Project.find(query).populate('created_by', 'name githubId');

        // Filter by tags
        const filteredProjects = projects.filter(project => 
            tags.some(filterTag => 
                project.tags && project.tags.some(projectTag => 
                    projectTag.toLowerCase().includes(filterTag.toLowerCase())
                )
            )
        );

        return {
            filteredProjects,
            totalProjects: filteredProjects.length,
            filterType: 'tags',
            filterCriteria: tags
        };

    } catch (error) {
        console.error('Error in filterProjectsByTags:', error);
        throw error;
    }
};

/**
 * Filter projects based on tech stack
 * 
 * @param {string[]} techStack - Array of technologies to filter by
 * @param {string} userId - User ID to exclude user's own projects (optional)
 * @returns {Promise<Object>} - Filtered projects
 */
const filterProjectsByTechStack = async (techStack, userId = null) => {
    try {
        // Build the base query
        let query = {};
        if (userId) {
            query.created_by = { $ne: userId };
        }

        // Get all projects
        const projects = await Project.find(query).populate('created_by', 'name githubId');

        // Filter by tech stack
        const filteredProjects = projects.filter(project => 
            techStack.some(filterTech => 
                project.technology_stack && project.technology_stack.some(projectTech => 
                    projectTech.toLowerCase().includes(filterTech.toLowerCase())
                )
            )
        );

        return {
            filteredProjects,
            totalProjects: filteredProjects.length,
            filterType: 'techStack',
            filterCriteria: techStack
        };

    } catch (error) {
        console.error('Error in filterProjectsByTechStack:', error);
        throw error;
    }
};

// Export filter functions
export {
    filterProjectsByTags,
    filterProjectsByTechStack
};