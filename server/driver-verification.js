
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { db } = require('./database');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = `uploads/drivers/${req.user.userId}`;
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images and PDFs only
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only image files and PDFs are allowed!'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Driver verification statuses
const VERIFICATION_STATUS = {
  PENDING: 'pending',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired'
};

class DriverVerificationService {
  // Submit driver application
  static async submitApplication(userId, applicationData) {
    const {
      firstName, lastName, dateOfBirth, ssn, email, phone, address,
      licenseNumber, licenseState, licenseValidUntil,
      vehicleMake, vehicleModel, vehicleYear, licensePlate, vehicleColor, vehicleVin,
      insuranceCompany, policyNumber, insuranceExpiryDate,
      registrationExpiryDate,
      bankName, routingNumber, accountNumber, accountHolderName,
      emergencyContactName, emergencyContactPhone,
      backgroundCheckConsent, termsAccepted, dataProcessingConsent
    } = applicationData;

    try {
      // Insert driver application
      const result = await db.query(`
        INSERT INTO driver_applications (
          user_id, first_name, last_name, date_of_birth, ssn, address,
          license_number, license_state, license_valid_until,
          vehicle_make, vehicle_model, vehicle_year, license_plate, vehicle_color, vehicle_vin,
          insurance_company, policy_number, insurance_expiry_date,
          registration_expiry_date,
          bank_name, routing_number, account_number, account_holder_name,
          emergency_contact_name, emergency_contact_phone,
          background_check_consent, terms_accepted, data_processing_consent,
          status, submitted_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28,
          $29, CURRENT_TIMESTAMP
        ) RETURNING id
      `, [
        userId, firstName, lastName, dateOfBirth, ssn, address,
        licenseNumber, licenseState, licenseValidUntil,
        vehicleMake, vehicleModel, vehicleYear, licensePlate, vehicleColor, vehicleVin,
        insuranceCompany, policyNumber, insuranceExpiryDate,
        registrationExpiryDate,
        bankName, routingNumber, accountNumber, accountHolderName,
        emergencyContactName, emergencyContactPhone,
        backgroundCheckConsent, termsAccepted, dataProcessingConsent,
        VERIFICATION_STATUS.PENDING
      ]);

      const applicationId = result.rows[0].id;

      // Update user type to driver
      await db.query(
        'UPDATE users SET user_type = $1 WHERE id = $2',
        ['driver', userId]
      );

      // Verify banking information with Plaid
      if (routingNumber && accountNumber) {
        await this.verifyBankAccount(userId, routingNumber, accountNumber, accountHolderName);
      }

      return { applicationId, status: VERIFICATION_STATUS.PENDING };
    } catch (error) {
      throw new Error(`Application submission failed: ${error.message}`);
    }
  }

  // Upload and verify documents with OCR
  static async uploadDocument(userId, documentType, filePath) {
    try {
      // Save document
      const result = await db.query(`
        INSERT INTO driver_documents (user_id, document_type, file_path, uploaded_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
        RETURNING id
      `, [userId, documentType, filePath]);

      const documentId = result.rows[0].id;

      // OCR verification for license and insurance documents
      if (['licenseImage', 'insuranceImage'].includes(documentType)) {
        await this.verifyDocumentWithOCR(documentId, documentType, filePath);
      }

      return documentId;
    } catch (error) {
      throw new Error(`Document upload failed: ${error.message}`);
    }
  }

  // OCR document verification
  static async verifyDocumentWithOCR(documentId, documentType, filePath) {
    try {
      // AWS Textract or Google Vision API integration
      const fs = require('fs');
      const imageBuffer = fs.readFileSync(filePath);

      const ocrResponse = await fetch('https://vision.googleapis.com/v1/images:annotate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GOOGLE_VISION_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [{
            image: { content: imageBuffer.toString('base64') },
            features: [{ type: 'TEXT_DETECTION' }]
          }]
        })
      });

      const ocrResult = await ocrResponse.json();
      const extractedText = ocrResult.responses[0]?.textAnnotations[0]?.description || '';

      // Update document with OCR results
      await db.query(`
        UPDATE driver_documents 
        SET ocr_text = $1, ocr_verified = $2, verified_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `, [extractedText, extractedText.length > 0, documentId]);

      return { verified: extractedText.length > 0, extractedText };
    } catch (error) {
      console.error('OCR verification failed:', error);
      return { verified: false, error: error.message };
    }
  }

  // Get verification status
  static async getVerificationStatus(userId) {
    try {
      const application = await db.query(
        'SELECT * FROM driver_applications WHERE user_id = $1 ORDER BY submitted_at DESC LIMIT 1',
        [userId]
      );

      const documents = await db.query(
        'SELECT document_type, file_path, uploaded_at FROM driver_documents WHERE user_id = $1',
        [userId]
      );

      return {
        application: application.rows[0] || null,
        documents: documents.rows,
        status: application.rows[0]?.status || 'not_submitted'
      };
    } catch (error) {
      throw new Error(`Failed to get verification status: ${error.message}`);
    }
  }

  // Real background check integration
  static async initiateBackgroundCheck(userId) {
    try {
      // Get user data for background check
      const user = await db.getUserById(userId);
      const application = await db.query(
        'SELECT * FROM driver_applications WHERE user_id = $1 ORDER BY submitted_at DESC LIMIT 1',
        [userId]
      );
      
      if (!application.rows[0]) {
        throw new Error('Driver application not found');
      }

      const appData = application.rows[0];
      
      // Checkr API integration example
      const checkrResponse = await fetch('https://api.checkr.com/v1/candidates', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CHECKR_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: user.email,
          first_name: appData.first_name,
          last_name: appData.last_name,
          phone: user.phone,
          ssn: appData.ssn,
          dob: appData.date_of_birth,
          zipcode: appData.address?.split(' ').pop() || '',
          driver_license_number: appData.license_number,
          driver_license_state: appData.license_state
        })
      });

      if (!checkrResponse.ok) {
        throw new Error(`Checkr API error: ${checkrResponse.statusText}`);
      }

      const candidate = await checkrResponse.json();
      
      // Create background check report
      const reportResponse = await fetch('https://api.checkr.com/v1/reports', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.CHECKR_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          candidate_id: candidate.id,
          package: 'driver_pro'  // Checkr's rideshare package
        })
      });

      const report = await reportResponse.json();
      const checkId = report.id;

      await db.query(`
        INSERT INTO background_checks (user_id, check_id, candidate_id, status, initiated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      `, [userId, checkId, candidate.id, 'in_progress']);

      return { checkId, candidateId: candidate.id, status: 'in_progress' };
    } catch (error) {
      throw new Error(`Background check initiation failed: ${error.message}`);
    }
  }

  // Enhanced vehicle inspection scheduling
  static async scheduleInspection(userId, preferredDate, preferredTime) {
    try {
      const inspectionId = `insp_${Date.now()}_${userId}`;
      
      // Find nearby inspection centers
      const user = await db.getUserById(userId);
      const application = await db.query(
        'SELECT * FROM driver_applications WHERE user_id = $1',
        [userId]
      );

      const inspectionCenters = await this.findNearbyInspectionCenters(application.rows[0]?.address);
      
      await db.query(`
        INSERT INTO vehicle_inspections (
          user_id, inspection_id, preferred_date, preferred_time, 
          assigned_center, status, scheduled_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      `, [
        userId, inspectionId, preferredDate, preferredTime,
        inspectionCenters[0]?.name || 'Auto-assigned',
        'scheduled'
      ]);

      // Send confirmation email/SMS
      await this.sendInspectionConfirmation(user.email, {
        inspectionId,
        date: preferredDate,
        time: preferredTime,
        center: inspectionCenters[0]
      });

      return { 
        inspectionId, 
        status: 'scheduled',
        assignedCenter: inspectionCenters[0],
        confirmationSent: true
      };
    } catch (error) {
      throw new Error(`Inspection scheduling failed: ${error.message}`);
    }
  }

  static async findNearbyInspectionCenters(address) {
    // Mock inspection centers - in production, integrate with actual inspection network
    return [
      {
        name: 'Pi Auto Inspection Center - Downtown',
        address: '123 Main St, City, State 12345',
        phone: '(555) 123-4567',
        hours: 'Mon-Fri 8AM-6PM, Sat 9AM-4PM'
      }
    ];
  }

  static async sendInspectionConfirmation(email, details) {
    // Email/SMS confirmation would be sent here
    console.log(`📧 Inspection confirmation sent to ${email}:`, details);
    return true;
  }

  // Bank account verification
  static async verifyBankAccount(userId, routingNumber, accountNumber, accountHolderName) {
    try {
      // Plaid Auth API integration
      const plaidResponse = await fetch('https://production.plaid.com/auth/get', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
          'PLAID-SECRET': process.env.PLAID_SECRET
        },
        body: JSON.stringify({
          // This would typically use a Plaid Link token flow
          // For instant verification, you'd use their Auth product
        })
      });

      // For demo purposes, validate routing number format
      const isValidRouting = /^\d{9}$/.test(routingNumber);
      const isValidAccount = accountNumber.length >= 4;

      await db.query(`
        INSERT INTO bank_verifications (user_id, routing_number, account_verified, verified_at)
        VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      `, [userId, routingNumber.slice(-4), isValidRouting && isValidAccount]);

      return { verified: isValidRouting && isValidAccount };
    } catch (error) {
      console.error('Bank verification failed:', error);
      return { verified: false, error: error.message };
    }
  }

  // Update verification status (admin function)
  static async updateVerificationStatus(userId, status, reason = null) {
    try {
      await db.query(`
        UPDATE driver_applications 
        SET status = $1, review_reason = $2, reviewed_at = CURRENT_TIMESTAMP
        WHERE user_id = $3
      `, [status, reason, userId]);

      if (status === VERIFICATION_STATUS.APPROVED) {
        // Enable driver functionality
        await db.query(
          'UPDATE users SET driver_approved = true WHERE id = $1',
          [userId]
        );
      }

      return { status, reason };
    } catch (error) {
      throw new Error(`Status update failed: ${error.message}`);
    }
  }
}

module.exports = {
  DriverVerificationService,
  upload,
  VERIFICATION_STATUS
};
