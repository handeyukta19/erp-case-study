const express = require("express");

const {
    createCustomer,
    getCustomers
} = require("../controllers/customerController");

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/auth");

const router = express.Router();

router.post(
    "/",
    authenticateToken,
    authorizeRoles("ADMIN", "SALES_USER"),
    createCustomer
);

router.get(
    "/",
    authenticateToken,
    authorizeRoles("ADMIN", "SALES_USER"),
    getCustomers
);

module.exports = router;