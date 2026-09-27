const express = require("express");

const {
    createQuotation,
    getQuotations,
    getQuotationById
} = require("../controllers/quotationController");

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/auth");

const router = express.Router();

router.post(
    "/",
    authenticateToken,
    authorizeRoles("ADMIN", "SALES_USER"),
    createQuotation
);

router.get(
    "/",
    authenticateToken,
    authorizeRoles("ADMIN", "SALES_USER"),
    getQuotations
);

router.get(
    "/:id",
    authenticateToken,
    authorizeRoles("ADMIN", "SALES_USER"),
    getQuotationById
);

module.exports = router;