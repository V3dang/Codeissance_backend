import { User, Project, ContributionRequest } from './models.js';
import { awardPoints } from './gamificationService.js';

// Send contribution request
export const sendContributionRequest = async (req, res) => {
    try {
        const { projectId } = req.params;
        const requesterId = req.user._id;
        const { message } = req.body;

        // Validate required fields
        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: message'
            });
        }

        // Check if project exists
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }

        // Prevent self-contribution requests
        if (project.created_by.toString() === requesterId.toString()) {
            return res.status(400).json({
                success: false,
                error: 'Cannot request to contribute to your own project'
            });
        }

        // Check for existing request (approved or pending)
        const existingRequest = await ContributionRequest.findOne({
            project_id: projectId,
            requester_id: requesterId
        });

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                error: 'You already have a contribution request for this project'
            });
        }

        // Create contribution request
        const contributionRequest = new ContributionRequest({
            project_id: projectId,
            requester_id: requesterId,
            project_owner_id: project.created_by,
            message
        });

        const savedRequest = await contributionRequest.save();

        res.status(201).json({
            success: true,
            message: 'Contribution request sent successfully',
            request: {
                _id: savedRequest._id,
                project_id: savedRequest.project_id,
                message: savedRequest.message,
                approved: savedRequest.approved,
                createdAt: savedRequest.createdAt
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to send contribution request',
            details: error.message
        });
    }
};

// Get all contribution requests for a project (owner only)
export const getProjectContributionRequests = async (req, res) => {
    try {
        const { projectId } = req.params;
        const userId = req.user._id;

        // Check if project exists and user is owner
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({
                success: false,
                error: 'Project not found'
            });
        }

        if (project.created_by.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Only project owner can view contribution requests'
            });
        }

        // Get all requests for this project
        const requests = await ContributionRequest.find({ project_id: projectId })
            .populate('requester_id', 'name email githubId tech_stack')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            requests: requests,
            total: requests.length
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch contribution requests',
            details: error.message
        });
    }
};

// Approve contribution request
export const approveContributionRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = req.user._id;
        const { owner_response } = req.body;

        console.log('🔍 DEBUG - Approve Request:');
        console.log('Request ID:', requestId);
        console.log('Current User ID:', userId);
        console.log('User Object:', req.user);

        // Find the request
        const request = await ContributionRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Contribution request not found'
            });
        }

        console.log('Found Request:');
        console.log('- Project Owner ID:', request.project_owner_id);
        console.log('- Project Owner ID (string):', request.project_owner_id.toString());
        console.log('- Current User ID (string):', userId.toString());
        console.log('- IDs Match:', request.project_owner_id.toString() === userId.toString());

        // Check if user is the project owner
        if (request.project_owner_id.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Only project owner can approve requests',
                debug: {
                    project_owner_id: request.project_owner_id.toString(),
                    current_user_id: userId.toString(),
                    match: false
                }
            });
        }

        // Update request
        request.approved = true;
        request.owner_response = owner_response || 'Request approved';
        await request.save();

        // Award points to the requester using gamification service
        const pointsAwarded = 1;
        let gamificationResult = null;
        
        try {
            gamificationResult = await awardPoints(request.requester_id, pointsAwarded);
        } catch (error) {
            console.log('⚠️ Warning: Failed to award points:', error.message);
        }

        res.json({
            success: true,
            message: 'Contribution request approved successfully',
            pointsAwarded,
            gamification: gamificationResult,
            request: {
                _id: request._id,
                approved: request.approved,
                owner_response: request.owner_response,
                updatedAt: request.updatedAt
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to approve request',
            details: error.message
        });
    }
};

// Reject contribution request (set approved to false)
export const rejectContributionRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = req.user._id;
        const { owner_response } = req.body;

        // Find the request
        const request = await ContributionRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Contribution request not found'
            });
        }

        // Check if user is the project owner
        if (request.project_owner_id.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Only project owner can reject requests'
            });
        }

        // Update request
        request.approved = false;
        request.owner_response = owner_response || 'Request rejected';
        await request.save();

        res.json({
            success: true,
            message: 'Contribution request rejected',
            request: {
                _id: request._id,
                approved: request.approved,
                owner_response: request.owner_response,
                updatedAt: request.updatedAt
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to reject request',
            details: error.message
        });
    }
};

// Get specific contribution request details
export const getContributionRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const userId = req.user._id;

        // Find the request with populated data
        const request = await ContributionRequest.findById(requestId)
            .populate('requester_id', 'name email githubId tech_stack')
            .populate('project_id', 'name description repo_link owner repo')
            .populate('project_owner_id', 'name email githubId');

        if (!request) {
            return res.status(404).json({
                success: false,
                error: 'Contribution request not found'
            });
        }

        // Check if user is authorized (requester or project owner)
        const isRequester = request.requester_id._id.toString() === userId.toString();
        const isOwner = request.project_owner_id._id.toString() === userId.toString();

        if (!isRequester && !isOwner) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to view this request'
            });
        }

        res.json({
            success: true,
            request: request
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch request details',
            details: error.message
        });
    }
};