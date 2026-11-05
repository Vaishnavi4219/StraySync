
const nodemailer = require("nodemailer");


// ==========================================
// GMAIL SMTP CONFIGURATION
// ==========================================

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },

    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 30000
});


// Frontend URL
const FRONTEND_URL =
    process.env.FRONTEND_URL || "http://localhost:5000";


// ==========================================
// STAFF APPROVAL EMAIL
// ==========================================

async function sendStaffApprovalEmail(email, name) {
    await transporter.sendMail({
        from: `"StraySync" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "StraySync - Registration Approved!",
        text: `
Hello ${name},

Congratulations!

Your StraySync Rescue Staff registration has been approved by the Municipal Officer.

You can now log in to your StraySync Staff Dashboard.

Thank you,
StraySync Team
        `
    });
}


// ==========================================
// CITIZEN EMAIL OTP
// ==========================================

async function sendCitizenOTPEmail(email, name, otp) {
    await transporter.sendMail({
        from: `"StraySync" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "StraySync - Email Verification OTP",
        text: `
Hello ${name},

Welcome to StraySync!

Your email verification OTP is: ${otp}

This OTP is valid for 5 minutes.

Please do not share this OTP with anyone.

If you did not request this verification, please ignore this email.

Thank you,
StraySync Team
        `
    });
}


// ==========================================
// NEW COMPLAINT EMAIL TO OFFICERS
// ==========================================

async function sendNewComplaintEmail(email, complaint) {

    const complaintLink =
        `${FRONTEND_URL}/municipal/complaints.html?complaintId=${complaint.id}`;

    await transporter.sendMail({
        from: `"StraySync" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `StraySync - New Complaint #${complaint.id}`,

        text: `
Hello Municipal Officer,

A new animal complaint has been submitted through StraySync.

COMPLAINT DETAILS

Complaint ID: ${complaint.id}
Citizen Name: ${complaint.citizenName}
Citizen Mobile: ${complaint.mobile}
Citizen Email: ${complaint.citizenEmail}

Animal Type: ${complaint.animalType}
Category: ${complaint.category}
Description: ${complaint.description}

Location: ${complaint.location}
Priority: ${complaint.priority}
Status: Pending Review

Please log in to your Municipal Officer Dashboard to review this complaint.

View Complaint:
${complaintLink}

Thank you,
StraySync Team
        `
    });
}


// ==========================================
// RESCUE COMPLETION EMAIL TO CITIZEN
// ==========================================

async function sendRescueCompletionEmail(
    email,
    citizenName,
    complaintId
) {

    const feedbackLink =
        `${FRONTEND_URL}/citizen/complaint-details.html?id=${complaintId}`;

    await transporter.sendMail({
        from: `"StraySync" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `StraySync - Rescue Report Submitted #${complaintId}`,

        text: `
Hello ${citizenName},

Good news!

The rescue team has successfully submitted a rescue completion report for your complaint.

Complaint ID: ${complaintId}

Please visit StraySync to review the rescue team's report and submit your feedback.

Your feedback is important to help us improve our animal rescue services.

Submit Your Feedback:
${feedbackLink}

Thank you for supporting StraySync!

StraySync Team
        `
    });
}


// ==========================================
// OFFICER REVIEW EMAIL TO STAFF
// ==========================================

async function sendStaffReviewEmail(
    email,
    staffName,
    complaintId,
    decision,
    feedback
) {

    const staffLink =
        `${FRONTEND_URL}/staff/complaint-details.html?id=${complaintId}`;

    const isApproved = decision === "Approved";

    const subject = isApproved
        ? `StraySync - Rescue Report Approved #${complaintId}`
        : `StraySync - Rescue Report Rejected #${complaintId}`;

    const message = isApproved
        ? `
Good news!

Your rescue completion report for complaint #${complaintId} has been approved by the Municipal Officer.

The rescue work has been successfully verified.

Complaint ID: ${complaintId}

View Complaint:
${staffLink}
`
        : `
Your rescue completion report for complaint #${complaintId} has been rejected by the Municipal Officer.

Officer Feedback:
${feedback || "No additional feedback was provided."}

Please review the officer's feedback and update the rescue report as required.

Complaint ID: ${complaintId}

View Complaint:
${staffLink}
`;

    await transporter.sendMail({
        from: `"StraySync" <${process.env.EMAIL_USER}>`,
        to: email,
        subject,

        text: `
Hello ${staffName},

${message}

Thank you,
StraySync Team
        `
    });
}


// ==========================================
// EXPORT FUNCTIONS
// ==========================================

module.exports = {
    sendStaffApprovalEmail,
    sendCitizenOTPEmail,
    sendNewComplaintEmail,
    sendRescueCompletionEmail,
    sendStaffReviewEmail
};

