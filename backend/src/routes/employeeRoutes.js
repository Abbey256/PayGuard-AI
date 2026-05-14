// routes/employeeRoutes.js
import { Router } from 'express';
import EmployeeController from '../controllers/employeeController.js';
import { uploadCSV } from '../middleware/uploadCSV.js';

const router = Router();

router.post('/upload-payroll', uploadCSV, EmployeeController.uploadPayroll);
router.get('/employees', EmployeeController.getEmployees);
router.get('/verify/:token', EmployeeController.verifyEmployee);
router.post('/verify/:token', EmployeeController.submitVerification);

export default router;