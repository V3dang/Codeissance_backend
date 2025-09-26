import { User } from './models.js';

// Helper function to calculate user title based on points
export const calculateTitle = (points) => {
    if (points >= 100) return 'Hero';
    if (points >= 60) return 'General';
    if (points >= 30) return 'Knight';
    if (points >= 10) return 'Soilder';
    return 'Newbie';
};

// Award points to user and update title
export const awardPoints = async (userId, points) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }
        
        user.contributionPoints += points;
        user.title = calculateTitle(user.contributionPoints);
        await user.save();
        
        return {
            success: true,
            newPoints: user.contributionPoints,
            newTitle: user.title,
            pointsAwarded: points
        };
    } catch (error) {
        throw error;
    }
};

// Get user stats
export const getUserStats = async (req, res) => {
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
            stats: {
                contributionPoints: user.contributionPoints || 0,
                title: user.title || 'Newbie',
                name: user.name,
                githubId: user.githubId
            }
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Get leaderboard (top contributors)
export const getLeaderboard = async (req, res) => {
    try {
        const topUsers = await User.find({})
            .select('name githubId contributionPoints title avatar_url')
            .sort({ contributionPoints: -1 })
            .limit(10);
        
        return res.json({
            success: true,
            leaderboard: topUsers
        });
        
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};