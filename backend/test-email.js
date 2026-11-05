require("dotenv").config();

const nodemailer = require("nodemailer");

async function sendTestEmail() {
    try {
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: "StraySync Email Test",
            text: "Success! StraySync can now send email notifications."
        });

        console.log("Test email sent successfully!");
    } catch (error) {
        console.log("Email sending failed:", error.message);
    }
}

sendTestEmail();