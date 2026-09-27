const express = require("express");

const {
    createSalesOrder,
    getSalesOrders,
    getSalesOrderById,
    confirmSalesOrder
} = require("../controllers/salesOrderController");

const {
    authenticateToken,
    authorizeRoles
} = require("../middleware/auth");

const router = express.Router();

router.post(
    "/",
    authenticateToken,
    authorizeRoles("ADMIN", "SALES_USER"),
    createSalesOrder
);

router.get(
    "/",
    authenticateToken,
    authorizeRoles("ADMIN", "SALES_USER"),
    getSalesOrders
);

router.get(
    "/:id",
    authenticateToken,
    authorizeRoles("ADMIN", "SALES_USER"),
    getSalesOrderById
);

router.put(
    "/:id/confirm",
    authenticateToken,
    authorizeRoles("ADMIN", "SALES_USER"),
    confirmSalesOrder
);

module.exports = router;