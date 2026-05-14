// middleware/uploadCSV.js
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';

const upload = multer({ dest: 'uploads/' });

export const uploadCSV = [
    upload.single('file'),
    (req, res, next) => {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const results = [];
        const filePath = req.file.path;

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                fs.unlinkSync(filePath);        // delete temp file
                req.body.employees = results;
                next();
            })
            .on('error', (error) => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                res.status(400).json({ success: false, message: "CSV parsing error" });
            });
    }
];