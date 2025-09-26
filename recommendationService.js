import { User, Project } from './models.js';

/**
 * Get project recommendations for a user based on tech stack matching
 * 
 * @param {string} userId - The MongoDB ObjectId of the user
 * @returns {Promise<Object>} - User data and recommended projects sorted by score
 */
const getProjectRecommendations = async (userId) => {
    try {
        // Get the current user's data
        const currentUser = await User.findById(userId);
        if (!currentUser) {
            throw new Error('User not found');
        }

        // Get all projects except those created by the current user
        const projects = await Project.find({ 
            created_by: { $ne: userId } 
        }).populate('created_by', 'name githubId bio tech_stack');

        // Calculate recommendation scores for each project
        const projectsWithScores = projects.map(project => {
            let score = 0;
            
            // Score based on matching user tech stack with project technology stack
            // 2 points per match
            if (currentUser.tech_stack && currentUser.tech_stack.length > 0) {
                const techStackMatches = project.technology_stack.filter(tech => 
                    currentUser.tech_stack.some(userTech => 
                        userTech.toLowerCase().includes(tech.toLowerCase()) ||
                        tech.toLowerCase().includes(userTech.toLowerCase())
                    )
                );
                score += techStackMatches.length * 2; // 2 points per tech stack match
            }

            // Score based on matching user's tech stack with project tags
            // 1 point per match
            if (currentUser.tech_stack && currentUser.tech_stack.length > 0 && project.tags) {
                const tagMatches = project.tags.filter(tag => 
                    currentUser.tech_stack.some(userTech => 
                        userTech.toLowerCase().includes(tag.toLowerCase()) ||
                        tag.toLowerCase().includes(userTech.toLowerCase())
                    )
                );
                score += tagMatches.length; // 1 point per tag match with user tech stack
            }

            return {
                ...project.toObject(),
                recommendationScore: score,
                matchDetails: {
                    techStackMatches: project.technology_stack.filter(tech => 
                        currentUser.tech_stack && currentUser.tech_stack.some(userTech => 
                            userTech.toLowerCase().includes(tech.toLowerCase()) ||
                            tech.toLowerCase().includes(userTech.toLowerCase())
                        )
                    ),
                    tagMatches: project.tags ? project.tags.filter(tag => 
                        currentUser.tech_stack && currentUser.tech_stack.some(userTech => 
                            userTech.toLowerCase().includes(tag.toLowerCase()) ||
                            tag.toLowerCase().includes(userTech.toLowerCase())
                        )
                    ) : []
                }
            };
        });

        // Sort projects by recommendation score in descending order
        const sortedProjects = projectsWithScores.sort((a, b) => b.recommendationScore - a.recommendationScore);

        return {
            user: {
                _id: currentUser._id,
                name: currentUser.name,
                githubId: currentUser.githubId,
                tech_stack: currentUser.tech_stack
            },
            recommendedProjects: sortedProjects,
            totalProjects: sortedProjects.length,
            scoringSystem: {
                techStackMatch: 2, // points per tech stack match
                tagMatch: 1, // points per tag match
                description: 'Each user tech stack match with project tech stack = 2 points, each user tech stack match with project tags = 1 point'
            }
        };

    } catch (error) {
        console.error('Error in getProjectRecommendations:', error);
        throw error;
    }
};

// Export the recommendation function
export {
    getProjectRecommendations
};