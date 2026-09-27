const express = require("express");

const {
    createQuotation,
    getQuotations,
    getQuotationById,
    updateQuotationStatus,
    convertQuotationToSalesOrder
} = require("../controllers/quotationController");

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/auth");

const router = express.Router();

router.post(
    "/",
    authenticateToken,
    authorizeRoles("SALES_USER", "ADMIN"),
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

router.patch(
    "/:id/status",
    authenticateToken,
    authorizeRoles("SALES_USER", "ADMIN"),
    updateQuotationStatus
);

router.post(
    "/:id/convert",
    authenticateToken,
    authorizeRoles("SALES_USER", "ADMIN"),
    convertQuotationToSalesOrder
);

module.exports = router;