// controllers/employeeController.js
import EmployeeModel from '../models/employeeModel.js';
import emailService from '../utils/emailService.js';
import { calculateTrustScore } from '../utils/trustScore.js';
import crypto from 'crypto';

class EmployeeController {

    async uploadPayroll(req, res) {
        try {
            const { employees } = req.body;

            if (!employees || !Array.isArray(employees) || employees.length === 0) {
                return res.status(400).json({ success: false, message: "No employees data provided" });
            }

            const processedEmployees = employees.map(emp => {
                const token = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days

                return {
                    employee_id: emp.Employee_ID || emp.employee_id,
                    full_name: emp.Full_Name || emp.full_name,
                    email: emp.Email || emp.email,
                    department: emp.Department, 
                    salary: parseFloat(emp.Salary),
                    photo_url: emp.Photo_URL,
                    verification_token: token,
                    token_expires_at: expiresAt,
                    status: 'pending',
                    attempts: 0,
                    trust_score: 0
                };
            });

            const result = await EmployeeModel.createEmployees(processedEmployees);

            if (result.error) throw result.error;

            // Send emails asynchronously
            result.data.forEach(emp => {
                emailService.sendVerificationEmail(emp).catch(console.error);
            });

            res.status(201).json({
                success: true,
                message: `Processed ${result.data.length} employees. Verification emails sent.`,
                count: result.data.length
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async verifyEmployee(req, res) {
        try {
            const { token } = req.params;

            const { data: employee, error } = await EmployeeModel.findByToken(token);

            if (error || !employee) {
                return res.status(404).json({ success: false, message: "Invalid or expired link" });
            }

            if (new Date(employee.token_expires_at) < new Date()) {
                await EmployeeModel.updateByToken(token, { status: 'failed' });
                return res.status(400).json({ success: false, message: "Link has expired" });
            }

            if (employee.attempts >= 3) {
                await EmployeeModel.updateByToken(token, { status: 'manual_review' });
                return res.status(400).json({ success: false, message: "Maximum attempts reached. Contact HR." });
            }

            res.json({ success: true, employee });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async submitVerification(req, res) {
        try {
            const { token } = req.params;
            const { faceMatchScore = 85, notes = "" } = req.body;

            const { data: employee } = await EmployeeModel.findByToken(token);

            if (!employee) return res.status(404).json({ success: false, message: "Employee not found" });

            const newAttempts = employee.attempts + 1;
            let status = 'pending';
            let trustScore = 0;

            if (newAttempts >= 3) {
                status = 'manual_review';
            } else if (faceMatchScore >= 75) {
                status = 'verified';
            }

            trustScore = calculateTrustScore({
                attendance_days: employee.attendance_days,
                faceMatchScore,
                attempts: newAttempts,
                status
            });

            const updates = {
                attempts: newAttempts,
                status,
                trust_score: trustScore,
                last_attempt: new Date(),
                notes: notes || employee.notes
            };

            await EmployeeModel.updateByToken(token, updates);

            res.json({
                success: true,
                status,
                trust_score: trustScore,
                attempts_remaining: Math.max(0, 3 - newAttempts)
            });

        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    async getEmployees(req, res) {
        try {
            const result = await EmployeeModel.getAllEmployees();
            res.json({ success: true, data: result.data });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

export default new EmployeeController();