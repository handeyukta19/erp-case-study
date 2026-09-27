const express = require("express");

const {
    createEnquiry,
    getEnquiries,
    getEnquiryById
} = require("../controllers/enquiryController");

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/auth");

const router = express.Router();

router.post(
    "/",
    authenticateToken,
    authorizeRoles("ADMIN", "SALES_USER"),
    createEnquiry
);

router.get(
    "/",
    authenticateToken,
    authorizeRoles("ADMIN", "SALES_USER"),
    getEnquiries
);

router.get(
    "/:id",
    authenticateToken,
    authorizeRoles("ADMIN", "SALES_USER"),
    getEnquiryById
);

module.exports = router;