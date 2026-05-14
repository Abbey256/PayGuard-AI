// routes/employeeRoutes.js
const express = require('express');
const EmployeeController = require('../controllers/employeeController');
const { uploadCSV } = require('../middleware/uploadCSV');

const router = express.Router();

router.post('/upload-payroll', uploadCSV, EmployeeController.uploadPayroll);
router.get('/employees', EmployeeController.getEmployees);
router.get('/verify/:token', EmployeeController.verifyEmployee);
router.post('/verify/:token', EmployeeController.submitVerification);

module.exports = router;