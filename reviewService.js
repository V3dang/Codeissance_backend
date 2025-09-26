import mongoose from 'mongoose';
import { Mentor, Review } from './models.js';

// ==================== REVIEW MANAGEMENT FUNCTIONS ====================

// Create a new review for a project
export const createReview = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { mentor_id, rating, title, feedback, suggestions, strengths, improvements, funding_interest } = req.body;

        // Basic validation
        if (!mentor_id || !rating || !title || !feedback) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: mentor_id, rating, title, feedback',
                note: 'mentor_id must be a valid MongoDB ObjectId from a created mentor'
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
        }

        // Check if mentor exists and hasn't already reviewed
        const mentor = await Mentor.findById(mentor_id);
        if (!mentor) {
            return res.status(404).json({ success: false, error: 'Mentor not found' });
        }

        const existingReview = await Review.findOne({ mentor_id, project_id: projectId });
        if (existingReview) {
            return res.status(400).json({ success: false, error: 'Mentor has already reviewed this project' });
        }

        // Create review
        const review = new Review({
            mentor_id,
            project_id: projectId,
            rating,
            title,
            feedback,
            suggestions: suggestions || '',
            strengths: strengths || [],
            improvements: improvements || [],
            funding_interest: funding_interest || { interested: false }
        });

        await review.save();

        // Update mentor's rating statistics
        const mentorReviews = await Review.find({ mentor_id });
        const totalRating = mentorReviews.reduce((sum, r) => sum + r.rating, 0);
        const avgRating = totalRating / mentorReviews.length;

        await Mentor.findByIdAndUpdate(mentor_id, {
            'ratings.overall_rating': Math.round(avgRating * 10) / 10,
            'ratings.total_reviews': mentorReviews.length
        });

        await review.populate('mentor_id', 'name title');
        return res.status(201).json({ success: true, data: review });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

// Get all reviews for a specific project
export const getProjectReviews = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const skip = (page - 1) * limit;
        const reviews = await Review.find({ project_id: projectId })
            .populate('mentor_id', 'name title avatar_url ratings')
            .sort('-createdAt')
            .skip(skip)
            .limit(parseInt(limit));

        const totalReviews = await Review.countDocuments({ project_id: projectId });

        // Calculate review statistics
        const reviewStats = await Review.aggregate([
            { $match: { project_id: new mongoose.Types.ObjectId(projectId) } },
            {
                $group: {
                    _id: null,
                    averageRating: { $avg: '$rating' },
                    totalReviews: { $sum: 1 },
                    ratingDistribution: { $push: '$rating' }
                }
            }
        ]);

        const stats = reviewStats.length > 0 ? {
            averageRating: Math.round(reviewStats[0].averageRating * 10) / 10,
            totalReviews: reviewStats[0].totalReviews,
            ratingDistribution: reviewStats[0].ratingDistribution.reduce((acc, rating) => {
                acc[rating] = (acc[rating] || 0) + 1;
                return acc;
            }, {})
        } : { averageRating: 0, totalReviews: 0, ratingDistribution: {} };

        return res.json({
            success: true,
            data: {
                reviews,
                stats,
                total: totalReviews
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

// Get a specific review
export const getReviewById = async (req, res) => {
    try {
        const review = await Review.findById(req.params.reviewId)
            .populate('mentor_id', 'name title avatar_url ratings')
            .populate('project_id', 'name description repo_link');

        if (!review) {
            return res.status(404).json({ success: false, error: 'Review not found' });
        }

        return res.json({ success: true, data: review });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

// Update a review
export const updateReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { mentor_id, rating, title, feedback, suggestions, strengths, improvements, funding_interest } = req.body;

        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({ success: false, error: 'Review not found' });
        }

        if (review.mentor_id.toString() !== mentor_id) {
            return res.status(403).json({ success: false, error: 'You can only update your own reviews' });
        }

        if (rating && (rating < 1 || rating > 5)) {
            return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
        }

        // Update fields
        if (rating) review.rating = rating;
        if (title) review.title = title;
        if (feedback) review.feedback = feedback;
        if (suggestions !== undefined) review.suggestions = suggestions;
        if (strengths) review.strengths = strengths;
        if (improvements) review.improvements = improvements;
        if (funding_interest) review.funding_interest = funding_interest;

        await review.save();

        // Recalculate mentor's rating if rating updated
        if (rating) {
            const mentorReviews = await Review.find({ mentor_id: review.mentor_id });
            const totalRating = mentorReviews.reduce((sum, r) => sum + r.rating, 0);
            const avgRating = totalRating / mentorReviews.length;

            await Mentor.findByIdAndUpdate(review.mentor_id, {
                'ratings.overall_rating': Math.round(avgRating * 10) / 10,
                'ratings.total_reviews': mentorReviews.length
            });
        }

        await review.populate('mentor_id', 'name title');
        return res.json({ success: true, data: review });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

// Delete a review
export const deleteReview = async (req, res) => {
    try {
        const { reviewId } = req.params;
        const { mentor_id } = req.body;

        const review = await Review.findById(reviewId);
        if (!review) {
            return res.status(404).json({ success: false, error: 'Review not found' });
        }

        if (review.mentor_id.toString() !== mentor_id) {
            return res.status(403).json({ success: false, error: 'You can only delete your own reviews' });
        }

        await Review.findByIdAndDelete(reviewId);

        // Recalculate mentor's rating statistics
        const mentorReviews = await Review.find({ mentor_id: review.mentor_id });
        const totalRating = mentorReviews.reduce((sum, r) => sum + r.rating, 0);
        const avgRating = mentorReviews.length > 0 ? totalRating / mentorReviews.length : 0;

        await Mentor.findByIdAndUpdate(review.mentor_id, {
            'ratings.overall_rating': Math.round(avgRating * 10) / 10,
            'ratings.total_reviews': mentorReviews.length
        });

        return res.json({ success: true, message: 'Review deleted successfully' });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

// Get all reviews by a specific mentor
export const getMentorReviews = async (req, res) => {
    try {
        const { mentorId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const mentor = await Mentor.findById(mentorId);
        if (!mentor) {
            return res.status(404).json({ success: false, error: 'Mentor not found' });
        }

        const skip = (page - 1) * limit;
        const reviews = await Review.find({ mentor_id: mentorId })
            .populate('project_id', 'name description repo_link owner repo')
            .sort('-createdAt')
            .skip(skip)
            .limit(parseInt(limit));

        const totalReviews = await Review.countDocuments({ mentor_id: mentorId });

        return res.json({
            success: true,
            data: {
                mentor: { name: mentor.name, title: mentor.title, ratings: mentor.ratings },
                reviews,
                total: totalReviews
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};