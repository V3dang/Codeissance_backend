import { Mentor } from './models.js';

// ==================== MENTOR MANAGEMENT FUNCTIONS ====================

// Create/Register a new mentor
export const createMentor = async (req, res) => {
    try {
        const { name, email, title, years_of_experience, expertise_areas, tech_stack, funding_capacity, links } = req.body;

        // Basic validation
        if (!name || !email || !title || years_of_experience === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, email, title, years_of_experience'
            });
        }

        // Email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid email format'
            });
        }

        // Check if mentor exists
        const existingMentor = await Mentor.findOne({ email: email.toLowerCase() });
        if (existingMentor) {
            return res.status(400).json({
                success: false,
                error: 'Mentor with this email already exists'
            });
        }

        // Create mentor
        const mentor = new Mentor({
            name,
            email: email.toLowerCase(),
            title,
            years_of_experience,
            expertise_areas: expertise_areas || [],
            tech_stack: tech_stack || [],
            funding_capacity: funding_capacity || { can_provide_funding: false, funding_range: { min: 0, max: 0 } },
            links: links || {}
        });

        await mentor.save();
        return res.status(201).json({ success: true, data: mentor });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

// Mentor login
export const loginMentor = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, error: 'Email is required' });
        }

        const mentor = await Mentor.findOne({ 
            email: email.toLowerCase(),
            status: 'active'
        });

        if (!mentor) {
            return res.status(404).json({ success: false, error: 'Mentor not found' });
        }

        return res.json({
            success: true,
            data: {
                mentor_id: mentor._id,
                name: mentor.name,
                email: mentor.email,
                title: mentor.title
            }
        });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

// Get mentor by ID
export const getMentorById = async (req, res) => {
    try {
        const mentor = await Mentor.findById(req.params.mentorId);
        if (!mentor) {
            return res.status(404).json({ success: false, error: 'Mentor not found' });
        }
        return res.json({ success: true, data: mentor });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

// Get mentor by email
export const getMentorByEmail = async (req, res) => {
    try {
        const mentor = await Mentor.findOne({ email: req.params.email.toLowerCase() });
        if (!mentor) {
            return res.status(404).json({ success: false, error: 'Mentor not found' });
        }
        return res.json({ success: true, data: mentor });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

// Get all mentors
export const getAllMentors = async (req, res) => {
    try {
        const { page = 1, limit = 10, expertise, tech_stack, can_provide_funding } = req.query;
        
        let filter = { status: 'active' };
        if (expertise) filter.expertise_areas = { $in: [new RegExp(expertise, 'i')] };
        if (tech_stack) filter.tech_stack = { $in: [new RegExp(tech_stack, 'i')] };
        if (can_provide_funding !== undefined) filter['funding_capacity.can_provide_funding'] = can_provide_funding === 'true';

        const skip = (page - 1) * limit;
        const mentors = await Mentor.find(filter).skip(skip).limit(parseInt(limit));
        const totalMentors = await Mentor.countDocuments(filter);

        return res.json({
            success: true,
            data: {
                mentors,
                total: totalMentors
            }
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};

// Update mentor
export const updateMentor = async (req, res) => {
    try {
        const updateData = req.body;
        delete updateData.email;
        delete updateData.ratings;

        const mentor = await Mentor.findByIdAndUpdate(req.params.mentorId, updateData, { new: true });
        if (!mentor) {
            return res.status(404).json({ success: false, error: 'Mentor not found' });
        }
        return res.json({ success: true, data: mentor });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
};